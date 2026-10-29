-- Conferência geral: o estado do app antes do fechamento de outubro.
--
-- Seis perguntas, só leitura. Cada uma tem um "esperado" escrito ao lado — é
-- para olhar o esperado, não só o número.
--
-- O fechamento de outubro depende de três coisas estarem no lugar: a compra
-- carregada até 31/10, a venda carregada até 31/10, e DUAS contagens por
-- produto com a segunda na virada do mês. Falta qualquer uma e o CMV contado
-- não existe — ou pior, existe errado.

-- =====================================================================
-- 1. COMPRA: até que dia cada casa chegou.
--    ESPERADO: todas no dia de ontem ou de hoje. Casa parada dias atrás é
--    carga que não rodou.
-- =====================================================================
SELECT '1. compra' AS conferencia,
       u.nome AS casa,
       max(i."dataCompra")::date AS ultimo_dia_de_nota,
       (CURRENT_DATE - max(i."dataCompra")::date) AS dias_atras,
       count(*) FILTER (WHERE i."dataCompra" >= DATE '2026-10-01') AS linhas_de_outubro
FROM "ItemNotaCompra" i
JOIN "NotaCompra" n ON n.id = i."notaCompraId"
JOIN "Unidade" u ON u.id = n."unidadeId"
GROUP BY u.nome
ORDER BY dias_atras DESC;

-- =====================================================================
-- 2. VENDA: até que semana cada casa chegou.
--    ESPERADO: Beira Lago com semana terminando em 25/10 ou depois. As
--    outras casas ainda não têm venda carregada — isso é esperado hoje.
-- =====================================================================
SELECT '2. venda' AS conferencia,
       u.nome AS casa,
       max(vs."periodoFim")::date AS ultima_semana_ate,
       count(DISTINCT vs.id) AS semanas,
       round(sum(ivs."valorVendido")::numeric, 2) AS valor_total
FROM "VendaSemanal" vs
JOIN "Unidade" u ON u.id = vs."unidadeId"
LEFT JOIN "ItemVendaSemanal" ivs ON ivs."vendaSemanalId" = vs.id
GROUP BY u.nome
ORDER BY casa;

-- =====================================================================
-- 3. CONTAGENS: quantas, quando, e quantos produtos em cada uma.
--    ESPERADO: uma linha por dia de contagem. A de hoje tem que aparecer.
-- =====================================================================
SELECT '3. contagens' AS conferencia,
       u.nome AS casa,
       c."criadoEm"::date AS dia,
       count(*) AS produtos_contados,
       count(*) FILTER (WHERE c."quantidadeContada" = 0) AS contados_zerados
FROM "ContagemEstoque" c
JOIN "Unidade" u ON u.id = c."unidadeId"
GROUP BY u.nome, c."criadoEm"::date
ORDER BY dia DESC, casa;

-- =====================================================================
-- 4. O QUE A CONFERÊNCIA DA CONTAGEM VAI TER PARA MOSTRAR.
--    Ela só mostra produto contado DUAS vezes — uma contagem é marco zero,
--    não período fechado.
--    ESPERADO: `com_duas_ou_mais` perto do total de itens da curva A (112).
-- =====================================================================
SELECT '4. conciliacao' AS conferencia,
       u.nome AS casa,
       count(DISTINCT c."produtoId") AS produtos_ja_contados,
       count(DISTINCT c."produtoId") FILTER (WHERE c.n >= 2) AS com_duas_ou_mais
FROM (
  SELECT "unidadeId", "produtoId", count(*) AS n
  FROM "ContagemEstoque" GROUP BY 1, 2
) c
JOIN "Unidade" u ON u.id = c."unidadeId"
GROUP BY u.nome
ORDER BY casa;

-- =====================================================================
-- 5. SALDO NEGATIVO: o sintoma mais barato de ver.
--    Saldo abaixo de zero quer dizer que saiu mais do que entrou — venda com
--    ficha consumindo um insumo cuja compra não foi carregada, ou conversão
--    de unidade errada.
--    ESPERADO: zero, ou poucos e pequenos.
-- =====================================================================
SELECT '5. saldo negativo' AS conferencia,
       u.nome AS casa, p.nome AS produto, p."unidadeMedida",
       round(s.quantidade::numeric, 3) AS saldo
FROM "EstoqueSaldo" s
JOIN "Produto" p ON p.id = s."produtoId"
JOIN "Unidade" u ON u.id = s."unidadeId"
WHERE s.quantidade < -0.001
ORDER BY s.quantidade ASC
LIMIT 20;

-- =====================================================================
-- 6. CURVA A SEM PREÇO: item que vai ser contado e não tem quanto vale.
--    Ele entra na contagem e sai da conferência, porque diferença sem preço
--    não vira reais — some do relatório sem avisar.
--    ESPERADO: zero.
-- =====================================================================
SELECT '6. curva A sem preco' AS conferencia,
       u.nome AS casa, p.nome AS produto, p."unidadeMedida"
FROM "ParametroEstoqueProduto" par
JOIN "Produto" p ON p.id = par."produtoId"
JOIN "Unidade" u ON u.id = par."unidadeId"
WHERE par."classeAbc" = 'A'
  AND NOT EXISTS (
    SELECT 1 FROM "PrecoAtualProduto" pa
    WHERE pa."produtoId" = par."produtoId" AND pa."unidadeId" = par."unidadeId"
  )
ORDER BY casa, produto;
