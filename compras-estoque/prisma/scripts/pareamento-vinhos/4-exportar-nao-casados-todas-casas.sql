-- Códigos do Teknisa sem produto, de TODAS as casas, agrupados por código.
--
-- POR QUE TODAS AS CASAS E NÃO SÓ O WINE GARDEN. `Produto.codigoTeknisa` é
-- único e GLOBAL — não existe código por casa. O mesmo código que falta no
-- Wine Garden é o que falta no 104 Sul e no Noroeste, e parear uma vez
-- conserta as três. Fazer casa a casa seria decidir a mesma coisa três vezes.
--
-- A coluna `casas` mostra quem compra aquele item: é o que separa insumo do
-- grupo inteiro de coisa de uma casa só.
--
-- Rode DEPOIS da rodada de vinhos ter sido aplicada — senão os 84 produtos
-- criados lá aparecem aqui como se ainda faltassem.
--
-- Exporte como CSV e guarde como `nao-casados-geral.csv`.

SELECT i."codigoBruto"                                   AS codigo_teknisa,
       max(i."nomeBruto")                                AS nome_no_teknisa,
       max(i."unidadeBruta")                             AS unidade,
       count(*)                                          AS linhas,
       round(sum(i."valorTotal")::numeric, 2)            AS valor_comprado,
       round(sum(i.quantidade)::numeric, 3)              AS quantidade,
       round((sum(i."valorTotal") / nullif(sum(i.quantidade), 0))::numeric, 2) AS preco_unitario,
       string_agg(DISTINCT u.nome, ' + ' ORDER BY u.nome) AS casas,
       min(i."dataCompra")::date                         AS primeira_compra,
       max(i."dataCompra")::date                         AS ultima_compra
FROM "ItemNotaCompra" i
JOIN "NotaCompra" n ON n.id = i."notaCompraId"
JOIN "Unidade"    u ON u.id = n."unidadeId"
WHERE i."produtoId" IS NULL
  AND i."codigoBruto" IS NOT NULL
GROUP BY i."codigoBruto"
ORDER BY sum(i."valorTotal") DESC NULLS LAST;
