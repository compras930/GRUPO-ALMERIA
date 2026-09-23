-- Rodada geral de pareamento — gerado por gerar-sql-geral.ts, não editar à mão.
--
-- 6 produtos novos, 2 códigos gravados em produtos existentes.
-- R$ 55.771,43 de compra passam a ser reconhecidos.
-- 0 linha(s) recusada(s), listadas no fim.
--
-- Vale para TODAS as casas: codigoTeknisa é único e global, então cada código
-- pareado aqui conserta a compra de quem quer que tenha comprado aquele item.
--
-- IDEMPOTENTE: ids derivados por hash, INSERT com ON CONFLICT e UPDATE
-- guardado por "só se ainda estiver nulo". Rodar duas vezes não duplica nada.
--
-- Rode um passo de cada vez no editor do Neon, conferindo entre eles.

-- ---------------------------------------------------------------------------
-- PASSO 1 — Criar os 6 produtos novos.
-- ---------------------------------------------------------------------------
INSERT INTO "Produto" (id, nome, "unidadeMedida", "codigoTeknisa", ativo, "criadoEm")
VALUES
  ('pge1b74ce51b290013ba8094e', 'CAFE EM GRAO 1 KG REVENDA', 'UND', '325000001003', true, now()),
  ('pge4fb0eca47dd72aa0f6d9cb', 'CUPIM BOVINO SEM OSSO KG', 'KG', '100000017122', true, now()),
  ('pge0cdbb132f803f76ffecf59', 'PESCADA AMARELA KG', 'KG', '100015013120', true, now()),
  ('pgecaea4bde1b39b0fe7e2838', 'GLP EM CILINDRO GRANEL', 'KG', '125000000000', true, now()),
  ('pgeccb7058cec467b16ff3636', 'BARRIGA DE PORCO - PANCETA KG', 'KG', '100005019102', true, now()),
  ('pge33ff1b25310f7dd6bd75dc', 'COXAO MOLE BOVINO KG', 'KG', '100000017118', true, now())
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- PASSO 2 — Gravar o código nos 2 produtos que já existiam.
--
-- Só onde o código ainda é nulo. Produto que já declara um código não é
-- sobrescrito: dois códigos para o mesmo item é o gargalo estrutural que
-- CodigoCompraProduto vai resolver, não coisa de sobrescrever no escuro.
-- ---------------------------------------------------------------------------
UPDATE "Produto" p SET "codigoTeknisa" = v.codigo
FROM (VALUES
  ('cmtc03sim008xcwgtwc66n02k', '400000000113'),
  ('cmtc03sj20097cwgtgbiu5oye', '105000052655')
) AS v(id, codigo)
WHERE p.id = v.id AND p."codigoTeknisa" IS NULL;

-- ---------------------------------------------------------------------------
-- PASSO 3 — Religar as linhas de compra que ficaram sem produto.
--
-- Criar o produto não faz a compra velha casar sozinha. As linhas já estão
-- em ItemNotaCompra com produtoId nulo, e a chave de idempotência impede
-- recarregar o workflow pra refazer o casamento.
--
-- Casa por codigoBruto, que é o código exato que veio na nota.
-- ---------------------------------------------------------------------------
UPDATE "ItemNotaCompra" i SET "produtoId" = p.id
FROM "Produto" p
WHERE i."produtoId" IS NULL
  AND i."codigoBruto" = p."codigoTeknisa"
  AND p."codigoTeknisa" IN ('325000001003', '100000017122', '100015013120', '125000000000', '100005019102', '100000017118', '400000000113', '105000052655');

-- ---------------------------------------------------------------------------
-- PASSO 4 — Preço atual e histórico, POR DESPENSA, da compra mais recente.
--
-- Uma linha por (despensa, produto): o mesmo item comprado por duas casas
-- tem dois preços, e é assim que o app lê custo. O preço sai do próprio
-- ItemNotaCompra religado no passo 3, não da planilha — tem que ser o que a
-- nota disse, não uma média calculada por mim.
--
-- A despensa é COALESCE(estoqueEmId, id): casa que guarda estoque em outra
-- (o CPD das casas do XMenu) tem preço na despensa, não na casa.
-- ---------------------------------------------------------------------------
WITH ultima AS (
  SELECT DISTINCT ON (COALESCE(u."estoqueEmId", u.id), i."produtoId")
         COALESCE(u."estoqueEmId", u.id) AS "unidadeId",
         i."produtoId", i."precoUnitNovo" AS preco, i."dataCompra"
  FROM "ItemNotaCompra" i
  JOIN "NotaCompra" n ON n.id = i."notaCompraId"
  JOIN "Unidade"    u ON u.id = n."unidadeId"
  JOIN "Produto"    p ON p.id = i."produtoId"
  WHERE p."codigoTeknisa" IN ('325000001003', '100000017122', '100015013120', '125000000000', '100005019102', '100000017118', '400000000113', '105000052655')
    AND i."precoUnitNovo" > 0
  ORDER BY COALESCE(u."estoqueEmId", u.id), i."produtoId", i."dataCompra" DESC, i.id
)
INSERT INTO "PrecoAtualProduto" (id, "unidadeId", "produtoId", preco, "dataCompra", "atualizadoEm")
SELECT 'prge' || left(md5(u."unidadeId" || u."produtoId"), 21),
       u."unidadeId", u."produtoId", u.preco, u."dataCompra", now()
FROM ultima u
ON CONFLICT ("unidadeId", "produtoId") DO UPDATE
  SET preco = EXCLUDED.preco, "dataCompra" = EXCLUDED."dataCompra", "atualizadoEm" = now();

-- O histórico, para o relatório de variação de preço.
INSERT INTO "HistoricoPrecoProduto" (id, "unidadeId", "produtoId", preco, origem, "origemId", "dataCompra", "criadoEm")
SELECT 'hge' || left(md5(pa."unidadeId" || pa."produtoId"), 22),
       pa."unidadeId", pa."produtoId", pa.preco,
       'NOTA_COMPRA', 'pareamento-geral', pa."dataCompra", now()
FROM "PrecoAtualProduto" pa
JOIN "Produto" p ON p.id = pa."produtoId"
WHERE p."codigoTeknisa" IN ('325000001003', '100000017122', '100015013120', '125000000000', '100005019102', '100000017118', '400000000113', '105000052655')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- VERIFICAÇÃO
-- ---------------------------------------------------------------------------
-- 1) Os produtos desta rodada: preço por casa. Nenhum pode ficar sem preço —
--    produto sem preço é custo zero, que é pior que produto sem pareamento.
SELECT p.nome, p."unidadeMedida", p."codigoTeknisa",
       u.nome AS despensa, round(pa.preco::numeric, 2) AS preco, pa."dataCompra"::date
FROM "Produto" p
LEFT JOIN "PrecoAtualProduto" pa ON pa."produtoId" = p.id
LEFT JOIN "Unidade" u ON u.id = pa."unidadeId"
WHERE p."codigoTeknisa" IN ('325000001003', '100000017122', '100015013120', '125000000000', '100005019102', '100000017118', '400000000113', '105000052655')
ORDER BY p.nome, u.nome;

-- 2) O reconhecimento de cada casa depois da rodada.
SELECT u.nome AS casa,
       count(*) AS linhas,
       count(i."produtoId") AS reconhecidas,
       round(100.0 * count(i."produtoId") / nullif(count(*), 0), 1) AS pct,
       round(sum(i."valorTotal")::numeric, 2) AS comprado,
       round(sum(i."valorTotal") FILTER (WHERE i."produtoId" IS NOT NULL)::numeric, 2) AS reconhecido
FROM "ItemNotaCompra" i
JOIN "NotaCompra" n ON n.id = i."notaCompraId"
JOIN "Unidade" u ON u.id = n."unidadeId"
GROUP BY u.nome
ORDER BY u.nome;

