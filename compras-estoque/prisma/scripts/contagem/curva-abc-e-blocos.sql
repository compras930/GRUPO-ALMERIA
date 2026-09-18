-- Curva ABC de INSUMO por casa, e a divisão da curva A em quatro blocos de
-- contagem. SÓ LEITURA.
--
-- DE ONDE VEM O NÚMERO. Curva A é consumo em reais, e a melhor medida de
-- consumo que existe hoje é a compra: `valorTotal` somado por produto, das
-- notas do Teknisa. Não é perfeito (compra de um mês não é consumo do mês
-- quando alguém estoca), mas é o que existe antes da primeira contagem — e,
-- depois dela, a própria contagem corrige.
--
-- POR QUE A REGRA DE 80%. Convenção de Pareto: os produtos que somam os
-- primeiros 80% do valor são A, até 95% são B, o resto é C. No dado real do
-- Grupo isso costuma dar algumas dezenas de itens A contra centenas de C — e é
-- por isso que contar tudo toda semana nunca ia acontecer.
--
-- POR QUE O BLOCO É ALTERNADO, e não "os 25% maiores no bloco 1". Se o bloco 1
-- levasse os itens mais caros, a primeira semana valeria muito mais que as
-- outras três e a rotação ficaria torta. Alternando 1-2-3-4-1-2-3-4 pela ordem
-- de valor, cada bloco recebe uma fatia parecida do dinheiro e do trabalho, e
-- qualquer semana que se conte já vale a pena.
--
-- Trocar '104 Sul' pelo nome da casa. O estoque é da DESPENSA: pra Matri, use
-- Noroeste.

-- ---------------------------------------------------------------------------
-- 1) O tamanho de cada classe. Rode primeiro: é o que diz se o bloco semanal
--    vai ter 10 ou 60 itens pra contar.
-- ---------------------------------------------------------------------------
WITH consumo AS (
  SELECT i."produtoId", sum(i."valorTotal") AS valor
  FROM "ItemNotaCompra" i
  JOIN "NotaCompra" n  ON n.id = i."notaCompraId"
  JOIN "Unidade" un    ON un.id = n."unidadeId"
  WHERE un.nome = '104 Sul'
    AND i."produtoId" IS NOT NULL
    AND i."valorTotal" IS NOT NULL
  GROUP BY i."produtoId"
),
acumulado AS (
  SELECT "produtoId", valor,
         sum(valor) OVER (ORDER BY valor DESC, "produtoId") / NULLIF(sum(valor) OVER (), 0) AS ate_aqui
  FROM consumo
)
SELECT CASE WHEN ate_aqui <= 0.80 THEN 'A' WHEN ate_aqui <= 0.95 THEN 'B' ELSE 'C' END AS classe,
       count(*)                                   AS produtos,
       round(sum(valor)::numeric, 2)              AS valor,
       round((100 * sum(valor) / sum(sum(valor)) OVER ())::numeric, 1) AS pct_do_valor
FROM acumulado
GROUP BY 1
ORDER BY 1;

-- ---------------------------------------------------------------------------
-- 2) A curva A com o bloco de cada item. É a lista que vai pra contagem —
--    baixe como CSV e separe por `bloco`.
-- ---------------------------------------------------------------------------
WITH consumo AS (
  SELECT i."produtoId", sum(i."valorTotal") AS valor, sum(i.quantidade) AS quantidade
  FROM "ItemNotaCompra" i
  JOIN "NotaCompra" n  ON n.id = i."notaCompraId"
  JOIN "Unidade" un    ON un.id = n."unidadeId"
  WHERE un.nome = '104 Sul'
    AND i."produtoId" IS NOT NULL
    AND i."valorTotal" IS NOT NULL
  GROUP BY i."produtoId"
),
acumulado AS (
  SELECT "produtoId", valor, quantidade,
         row_number() OVER (ORDER BY valor DESC, "produtoId") AS posicao,
         sum(valor) OVER (ORDER BY valor DESC, "produtoId") / NULLIF(sum(valor) OVER (), 0) AS ate_aqui
  FROM consumo
)
SELECT ((a.posicao - 1) % 4) + 1                       AS bloco,
       a.posicao,
       p.nome                                          AS produto,
       p."unidadeMedida"                               AS unidade,
       round(a.valor::numeric, 2)                      AS valor_comprado,
       round(a.quantidade::numeric, 3)                 AS quantidade_comprada,
       round((100 * a.ate_aqui)::numeric, 1)           AS acumulado_pct,
       round(COALESCE(s.quantidade, 0)::numeric, 3)    AS saldo_hoje
FROM acumulado a
JOIN "Produto" p ON p.id = a."produtoId"
LEFT JOIN "EstoqueSaldo" s
       ON s."produtoId" = a."produtoId"
      AND s."unidadeId" = (SELECT COALESCE(u."estoqueEmId", u.id) FROM "Unidade" u WHERE u.nome = '104 Sul')
WHERE a.ate_aqui <= 0.80
ORDER BY bloco, a.valor DESC;
