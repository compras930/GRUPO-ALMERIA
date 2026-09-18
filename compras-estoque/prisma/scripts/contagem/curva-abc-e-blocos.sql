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
-- A ROTAÇÃO. Decidido em 18/09/2026: curva A em DOIS grupos e curva B em
-- QUATRO. A semana conta um grupo de cada — 45 itens —, então cada item da
-- curva A é contado de quinze em quinze dias e cada item da B, uma vez por mês.
--
-- Frequência segue valor, que é a razão de existir a curva. A não pode esperar
-- um mês: são 55 itens que valem 80% do dinheiro, e doze deles são proteína,
-- que é onde some. Contar de duas em duas semanas dá 26 medições por ano em
-- vez de 12 — a diferença entre achar um desvio enquanto ele acontece e achar
-- trinta dias depois, quando ninguém lembra o que houve.
--
-- Dentro de cada classe o grupo é ALTERNADO pela ordem de valor (1-2-1-2 na A,
-- 1-2-3-4 na B), não "os maiores no grupo 1". Se o primeiro grupo levasse os
-- itens mais caros, a primeira semana valeria muito mais que as outras e a
-- rotação ficaria torta.
--
-- Trocar '104 Sul' pelo nome da casa. O estoque é da DESPENSA: pra Matri, use
-- Noroeste.
--
-- SÓ INSUMO. Decidido pelo setor de compras em 18/09/2026: a curva A de
-- contagem cobre insumo de cozinha e de bar. Fica de fora:
--
--   embalagem e descartável — pote, tampa, saco, guardanapo, filme. Eram 16
--     dos 76 itens da primeira versão, R$ 27,7 mil. É estoque de verdade e
--     vale contar um dia, mas não entra em ficha nem em CMV;
--   limpeza — detergente, álcool, pastilha de forno;
-- BEBIDA PRONTA FICA. Refrigerante, água, cerveja e vinho não viram prato,
-- mas são estoque que some — e sumir bebida é caro. Entram na contagem; o que
-- não entra é o CMV de cozinha, onde continuam separadas como revenda.
--
-- Comida de funcionário também fica: é consumo real, só não é CMV de venda.
--
-- A exclusão é por nome, e nome erra. Ela mora aqui, visível, em vez de
-- escondida numa planilha que ninguém acha depois.

-- ---------------------------------------------------------------------------
-- 1) O tamanho de cada classe. Rode primeiro: é o que diz se o bloco semanal
--    vai ter 10 ou 60 itens pra contar.
-- ---------------------------------------------------------------------------
WITH consumo AS (
  SELECT i."produtoId", sum(i."valorTotal") AS valor
  FROM "ItemNotaCompra" i
  JOIN "NotaCompra" n  ON n.id = i."notaCompraId"
  JOIN "Unidade" un    ON un.id = n."unidadeId"
  JOIN "Produto" p     ON p.id = i."produtoId"
  WHERE un.nome = '104 Sul'
    AND i."produtoId" IS NOT NULL
    AND i."valorTotal" IS NOT NULL
    AND p.nome !~* '(TAMPA|SACO |SACOLA|EMBALAGEM|POTE |GUARDANAPO|PAPEL TOALHA|PAPEL HIGIENICO|PANO MULTIUSO|PLASTICO FILME|BOBINA|DISCO ISOPOR|CANUDO|BB PIC|DIVISORIA|KIT GARFO|BANDEJA|GARRAFA TRANSP|ETIQUETA|PERSONALIZA)'
    AND p.nome !~* '(DETERGENTE|DESINFETANTE|ALCOOL|SANITARIA|SACTIF|SUMA |MAX DET|SECANTE|PASTILHA RATIONAL|LUVA |TOUCA|AVENTAL|VASSOURA|RODO |ESPONJA|PULVERIZADOR|HIGIENIZADOR|SABONETE|ENXAGUANTE|FIO DENTAL|CABO MADEIRA|PA PARA LIXO)'
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
-- 2) Curvas A e B com o grupo de rotação de cada item. É a lista que vai pra
--    contagem — baixe como CSV.
-- ---------------------------------------------------------------------------
WITH consumo AS (
  SELECT i."produtoId", sum(i."valorTotal") AS valor, sum(i.quantidade) AS quantidade
  FROM "ItemNotaCompra" i
  JOIN "NotaCompra" n  ON n.id = i."notaCompraId"
  JOIN "Unidade" un    ON un.id = n."unidadeId"
  JOIN "Produto" p     ON p.id = i."produtoId"
  WHERE un.nome = '104 Sul'
    AND i."produtoId" IS NOT NULL
    AND i."valorTotal" IS NOT NULL
    AND p.nome !~* '(TAMPA|SACO |SACOLA|EMBALAGEM|POTE |GUARDANAPO|PAPEL TOALHA|PAPEL HIGIENICO|PANO MULTIUSO|PLASTICO FILME|BOBINA|DISCO ISOPOR|CANUDO|BB PIC|DIVISORIA|KIT GARFO|BANDEJA|GARRAFA TRANSP|ETIQUETA|PERSONALIZA)'
    AND p.nome !~* '(DETERGENTE|DESINFETANTE|ALCOOL|SANITARIA|SACTIF|SUMA |MAX DET|SECANTE|PASTILHA RATIONAL|LUVA |TOUCA|AVENTAL|VASSOURA|RODO |ESPONJA|PULVERIZADOR|HIGIENIZADOR|SABONETE|ENXAGUANTE|FIO DENTAL|CABO MADEIRA|PA PARA LIXO)'
  GROUP BY i."produtoId"
),
acumulado AS (
  SELECT "produtoId", valor, quantidade,
         sum(valor) OVER (ORDER BY valor DESC, "produtoId") / NULLIF(sum(valor) OVER (), 0) AS ate_aqui
  FROM consumo
),
classificado AS (
  SELECT *, CASE WHEN ate_aqui <= 0.80 THEN 'A' WHEN ate_aqui <= 0.95 THEN 'B' ELSE 'C' END AS classe
  FROM acumulado
),
numerado AS (
  SELECT *, row_number() OVER (PARTITION BY classe ORDER BY valor DESC, "produtoId") AS pos_na_classe
  FROM classificado
)
SELECT n.classe,
       CASE n.classe WHEN 'A' THEN ((n.pos_na_classe - 1) % 2) + 1
                     WHEN 'B' THEN ((n.pos_na_classe - 1) % 4) + 1 END AS grupo,
       p.nome                                          AS produto,
       p."unidadeMedida"                               AS unidade,
       round(n.valor::numeric, 2)                      AS valor_comprado,
       round(n.quantidade::numeric, 3)                 AS quantidade_comprada,
       round(COALESCE(s.quantidade, 0)::numeric, 3)    AS saldo_hoje
FROM numerado n
JOIN "Produto" p ON p.id = n."produtoId"
LEFT JOIN "EstoqueSaldo" s
       ON s."produtoId" = n."produtoId"
      AND s."unidadeId" = (SELECT COALESCE(u."estoqueEmId", u.id) FROM "Unidade" u WHERE u.nome = '104 Sul')
WHERE n.classe IN ('A', 'B')
ORDER BY n.classe, grupo, n.valor DESC;
