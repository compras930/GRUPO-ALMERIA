-- Códigos do Teknisa que compraram no Wine Garden e não acharam produto.
--
-- Agrupado por CÓDIGO, não por linha: o código é a unidade de decisão. Parear
-- uma vez resolve todas as compras passadas e futuras daquele item.
--
-- Ordenado por valor, porque 589 decisões seguidas ninguém toma com atenção
-- até o fim. Quem parear de cima pra baixo resolve o dinheiro primeiro e pode
-- parar quando quiser.
--
-- Exporte o resultado como CSV (botão de download do Neon) e guarde como
-- `nao-casados.csv`.

SELECT i."codigoBruto"                                   AS codigo_teknisa,
       max(i."nomeBruto")                                AS nome_no_teknisa,
       max(i."unidadeBruta")                             AS unidade,
       count(*)                                          AS linhas,
       round(sum(i."valorTotal")::numeric, 2)            AS valor_comprado,
       round(sum(i.quantidade)::numeric, 3)              AS quantidade,
       -- Preço unitário médio ponderado: é ele que vai virar preço do produto.
       round((sum(i."valorTotal") / nullif(sum(i.quantidade), 0))::numeric, 2) AS preco_unitario,
       min(i."dataCompra")::date                         AS primeira_compra,
       max(i."dataCompra")::date                         AS ultima_compra
FROM "ItemNotaCompra" i
JOIN "NotaCompra" n ON n.id = i."notaCompraId"
JOIN "Unidade"    u ON u.id = n."unidadeId"
WHERE u.nome = 'Wine Garden'
  AND i."produtoId" IS NULL
GROUP BY i."codigoBruto"
ORDER BY sum(i."valorTotal") DESC NULLS LAST;
