-- Produtos cujo código casa com a compra mas cuja UNIDADE não bate. SÓ LEITURA.
--
-- O QUE SÃO. A linha traz o código do Teknisa, o código existe no cadastro —
-- e a unidade é outra. ABACAXI comprado por UN contra cadastro em KG; MOLHO
-- INGLES comprado em LT contra cadastro em KG. O resolvedor recusa de
-- propósito (UNIDADE_DIVERGENTE, ver src/lib/resolucao-produto-compra.ts):
-- gravar R$ 12,99 de um abacaxi como R$ 12,99 o quilo multiplicaria o custo de
-- toda ficha que usa abacaxi, e o erro teria cara de preço.
--
-- O CUSTO DE DEIXAR ASSIM. Enquanto não se decide, esses produtos ficam com
-- preço CONGELADO: nenhuma nota atualiza, e o custo da ficha envelhece sem
-- ninguém ver. `valor_travado` é quanto de compra está parado nessa fila.
--
-- SÃO DOIS PROBLEMAS DIFERENTES, e só um é meu:
--
--   cadastro errado — líquido cadastrado em KG (MOLHO INGLES, MOSTARDA DIJON,
--     MEL DE ABELHA). A compra em LT está certa e o cadastro é que mente.
--     Conserto: trocar a unidade do produto, com UPDATE. Sem conversão, porque
--     não há o que converter: é a mesma coisa com o rótulo errado.
--
--   maço contra quilo — ALECRIM, SALSA, CEBOLINHA, HORTELÃ, ABACAXI. A compra
--     é por unidade e a ficha usa em quilo. Aqui FALTA UM DADO que não está em
--     lugar nenhum do sistema: quanto pesa o maço. É pergunta pra cozinha, e
--     inventar um número aqui seria pior do que deixar travado.

SELECT p.nome                                        AS produto,
       p."unidadeMedida"                             AS unidade_no_cadastro,
       i."unidadeBruta"                              AS unidade_na_compra,
       count(*)                                      AS linhas_recusadas,
       round(max(i."precoUnitNovo")::numeric, 4)     AS preco_na_compra,
       round(max(pa.preco)::numeric, 4)              AS preco_no_cadastro,
       round(sum(i."valorTotal")::numeric, 2)        AS valor_travado,
       string_agg(DISTINCT un.nome, ' + ')           AS casas
FROM "ItemNotaCompra" i
JOIN "NotaCompra" n  ON n.id = i."notaCompraId"
JOIN "Unidade" un    ON un.id = n."unidadeId"
JOIN "Produto" p     ON p."codigoTeknisa" = i."codigoBruto"
LEFT JOIN "PrecoAtualProduto" pa
       ON pa."produtoId" = p.id AND pa."unidadeId" = n."unidadeId"
WHERE i."produtoId" IS NULL
  AND i."codigoBruto" IS NOT NULL
GROUP BY p.nome, p."unidadeMedida", i."unidadeBruta"
ORDER BY sum(i."valorTotal") DESC NULLS LAST;
