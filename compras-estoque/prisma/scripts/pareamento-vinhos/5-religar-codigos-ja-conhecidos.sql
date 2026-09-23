-- Religa as linhas de compra cujo código o produto JÁ tem.
--
-- NÃO PRECISA DE DECISÃO NENHUMA. São 182 códigos e 382 linhas em que o
-- produto já declara exatamente aquele codigoTeknisa e a unidade bate — ou
-- seja, se a carga rodasse hoje, elas casariam sozinhas.
--
-- POR QUE ELAS FICARAM PARA TRÁS. O pareamento se alimenta sozinho: quando uma
-- linha casa por nome+unidade e o produto ainda não tem código, a rota grava o
-- código (`aprenderCodigos`). Mas isso vale dali pra frente — a linha que já
-- estava gravada com produtoId nulo continua nula, e a chave de idempotência
-- impede reprocessar a carga pra refazer o casamento. É o mesmo passo 3 da
-- rodada de vinhos, agora para o que sobrou de todas as casas.
--
-- 180 das 182 têm valorTotal nulo: são das primeiras cargas (17 e 18/09),
-- antes de o workflow mandar quantidade e valor. Por isso somam só R$ 1.059 —
-- mas são 382 linhas contadas como "não reconhecidas", que puxam o percentual
-- das três casas para baixo sem motivo.
--
-- A UNIDADE É CONFERIDA, não ignorada. Casar por código com unidade diferente
-- é exatamente o que a rota recusa (UNIDADE_DIVERGENTE, ver
-- src/lib/resolucao-produto-compra.ts): preço de caixa não pode virar preço de
-- quilo. O CASE abaixo espelha o SINONIMO_UNIDADE de lá.
--
-- Idempotente: só toca em linha com produtoId nulo.

-- ---------------------------------------------------------------------------
-- 1) CONFERIR ANTES. Quantas linhas seriam religadas, e para quais produtos.
--    Espere ~382 linhas. Olhe se algum nome parece fora de lugar.
-- ---------------------------------------------------------------------------
WITH un AS (
  SELECT i.id,
         i."produtoId",
         i."codigoBruto",
         i."nomeBruto",
         CASE upper(trim(i."unidadeBruta"))
           WHEN 'UN' THEN 'UND' WHEN 'UNIDADE' THEN 'UND' WHEN 'UNI' THEN 'UND'
           WHEN 'UNID' THEN 'UND' WHEN 'PC' THEN 'UND' WHEN 'GF' THEN 'UND'
           WHEN 'FT' THEN 'UND' WHEN 'BBL' THEN 'UND' WHEN 'RL' THEN 'UND'
           WHEN 'BOB' THEN 'UND' WHEN 'PR' THEN 'UND'
           WHEN 'FD' THEN 'CX' WHEN 'LA' THEN 'CX' WHEN 'BD' THEN 'CX'
           WHEN 'BB' THEN 'CX' WHEN 'BG' THEN 'CX' WHEN 'GA' THEN 'CX'
           WHEN 'PT' THEN 'CX' WHEN 'L' THEN 'LT'
           ELSE upper(trim(i."unidadeBruta"))
         END AS unidade_norm
  FROM "ItemNotaCompra" i
  WHERE i."produtoId" IS NULL AND i."codigoBruto" IS NOT NULL
)
SELECT p.nome, p."unidadeMedida", p."codigoTeknisa",
       count(*) AS linhas_a_religar
FROM un
JOIN "Produto" p ON p."codigoTeknisa" = un."codigoBruto"
                AND p."unidadeMedida" = un.unidade_norm
GROUP BY p.nome, p."unidadeMedida", p."codigoTeknisa"
ORDER BY count(*) DESC;

-- ---------------------------------------------------------------------------
-- 2) RELIGAR.
-- ---------------------------------------------------------------------------
UPDATE "ItemNotaCompra" i SET "produtoId" = p.id
FROM "Produto" p
WHERE i."produtoId" IS NULL
  AND i."codigoBruto" = p."codigoTeknisa"
  AND p."unidadeMedida" = CASE upper(trim(i."unidadeBruta"))
        WHEN 'UN' THEN 'UND' WHEN 'UNIDADE' THEN 'UND' WHEN 'UNI' THEN 'UND'
        WHEN 'UNID' THEN 'UND' WHEN 'PC' THEN 'UND' WHEN 'GF' THEN 'UND'
        WHEN 'FT' THEN 'UND' WHEN 'BBL' THEN 'UND' WHEN 'RL' THEN 'UND'
        WHEN 'BOB' THEN 'UND' WHEN 'PR' THEN 'UND'
        WHEN 'FD' THEN 'CX' WHEN 'LA' THEN 'CX' WHEN 'BD' THEN 'CX'
        WHEN 'BB' THEN 'CX' WHEN 'BG' THEN 'CX' WHEN 'GA' THEN 'CX'
        WHEN 'PT' THEN 'CX' WHEN 'L' THEN 'LT'
        ELSE upper(trim(i."unidadeBruta"))
      END;

-- ---------------------------------------------------------------------------
-- 3) VERIFICAR. O reconhecimento das três casas depois do religamento.
-- ---------------------------------------------------------------------------
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
