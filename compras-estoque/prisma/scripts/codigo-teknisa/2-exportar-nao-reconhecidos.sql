-- PASSO 2 de 3 do pareamento de compra por código do Teknisa.
-- SÓ LEITURA. Rodar no SQL Editor do Neon e baixar o resultado como CSV.
--
-- O QUE ISTO É: as linhas de compra que não casaram com produto nenhum do
-- catálogo. Elas não foram descartadas — cada uma está gravada em
-- ItemNotaCompra com produtoId nulo, agora com o código e a unidade que vieram
-- do Teknisa. É essa lista que vira a planilha de pareamento manual.
--
-- POR QUE ELAS NÃO CASAM: o Teknisa usa o nome de COMPRA e o catálogo usa o
-- nome de ESTOQUE. "ALCATRA BOVINA BOMBOM (COMPRA)" e "ALCATRA BOVINO KG" são
-- o mesmo boi. Nenhuma normalização de texto resolve isso sem arriscar casar
-- coisa errada — e casar errado aqui grava preço errado em ficha.
--
-- Pareado uma vez, o código fica gravado no Produto e o nome deixa de
-- importar pra sempre.

-- ---------------------------------------------------------------------------
-- 1) O tamanho do problema, por casa. Rode primeiro pra saber o que esperar.
-- ---------------------------------------------------------------------------
WITH ultima AS (
  SELECT DISTINCT ON ("unidadeId") id, "unidadeId"
  FROM "NotaCompra"
  ORDER BY "unidadeId", "criadoEm" DESC
)
SELECT un.nome AS casa,
       count(*)                                        AS linhas_da_nota,
       count(*) FILTER (WHERE i."produtoId" IS NULL)    AS nao_reconhecidas
FROM "ItemNotaCompra" i
JOIN ultima n     ON n.id = i."notaCompraId"
JOIN "Unidade" un ON un.id = n."unidadeId"
GROUP BY un.nome
ORDER BY un.nome;

-- ---------------------------------------------------------------------------
-- 2) A lista em si. Baixe como CSV (botão de download do resultado no Neon).
--
-- Uma linha por CÓDIGO, não por casa: Produto é cadastro único do grupo, então
-- a decisão de pareamento é uma só, mesmo quando as duas casas compram o mesmo
-- insumo. `casas` diz quem compra, e `nomes_diferentes > 1` avisa quando o
-- mesmo código chega escrito de dois jeitos (vale olhar com mais atenção).
-- ---------------------------------------------------------------------------
WITH ultima AS (
  SELECT DISTINCT ON ("unidadeId") id, "unidadeId"
  FROM "NotaCompra"
  ORDER BY "unidadeId", "criadoEm" DESC
)
SELECT i."codigoBruto"                                        AS codigo_teknisa,
       min(i."nomeBruto")                                     AS nome_no_teknisa,
       count(DISTINCT i."nomeBruto")                          AS nomes_diferentes,
       min(i."unidadeBruta")                                  AS unidade,
       string_agg(DISTINCT un.nome, ' + ')                    AS casas,
       round(max(i."precoUnitNovo")::numeric, 4)              AS preco_unitario,
       max(i."dataCompra")::date                              AS compra_mais_recente
FROM "ItemNotaCompra" i
JOIN ultima n     ON n.id = i."notaCompraId"
JOIN "Unidade" un ON un.id = n."unidadeId"
WHERE i."produtoId" IS NULL
  AND i."codigoBruto" IS NOT NULL
GROUP BY i."codigoBruto"
ORDER BY min(i."nomeBruto");
