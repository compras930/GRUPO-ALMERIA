-- Liga Matri à despensa do Noroeste: mesma cozinha, mesma compra, mesma
-- contagem — cardápio e caixa continuam separados.
--
-- Ver src/lib/unidade-fisica.ts pra a regra completa. Em resumo:
--   segue a DESPENSA -> preço, saldo, movimento, contagem, nota, pedido, parâmetro
--   segue a CASA     -> item de venda, venda semanal
--
-- Pré-requisito: a migration 20260917180000_unidade_estoque_compartilhado.
--
-- POR QUE AGORA. Enquanto as tabelas de operação estiverem zeradas, unificar é
-- de graça: não há histórico de estoque pra fundir nem contagem pra
-- reconciliar. O passo 1 confere isso — se já houver movimento, PARE e me
-- chame, porque aí a unificação vira migração de dado e muda de natureza.
--
-- Idempotente. Sem BEGIN/COMMIT (o editor do Neon roda cada comando em
-- autocommit). Faça o branch de backup antes.

-- ---------------------------------------------------------------------------
-- Passo 1 — PLANO. Rode e confira antes de seguir.
--
-- 1a) Operação existente. Todas as colunas de Noroeste e Matri têm que vir
--     ZERO (exceto vendas_semanais, que é da casa e pode ficar como está).
--     Qualquer número diferente de zero em saldos/movimentos/contagens/notas/
--     pedidos: PARE.
-- ---------------------------------------------------------------------------
SELECT un.nome AS casa,
  (SELECT count(*) FROM "EstoqueSaldo"            x WHERE x."unidadeId" = un.id) AS saldos,
  (SELECT count(*) FROM "MovimentoEstoque"        x WHERE x."unidadeId" = un.id) AS movimentos,
  (SELECT count(*) FROM "ContagemEstoque"         x WHERE x."unidadeId" = un.id) AS contagens,
  (SELECT count(*) FROM "NotaCompra"              x WHERE x."unidadeId" = un.id) AS notas,
  (SELECT count(*) FROM "PedidoCompra"            x WHERE x."unidadeId" = un.id) AS pedidos,
  (SELECT count(*) FROM "ParametroEstoqueProduto" x WHERE x."unidadeId" = un.id) AS parametros,
  (SELECT count(*) FROM "VendaSemanal"            x WHERE x."unidadeId" = un.id) AS vendas_semanais
FROM "Unidade" un
WHERE un.nome IN ('Noroeste', 'Matri')
ORDER BY un.nome;

-- 1b) Preço duplicado, e o que acontece com cada caso.
--
--     A regra é a mesma do resto deste projeto: o preço POSITIVO do Noroeste
--     manda; zero não é preço, é ausência. Sem essa distinção, um insumo com
--     preço zero no Noroeste e preço bom no Matri sairia da unificação sem
--     preço nenhum — foi o que aconteceu na primeira versão deste script
--     (o Noroeste tem 13 produtos zerados, e uma ficha do Matri perdeu custo
--     por causa disso; a verificação 4b pegou).
WITH n AS (SELECT id FROM "Unidade" WHERE nome = 'Noroeste'),
     m AS (SELECT id FROM "Unidade" WHERE nome = 'Matri')
SELECT
  count(*) FILTER (WHERE pn."produtoId" IS NULL)                                  AS so_matri_tem_vai_mover,
  count(*) FILTER (WHERE pn.preco = 0 AND pm.preco > 0)                           AS noroeste_zerado_matri_preenche,
  count(*) FILTER (WHERE pn.preco > 0 AND pn.preco = pm.preco)                    AS iguais_nada_a_fazer,
  count(*) FILTER (WHERE pn.preco > 0 AND pm.preco > 0 AND pn.preco <> pm.preco)  AS diferentes_noroeste_vence
FROM "PrecoAtualProduto" pm
LEFT JOIN "PrecoAtualProduto" pn
       ON pn."produtoId" = pm."produtoId" AND pn."unidadeId" = (SELECT id FROM n)
WHERE pm."unidadeId" = (SELECT id FROM m);

-- 1c) Os que divergem, em detalhe. Confira se o preço do Noroeste é o bom.
WITH n AS (SELECT id FROM "Unidade" WHERE nome = 'Noroeste'),
     m AS (SELECT id FROM "Unidade" WHERE nome = 'Matri')
SELECT p.nome AS insumo, p."unidadeMedida" AS un,
       round(pn.preco::numeric, 2) AS noroeste_fica,
       round(pm.preco::numeric, 2) AS matri_descartado
FROM "PrecoAtualProduto" pm
JOIN "PrecoAtualProduto" pn
  ON pn."produtoId" = pm."produtoId" AND pn."unidadeId" = (SELECT id FROM n)
JOIN "Produto" p ON p.id = pm."produtoId"
WHERE pm."unidadeId" = (SELECT id FROM m) AND pn.preco > 0 AND pm.preco > 0 AND pn.preco <> pm.preco
ORDER BY abs(pn.preco - pm.preco) DESC;

-- ---------------------------------------------------------------------------
-- Passo 2 — Move pro Noroeste o preço do Matri onde o Noroeste não tem nenhum.
--
-- Duas situações, e as duas precisam ser cobertas antes de ligar as casas:
--   a) o Noroeste não tem linha pra esse insumo  -> insere
--   b) o Noroeste tem linha com preço ZERO       -> preenche
-- Sem (b), um insumo zerado no Noroeste e com preço bom no Matri sairia da
-- unificação sem preço nenhum.
--
-- Preço positivo do Noroeste nunca é sobrescrito.
-- ---------------------------------------------------------------------------
WITH n AS (SELECT id FROM "Unidade" WHERE nome = 'Noroeste'),
     m AS (SELECT id FROM "Unidade" WHERE nome = 'Matri'),
 inseridos AS (
  INSERT INTO "PrecoAtualProduto" (id, "unidadeId", "produtoId", preco, "dataCompra", "atualizadoEm")
  SELECT gen_random_uuid()::text, (SELECT id FROM n), pm."produtoId", pm.preco, pm."dataCompra", now()
  FROM "PrecoAtualProduto" pm
  WHERE pm."unidadeId" = (SELECT id FROM m)
    AND pm.preco > 0
    AND NOT EXISTS (SELECT 1 FROM "PrecoAtualProduto" pn
                     WHERE pn."produtoId" = pm."produtoId" AND pn."unidadeId" = (SELECT id FROM n))
  ON CONFLICT ("unidadeId", "produtoId") DO NOTHING
  RETURNING "unidadeId", "produtoId", preco
),
 preenchidos AS (
  UPDATE "PrecoAtualProduto" pn
  SET preco = pm.preco, "dataCompra" = pm."dataCompra", "atualizadoEm" = now()
  FROM "PrecoAtualProduto" pm
  WHERE pn."unidadeId" = (SELECT id FROM n)
    AND pm."unidadeId" = (SELECT id FROM m)
    AND pm."produtoId" = pn."produtoId"
    AND pn.preco = 0        -- zero não é preço, é ausência
    AND pm.preco > 0
  RETURNING pn."unidadeId", pn."produtoId", pn.preco
),
 movidos AS (SELECT * FROM inseridos UNION ALL SELECT * FROM preenchidos)
INSERT INTO "HistoricoPrecoProduto" (id, "unidadeId", "produtoId", preco, origem, "origemId", "dataCompra", "criadoEm")
SELECT gen_random_uuid()::text, mv."unidadeId", mv."produtoId", mv.preco,
       'UNIFICACAO_DESPENSA', 'preço veio da casa Matri ao unificar a despensa com Noroeste', now(), now()
FROM movidos mv;

-- ---------------------------------------------------------------------------
-- Passo 3 — Apaga os preços do Matri.
--
-- Deixar esses registros seria pior que apagar: se algum ponto do sistema
-- ainda consultar por casa em vez de por despensa, ele leria um preço parado
-- no tempo e o erro seria invisível. Sem a linha, o custo vem zero — e linha
-- de ficha custando zero é coisa que o sistema já sabe apontar.
--
-- O histórico (HistoricoPrecoProduto) do Matri NÃO é apagado: é registro do
-- que aconteceu, e reescrever ledger não se faz.
-- ---------------------------------------------------------------------------
DELETE FROM "PrecoAtualProduto"
WHERE "unidadeId" = (SELECT id FROM "Unidade" WHERE nome = 'Matri');

-- ---------------------------------------------------------------------------
-- Passo 4 — Liga Matri à despensa do Noroeste.
-- ---------------------------------------------------------------------------
UPDATE "Unidade"
SET "estoqueEmId" = (SELECT id FROM "Unidade" WHERE nome = 'Noroeste')
WHERE nome = 'Matri';

-- ---------------------------------------------------------------------------
-- Verificação
-- ---------------------------------------------------------------------------

-- 4a) Matri aponta pro Noroeste; as outras quatro seguem com despensa própria.
SELECT un.nome AS casa,
       COALESCE((SELECT d.nome FROM "Unidade" d WHERE d.id = un."estoqueEmId"), '(própria)') AS despensa,
       (SELECT count(*) FROM "PrecoAtualProduto" p WHERE p."unidadeId" = un.id) AS precos_proprios,
       (SELECT count(*) FROM "ItemVenda" iv WHERE iv."unidadeId" = un.id)       AS itens_de_venda
FROM "Unidade" un
ORDER BY un.nome;
-- Esperado: Matri com despensa "Noroeste", 0 preços próprios e os 175 itens de
-- venda intactos. Noroeste com preços = 324 + os que vieram do Matri.

-- 4b) Nenhuma ficha do Matri pode ter ficado sem preço por causa disto.
--     Compare com o número de antes: tem que ser igual ou MENOR.
SELECT count(*) AS linhas_de_ficha_do_matri_sem_preco
FROM "IngredienteReceita" i
JOIN "Receita" r  ON r.id = i."receitaId"
JOIN "Unidade" un ON un.id = r."unidadeId"
WHERE un.nome = 'Matri'
  AND i."produtoId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "PrecoAtualProduto" pa
    JOIN "Unidade" casa ON casa.id = un.id
    WHERE pa."produtoId" = i."produtoId"
      AND pa."unidadeId" = COALESCE(casa."estoqueEmId", casa.id)
      AND pa.preco > 0
  );
