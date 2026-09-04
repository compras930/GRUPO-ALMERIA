-- Mescla os produtos duplicados por variação de maiúscula/minúscula (mesmo nome
-- ignorando caixa + MESMA unidade de medida), repontando TODAS as tabelas que
-- referenciam Produto e apagando as linhas duplicadas.
--
-- Rode o produtos-duplicados-01-diagnostico.sql ANTES e confira o que vai ser
-- mesclado. Homônimos com unidade de medida diferente não são tocados aqui de
-- propósito (ver comentário no diagnóstico).
--
-- Seguro de rodar mais de uma vez: na segunda execução nenhum grupo duplicado é
-- encontrado, então todos os passos não fazem nada. Tudo roda numa transação
-- única — qualquer erro no meio desfaz tudo.
--
-- Como rodar: cole TUDO de uma vez no SQL Editor do Neon e execute. Faça um
-- branch/backup do banco antes (Neon > Branches > Create branch), como já foi
-- feito nas correções anteriores.

BEGIN;

-- ---------------------------------------------------------------------------
-- Passo 1 — Decide, pra cada grupo, qual linha fica (a "canônica") e registra o
-- mapa duplicada -> canônica numa tabela de auditoria permanente.
--
-- Critério de escolha, em ordem: (a) a variante MAIS REFERENCIADA no sistema
-- (soma de todas as tabelas que apontam pra ela) — mexer no que já é mais usado
-- é o menor risco; (b) empate: a mais ANTIGA (criadoEm) — em geral é a que veio
-- da importação original, com a grafia padronizada do catálogo; (c) empate
-- ainda: menor id, só pra ser determinístico.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "_produtos_mesclados" (
  dup_id          text PRIMARY KEY,
  dup_nome        text NOT NULL,
  keep_id         text NOT NULL,
  keep_nome       text NOT NULL,
  unidade_medida  text NOT NULL,
  mesclado_em     timestamptz NOT NULL DEFAULT now()
);

INSERT INTO "_produtos_mesclados" (dup_id, dup_nome, keep_id, keep_nome, unidade_medida)
WITH pesos AS (
  SELECT
    p.id, p.nome, p."unidadeMedida", p."criadoEm",
    lower(btrim(p.nome)) AS nome_chave,
      (SELECT count(*) FROM "IngredienteReceita"      x WHERE x."produtoId" = p.id)
    + (SELECT count(*) FROM "PrecoAtualProduto"       x WHERE x."produtoId" = p.id)
    + (SELECT count(*) FROM "HistoricoPrecoProduto"   x WHERE x."produtoId" = p.id)
    + (SELECT count(*) FROM "EstoqueSaldo"            x WHERE x."produtoId" = p.id)
    + (SELECT count(*) FROM "MovimentoEstoque"        x WHERE x."produtoId" = p.id)
    + (SELECT count(*) FROM "ContagemEstoque"         x WHERE x."produtoId" = p.id)
    + (SELECT count(*) FROM "ItemPedido"              x WHERE x."produtoId" = p.id)
    + (SELECT count(*) FROM "ItemNotaCompra"          x WHERE x."produtoId" = p.id)
    + (SELECT count(*) FROM "ParametroEstoqueProduto" x WHERE x."produtoId" = p.id) AS referencias
  FROM "Produto" p
),
ranqueados AS (
  SELECT
    pesos.*,
    row_number() OVER (
      PARTITION BY nome_chave, "unidadeMedida"
      ORDER BY referencias DESC, "criadoEm" ASC, id ASC
    ) AS posicao,
    count(*) OVER (PARTITION BY nome_chave, "unidadeMedida") AS variantes
  FROM pesos
)
SELECT d.id, d.nome, k.id, k.nome, d."unidadeMedida"
FROM ranqueados d
JOIN ranqueados k
  ON k.nome_chave = d.nome_chave
 AND k."unidadeMedida" = d."unidadeMedida"
 AND k.posicao = 1
WHERE d.variantes > 1
  AND d.posicao > 1
ON CONFLICT (dup_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Passo 2 — Tabelas SEM constraint de unicidade envolvendo produtoId: basta
-- repontar direto pra linha canônica.
-- ---------------------------------------------------------------------------
UPDATE "IngredienteReceita" t SET "produtoId" = m.keep_id
  FROM "_produtos_mesclados" m WHERE t."produtoId" = m.dup_id;

UPDATE "HistoricoPrecoProduto" t SET "produtoId" = m.keep_id
  FROM "_produtos_mesclados" m WHERE t."produtoId" = m.dup_id;

UPDATE "MovimentoEstoque" t SET "produtoId" = m.keep_id
  FROM "_produtos_mesclados" m WHERE t."produtoId" = m.dup_id;

UPDATE "ContagemEstoque" t SET "produtoId" = m.keep_id
  FROM "_produtos_mesclados" m WHERE t."produtoId" = m.dup_id;

UPDATE "ItemPedido" t SET "produtoId" = m.keep_id
  FROM "_produtos_mesclados" m WHERE t."produtoId" = m.dup_id;

UPDATE "ItemNotaCompra" t SET "produtoId" = m.keep_id
  FROM "_produtos_mesclados" m WHERE t."produtoId" = m.dup_id;

-- ---------------------------------------------------------------------------
-- Passo 3 — Tabelas COM @@unique([unidadeId, produtoId]): a canônica e a
-- duplicada podem ter, cada uma, uma linha pra mesma unidade — repontar direto
-- violaria a constraint. Pra cada uma o padrão é o mesmo: calcula o estado
-- final desejado, apaga as linhas da duplicada, e grava o resultado na
-- canônica (INSERT ... ON CONFLICT). Assim funciona pra qualquer número de
-- variantes no grupo (2, 3, 10) sem depender de qual linha o Postgres
-- escolheria num UPDATE ... FROM ambíguo.
-- ---------------------------------------------------------------------------

-- 3a) EstoqueSaldo: saldo é quantidade física do MESMO insumo cadastrado duas
--     vezes, então SOMA (o ledger MovimentoEstoque já foi todo repontado no
--     passo 2, e a soma mantém saldo e ledger coerentes entre si).
CREATE TEMP TABLE _saldo_final ON COMMIT DROP AS
SELECT m.keep_id AS produto_id, d."unidadeId" AS unidade_id, sum(d.quantidade) AS quantidade
FROM "EstoqueSaldo" d
JOIN "_produtos_mesclados" m ON m.dup_id = d."produtoId"
GROUP BY m.keep_id, d."unidadeId";

DELETE FROM "EstoqueSaldo" WHERE "produtoId" IN (SELECT dup_id FROM "_produtos_mesclados");

INSERT INTO "EstoqueSaldo" (id, "unidadeId", "produtoId", quantidade, "atualizadoEm")
SELECT gen_random_uuid()::text, unidade_id, produto_id, quantidade, now() FROM _saldo_final
ON CONFLICT ("unidadeId", "produtoId") DO UPDATE
SET quantidade = "EstoqueSaldo".quantidade + EXCLUDED.quantidade, "atualizadoEm" = now();

-- 3b) PrecoAtualProduto: é cache do "preço mais recente", então vence a linha de
--     dataCompra mais nova — mesma regra que o schema já documenta ("só é
--     sobrescrito se a nova dataCompra for mais recente"). O histórico completo
--     não se perde: HistoricoPrecoProduto foi todo repontado no passo 2.
CREATE TEMP TABLE _preco_final ON COMMIT DROP AS
SELECT DISTINCT ON (m.keep_id, d."unidadeId")
       m.keep_id AS produto_id, d."unidadeId" AS unidade_id, d.preco, d."dataCompra" AS data_compra
FROM "PrecoAtualProduto" d
JOIN "_produtos_mesclados" m ON m.dup_id = d."produtoId"
ORDER BY m.keep_id, d."unidadeId", d."dataCompra" DESC;

DELETE FROM "PrecoAtualProduto" WHERE "produtoId" IN (SELECT dup_id FROM "_produtos_mesclados");

INSERT INTO "PrecoAtualProduto" (id, "unidadeId", "produtoId", preco, "dataCompra", "atualizadoEm")
SELECT gen_random_uuid()::text, unidade_id, produto_id, preco, data_compra, now() FROM _preco_final
ON CONFLICT ("unidadeId", "produtoId") DO UPDATE
SET preco = EXCLUDED.preco, "dataCompra" = EXCLUDED."dataCompra", "atualizadoEm" = now()
WHERE EXCLUDED."dataCompra" > "PrecoAtualProduto"."dataCompra";

-- 3c) ParametroEstoqueProduto: estoque mínimo/ideal é parâmetro definido a mão.
--     Se a canônica já tem parâmetro pra essa unidade, ele MANDA (DO NOTHING);
--     o da duplicada só é aproveitado quando a canônica não tinha nenhum.
CREATE TEMP TABLE _param_final ON COMMIT DROP AS
SELECT DISTINCT ON (m.keep_id, d."unidadeId")
       m.keep_id AS produto_id, d."unidadeId" AS unidade_id, d."estoqueMinimo" AS minimo, d."estoqueIdeal" AS ideal
FROM "ParametroEstoqueProduto" d
JOIN "_produtos_mesclados" m ON m.dup_id = d."produtoId"
ORDER BY m.keep_id, d."unidadeId", d.id;

DELETE FROM "ParametroEstoqueProduto" WHERE "produtoId" IN (SELECT dup_id FROM "_produtos_mesclados");

INSERT INTO "ParametroEstoqueProduto" (id, "unidadeId", "produtoId", "estoqueMinimo", "estoqueIdeal")
SELECT gen_random_uuid()::text, unidade_id, produto_id, minimo, ideal FROM _param_final
ON CONFLICT ("unidadeId", "produtoId") DO NOTHING;

-- ---------------------------------------------------------------------------
-- Passo 4 — Agora que nada mais aponta pra elas, apaga as linhas duplicadas.
-- ---------------------------------------------------------------------------
DELETE FROM "Produto" WHERE id IN (SELECT dup_id FROM "_produtos_mesclados");

COMMIT;

-- ---------------------------------------------------------------------------
-- Verificação (rode junto, os resultados vêm depois do COMMIT)
-- ---------------------------------------------------------------------------

-- 4a) O que foi mesclado (auditoria permanente — dá pra consultar depois).
SELECT dup_nome AS grafia_removida, keep_nome AS grafia_mantida, unidade_medida, keep_id AS produto_id_final, mesclado_em
FROM "_produtos_mesclados" ORDER BY mesclado_em DESC, keep_nome;

-- 4b) Tem que voltar ZERO linhas: nenhum grupo duplicado sobrando.
WITH grupos AS (
  SELECT lower(btrim(nome)) AS nome_chave, "unidadeMedida", count(*) AS variantes
  FROM "Produto" GROUP BY lower(btrim(nome)), "unidadeMedida" HAVING count(*) > 1
)
SELECT * FROM grupos;

-- 4c) Tem que voltar ZERO linhas: nenhuma referência órfã apontando pra produto
--     que não existe mais.
SELECT 'IngredienteReceita' AS tabela, count(*) AS orfaos FROM "IngredienteReceita" t
  WHERE t."produtoId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Produto" p WHERE p.id = t."produtoId")
UNION ALL SELECT 'PrecoAtualProduto', count(*) FROM "PrecoAtualProduto" t
  WHERE NOT EXISTS (SELECT 1 FROM "Produto" p WHERE p.id = t."produtoId")
UNION ALL SELECT 'HistoricoPrecoProduto', count(*) FROM "HistoricoPrecoProduto" t
  WHERE NOT EXISTS (SELECT 1 FROM "Produto" p WHERE p.id = t."produtoId")
UNION ALL SELECT 'EstoqueSaldo', count(*) FROM "EstoqueSaldo" t
  WHERE NOT EXISTS (SELECT 1 FROM "Produto" p WHERE p.id = t."produtoId")
UNION ALL SELECT 'MovimentoEstoque', count(*) FROM "MovimentoEstoque" t
  WHERE NOT EXISTS (SELECT 1 FROM "Produto" p WHERE p.id = t."produtoId")
UNION ALL SELECT 'ContagemEstoque', count(*) FROM "ContagemEstoque" t
  WHERE NOT EXISTS (SELECT 1 FROM "Produto" p WHERE p.id = t."produtoId")
UNION ALL SELECT 'ItemPedido', count(*) FROM "ItemPedido" t
  WHERE NOT EXISTS (SELECT 1 FROM "Produto" p WHERE p.id = t."produtoId")
UNION ALL SELECT 'ItemNotaCompra', count(*) FROM "ItemNotaCompra" t
  WHERE t."produtoId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Produto" p WHERE p.id = t."produtoId")
UNION ALL SELECT 'ParametroEstoqueProduto', count(*) FROM "ParametroEstoqueProduto" t
  WHERE NOT EXISTS (SELECT 1 FROM "Produto" p WHERE p.id = t."produtoId");

-- 4d) Efeito colateral esperado a REVISAR (não é erro, e este script não mexe
--     nisso de propósito): se as duas grafias do mesmo produto estavam na MESMA
--     ficha, agora a ficha tem duas linhas do mesmo produtoId. Isso entra na
--     mesma frente das combinações receita×ingrediente duplicadas que já
--     estavam mapeadas pra revisão — as quantidades podem ser complementares
--     (somar) ou repetição da mesma coisa (apagar uma), e só quem conhece a
--     ficha decide.
SELECT r.nome AS receita, u.nome AS unidade, p.nome AS produto, count(*) AS linhas_repetidas,
       string_agg(i.quantidade::text || ' ' || i."unidadeMedida", ' + ' ORDER BY i.id) AS quantidades
FROM "IngredienteReceita" i
JOIN "Receita" r ON r.id = i."receitaId"
JOIN "Unidade" u ON u.id = r."unidadeId"
JOIN "Produto" p ON p.id = i."produtoId"
WHERE i."produtoId" IN (SELECT keep_id FROM "_produtos_mesclados")
GROUP BY r.nome, u.nome, p.nome, i."receitaId", i."produtoId"
HAVING count(*) > 1
ORDER BY count(*) DESC, r.nome;
