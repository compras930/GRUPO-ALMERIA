-- Funde o item "(COMPRA)" do Teknisa no item de ESTOQUE correspondente.
--
-- O QUE ESTÁ ERRADO HOJE. O Teknisa tem dois cadastros para a mesma coisa: o
-- item que se COMPRA ("OLEO DE ALGODAO 14,5 LT (COMPRA)") e o que se MOVIMENTA
-- em estoque ("OLEO DE ALGODAO 14,5 LT"). Na carga, os dois viraram Produtos
-- separados. O resultado:
--
--   - a folha de contagem traz o mesmo insumo DUAS VEZES, e quem conta ou
--     conta duas vezes ou pula um;
--   - o saldo fica partido: a nota entra no item de compra, a ficha técnica
--     desconta do item de estoque. Um só sobe, o outro só desce;
--   - a curva ABC divide o valor do insumo em dois, e ele pode cair de classe
--     por metade do próprio tamanho;
--   - a conferência da contagem acusa falta num e sobra no outro, para sempre.
--
-- SÓ OS PARES DE MESMA UNIDADE, de propósito. Quando a unidade do item de
-- compra é diferente da do estoque (UND contra LT, UND contra GR), falta um
-- número — quantos mililitros tem a garrafa, quantos gramas tem o maço — que
-- não está em lugar nenhum do sistema. Somar quantidades em escalas diferentes
-- geraria saldo errado com cara de saldo certo, que é pior que não fazer nada.
-- Esses pares ficam de fora e aparecem na conferência 5b, para serem tratados
-- um a um, com o fator informado por gente.
--
-- Modelado no prisma/scripts/produtos-duplicados-02-mesclar.sql, que faz o
-- mesmo para duplicata de grafia. A diferença é só o critério do par.
--
-- COMO RODAR: cole tudo de uma vez no SQL Editor do Neon. FAÇA UM BRANCH ANTES
-- (Neon > Branches > Create branch) — isto mexe em saldo e em preço.
-- Seguro rodar duas vezes: na segunda não há par a mesclar e tudo vira no-op.

BEGIN;

-- ---------------------------------------------------------------------------
-- Passo 1 — Monta o mapa (COMPRA) -> estoque, numa tabela de auditoria.
--
-- O item de ESTOQUE é sempre o que FICA: é nele que a cozinha conta, é a
-- unidade que a ficha técnica usa, e é o que continuará existindo quando o
-- Teknisa mudar o tamanho da caixa.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "_produtos_compra_mesclados" (
  dup_id       text PRIMARY KEY,
  dup_nome     text NOT NULL,
  keep_id      text NOT NULL,
  keep_nome    text NOT NULL,
  unidade      text NOT NULL,
  mesclado_em  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO "_produtos_compra_mesclados" (dup_id, dup_nome, keep_id, keep_nome, unidade)
WITH chaves AS (
  SELECT p.id, p.nome, p."unidadeMedida", p."criadoEm",
         p.nome ILIKE '%(COMPRA)%' AS eh_compra,
         regexp_replace(
           upper(translate(replace(upper(p.nome), '(COMPRA)', ''),
                           'ÁÀÂÃÉÊÍÓÔÕÚÇ', 'AAAAEEIOOOUC')),
           '[^A-Z0-9]', '', 'g') AS base
    FROM "Produto" p
)
SELECT c.id, c.nome, e.id, e.nome, c."unidadeMedida"
  FROM chaves c
  JOIN chaves e
    ON e.base = c.base
   AND e.id <> c.id
   AND NOT e.eh_compra
   -- MESMA unidade: ver o comentário do cabeçalho.
   AND upper(btrim(e."unidadeMedida")) = upper(btrim(c."unidadeMedida"))
 WHERE c.eh_compra
ON CONFLICT (dup_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Passo 2 — Tabelas sem unicidade por produto: repontar direto.
-- ---------------------------------------------------------------------------
UPDATE "IngredienteReceita" t SET "produtoId" = m.keep_id
  FROM "_produtos_compra_mesclados" m WHERE t."produtoId" = m.dup_id;

UPDATE "HistoricoPrecoProduto" t SET "produtoId" = m.keep_id
  FROM "_produtos_compra_mesclados" m WHERE t."produtoId" = m.dup_id;

UPDATE "MovimentoEstoque" t SET "produtoId" = m.keep_id
  FROM "_produtos_compra_mesclados" m WHERE t."produtoId" = m.dup_id;

UPDATE "ContagemEstoque" t SET "produtoId" = m.keep_id
  FROM "_produtos_compra_mesclados" m WHERE t."produtoId" = m.dup_id;

UPDATE "ItemPedido" t SET "produtoId" = m.keep_id
  FROM "_produtos_compra_mesclados" m WHERE t."produtoId" = m.dup_id;

UPDATE "ItemNotaCompra" t SET "produtoId" = m.keep_id
  FROM "_produtos_compra_mesclados" m WHERE t."produtoId" = m.dup_id;

UPDATE "ListaPedidoItem" t SET "produtoId" = m.keep_id
  FROM "_produtos_compra_mesclados" m WHERE t."produtoId" = m.dup_id;

-- O CÓDIGO DE COMPRA MUDA DE DONO — é o passo que faz a próxima nota cair no
-- lugar certo sozinha. Sem ele, a carga de amanhã recriaria o item (COMPRA).
-- Conflito (o item de estoque já tinha código para a mesma unidade): o dele
-- manda, e o da duplicata é descartado no passo 4.
UPDATE "CodigoCompraProduto" t SET "produtoId" = m.keep_id
  FROM "_produtos_compra_mesclados" m
 WHERE t."produtoId" = m.dup_id
   AND NOT EXISTS (
     SELECT 1 FROM "CodigoCompraProduto" x
      WHERE x."produtoId" = m.keep_id AND x."unidadeCompra" = t."unidadeCompra"
   );

UPDATE "ConversaoUnidadeCompra" t SET "produtoId" = m.keep_id
  FROM "_produtos_compra_mesclados" m
 WHERE t."produtoId" = m.dup_id
   AND NOT EXISTS (
     SELECT 1 FROM "ConversaoUnidadeCompra" x
      WHERE x."produtoId" = m.keep_id AND x."unidadeCompra" = t."unidadeCompra"
   );

-- ---------------------------------------------------------------------------
-- Passo 3 — Tabelas com @@unique([unidadeId, produtoId]).
-- ---------------------------------------------------------------------------

-- 3a) EstoqueSaldo: é a MESMA mercadoria na MESMA unidade de medida (o passo 1
--     só pareia unidades iguais), então soma. O ledger já foi repontado.
WITH final AS (
  SELECT m.keep_id AS produto_id, d."unidadeId" AS unidade_id, sum(d.quantidade) AS quantidade
    FROM "EstoqueSaldo" d
    JOIN "_produtos_compra_mesclados" m ON m.dup_id = d."produtoId"
   GROUP BY 1, 2
),
removidas AS (
  DELETE FROM "EstoqueSaldo"
   WHERE "produtoId" IN (SELECT dup_id FROM "_produtos_compra_mesclados")
  RETURNING 1
)
INSERT INTO "EstoqueSaldo" (id, "unidadeId", "produtoId", quantidade, "atualizadoEm")
SELECT gen_random_uuid()::text, unidade_id, produto_id, quantidade, now() FROM final
ON CONFLICT ("unidadeId", "produtoId") DO UPDATE
SET quantidade = "EstoqueSaldo".quantidade + EXCLUDED.quantidade, "atualizadoEm" = now();

-- 3b) PrecoAtualProduto: vence a dataCompra mais nova — e aqui ela quase sempre
--     é a do item (COMPRA), que é por onde a nota entra. O histórico completo
--     não se perde: HistoricoPrecoProduto foi repontado no passo 2.
WITH final AS (
  SELECT DISTINCT ON (m.keep_id, d."unidadeId")
         m.keep_id AS produto_id, d."unidadeId" AS unidade_id,
         d.preco, d."dataCompra" AS data_compra
    FROM "PrecoAtualProduto" d
    JOIN "_produtos_compra_mesclados" m ON m.dup_id = d."produtoId"
   ORDER BY m.keep_id, d."unidadeId", d."dataCompra" DESC
),
removidas AS (
  DELETE FROM "PrecoAtualProduto"
   WHERE "produtoId" IN (SELECT dup_id FROM "_produtos_compra_mesclados")
  RETURNING 1
)
INSERT INTO "PrecoAtualProduto" (id, "unidadeId", "produtoId", preco, "dataCompra", "atualizadoEm")
SELECT gen_random_uuid()::text, unidade_id, produto_id, preco, data_compra, now() FROM final
ON CONFLICT ("unidadeId", "produtoId") DO UPDATE
SET preco = EXCLUDED.preco, "dataCompra" = EXCLUDED."dataCompra", "atualizadoEm" = now()
WHERE EXCLUDED."dataCompra" > "PrecoAtualProduto"."dataCompra";

-- 3c) ParametroEstoqueProduto: a classificação do item de estoque manda quando
--     ela existe; a do (COMPRA) só é aproveitada quando o outro não tinha
--     nenhuma. Depois disso vale reaplicar a curva, que recalcula tudo.
WITH final AS (
  SELECT DISTINCT ON (m.keep_id, d."unidadeId")
         m.keep_id AS produto_id, d."unidadeId" AS unidade_id,
         d."estoqueMinimo" AS minimo, d."estoqueIdeal" AS ideal,
         d."classeAbc" AS classe, d."grupoContagem" AS grupo
    FROM "ParametroEstoqueProduto" d
    JOIN "_produtos_compra_mesclados" m ON m.dup_id = d."produtoId"
   ORDER BY m.keep_id, d."unidadeId", d.id
),
removidas AS (
  DELETE FROM "ParametroEstoqueProduto"
   WHERE "produtoId" IN (SELECT dup_id FROM "_produtos_compra_mesclados")
  RETURNING 1
)
INSERT INTO "ParametroEstoqueProduto"
       (id, "unidadeId", "produtoId", "estoqueMinimo", "estoqueIdeal", "classeAbc", "grupoContagem")
SELECT gen_random_uuid()::text, unidade_id, produto_id, minimo, ideal, classe, grupo FROM final
ON CONFLICT ("unidadeId", "produtoId") DO NOTHING;

-- ---------------------------------------------------------------------------
-- Passo 4 — Nada mais aponta para elas: apaga.
-- O que sobrou de CodigoCompraProduto/ConversaoUnidadeCompra na duplicata sai
-- junto por ON DELETE CASCADE — é o código que o item de estoque já tinha.
-- ---------------------------------------------------------------------------
DELETE FROM "Produto" WHERE id IN (SELECT dup_id FROM "_produtos_compra_mesclados");

COMMIT;

-- ---------------------------------------------------------------------------
-- Conferência (vem depois do COMMIT)
-- ---------------------------------------------------------------------------

-- 5a) O que foi fundido.
SELECT dup_nome AS removido, keep_nome AS mantido, unidade, mesclado_em
  FROM "_produtos_compra_mesclados" ORDER BY mesclado_em DESC, keep_nome;

-- 5b) O QUE FICOU DE FORA e precisa de decisão humana: par de unidade
--     diferente. Para cada um falta dizer quanto do estoque cabe em uma
--     unidade de compra (a garrafa tem 0,7 LT; o maço tem 40 GR).
WITH chaves AS (
  SELECT p.id, p.nome, p."unidadeMedida",
         p.nome ILIKE '%(COMPRA)%' AS eh_compra,
         regexp_replace(
           upper(translate(replace(upper(p.nome), '(COMPRA)', ''),
                           'ÁÀÂÃÉÊÍÓÔÕÚÇ', 'AAAAEEIOOOUC')),
           '[^A-Z0-9]', '', 'g') AS base
    FROM "Produto" p
)
SELECT c.nome AS item_de_compra, c."unidadeMedida" AS un_compra,
       e.nome AS item_de_estoque, e."unidadeMedida" AS un_estoque
  FROM chaves c
  JOIN chaves e ON e.base = c.base AND e.id <> c.id AND NOT e.eh_compra
 WHERE c.eh_compra
   AND upper(btrim(e."unidadeMedida")) <> upper(btrim(c."unidadeMedida"))
 ORDER BY 1;

-- 5c) Tem que voltar ZERO: referência órfã.
SELECT 'IngredienteReceita' AS tabela, count(*) AS orfaos FROM "IngredienteReceita" t
  WHERE t."produtoId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Produto" p WHERE p.id = t."produtoId")
UNION ALL SELECT 'EstoqueSaldo', count(*) FROM "EstoqueSaldo" t
  WHERE NOT EXISTS (SELECT 1 FROM "Produto" p WHERE p.id = t."produtoId")
UNION ALL SELECT 'MovimentoEstoque', count(*) FROM "MovimentoEstoque" t
  WHERE NOT EXISTS (SELECT 1 FROM "Produto" p WHERE p.id = t."produtoId")
UNION ALL SELECT 'ContagemEstoque', count(*) FROM "ContagemEstoque" t
  WHERE NOT EXISTS (SELECT 1 FROM "Produto" p WHERE p.id = t."produtoId")
UNION ALL SELECT 'ItemNotaCompra', count(*) FROM "ItemNotaCompra" t
  WHERE t."produtoId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Produto" p WHERE p.id = t."produtoId")
UNION ALL SELECT 'ListaPedidoItem', count(*) FROM "ListaPedidoItem" t
  WHERE t."produtoId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Produto" p WHERE p.id = t."produtoId");
