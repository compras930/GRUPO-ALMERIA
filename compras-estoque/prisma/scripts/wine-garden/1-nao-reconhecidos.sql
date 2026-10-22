-- As linhas de nota do Wine Garden que não viraram produto. SÓ LÊ.
--
-- São 679 de 2.048 — um terço da compra da casa não virou estoque nem preço.
-- Enquanto ficarem assim, o painel conta o dinheiro (ele soma a linha mesmo sem
-- produto, em "Sem categoria") mas o estoque não existe, a ficha não acha o
-- insumo, e a contagem não tem o que comparar.
--
-- O RESULTADO DESTA CONSULTA VAI PARA MIM, e eu gero o cadastro com o CÓDIGO DO
-- APP, não com SQL escrito à mão. A diferença não é estilo: a unidade precisa
-- passar por `normalizarUnidade` antes de virar cadastro — uma linha em PCT
-- vira CX, e um produto cadastrado com "PCT" cru nunca mais casa, porque o
-- casamento procura "nome|||CX". No Beira Lago isso deixou 75 linhas de fora, e
-- só apareceu rodando a carga inteira contra o catálogo recém-criado.
--
-- As colunas saem com os nomes que o gerador espera: nome, unidadeMedida,
-- valor_total.
--
-- O NOME SAI CRU, como o fornecedor escreveu. Qualquer "melhorada" na grafia
-- faz a linha deixar de casar na próxima carga e o produto volta para esta
-- lista na semana seguinte.
SELECT i."nomeBruto" AS nome,
       COALESCE(i."unidadeBruta", '') AS "unidadeMedida",
       round(sum(COALESCE(i."valorTotal", 0))::numeric, 2) AS valor_total,
       count(*) AS linhas,
       round(sum(COALESCE(i.quantidade, 0))::numeric, 3) AS quantidade,
       max(i."dataCompra")::date AS ultima_compra
FROM "ItemNotaCompra" i
JOIN "NotaCompra" n ON n.id = i."notaCompraId"
JOIN "Unidade" u ON u.id = n."unidadeId"
WHERE u.nome = 'Wine Garden'
  AND i."produtoId" IS NULL
GROUP BY i."nomeBruto", i."unidadeBruta"
ORDER BY valor_total DESC;
