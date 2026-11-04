-- Os seis temperos que entram no CMV teórico a custo ZERO.
--
-- Zero não é "não sei": é "de graça". Um tempero a custo zero desinfla, em
-- silêncio, toda ficha que o usa — e desinflar custo é o erro perigoso, porque
-- faz o prato parecer mais lucrativo do que é.
--
-- ANTES DE COPIAR PREÇO DE OUTRA CASA, a suspeita mais provável: a casa compra
-- a mesma coisa com OUTRO NOME. "PIMENTA DO REINO PRETA EM PÓ" na ficha e
-- "PIMENTA DO REINO PRETA EM GRÃOS KG" na nota — a cozinha mói. Se for isso, o
-- conserto é apontar a ficha para o produto que a casa compra de verdade, não
-- inventar um preço: um produto a mais no catálogo é um fantasma a mais, e
-- fantasma é o que este projeto mais paga para evitar.
--
-- Só LÊ.

-- =====================================================================
-- 1. OS SEIS, e o preço deles em CADA casa.
--    Se algum tiver preço em outra casa, esse preço é um ponto de partida
--    defensável — é compra real, não palpite.
-- =====================================================================
SELECT '1. os seis' AS parte,
       p.nome AS produto, p."unidadeMedida", p.categoria,
       u.nome AS casa,
       round(pa.preco::numeric, 2) AS preco,
       pa."dataCompra"::date AS da_compra_de
FROM "Produto" p
LEFT JOIN "PrecoAtualProduto" pa ON pa."produtoId" = p.id
LEFT JOIN "Unidade" u ON u.id = pa."unidadeId"
WHERE lower(btrim(p.nome)) IN (
  'pimenta do reino preta em pó', 'pimenta siria em po', 'cebola em pó',
  'alho em pó', 'pimenta da jamaica', 'cominho em pó', 'agua coccão'
)
ORDER BY produto, casa;

-- =====================================================================
-- 2. O PARENTE QUE TEM PREÇO: todo produto do catálogo cujo nome começa pela
--    mesma palavra, com o preço em cada casa.
--
--    É aqui que aparece o "em grãos" que a casa compra e o "em pó" que a ficha
--    pede. Olhe a UNIDADE também: grão em KG e pó em KG trocam direto; pó em
--    UND (potinho) contra grão em KG não troca sem saber quanto pesa o pote.
-- =====================================================================
SELECT '2. parentes' AS parte,
       p.nome AS produto, p."unidadeMedida",
       u.nome AS casa,
       round(pa.preco::numeric, 2) AS preco,
       pa."dataCompra"::date AS da_compra_de
FROM "Produto" p
LEFT JOIN "PrecoAtualProduto" pa ON pa."produtoId" = p.id
LEFT JOIN "Unidade" u ON u.id = pa."unidadeId"
WHERE lower(btrim(p.nome)) LIKE 'pimenta%'
   OR lower(btrim(p.nome)) LIKE 'cebola%'
   OR lower(btrim(p.nome)) LIKE 'alho%'
   OR lower(btrim(p.nome)) LIKE 'cominho%'
ORDER BY produto, casa;

-- =====================================================================
-- 3. QUANTO ISSO PESA: as fichas do Beira Lago que usam os seis.
--
--    Um tempero sem preço numa ficha que vende dois pratos por mês não vale
--    uma hora de trabalho; o mesmo tempero no prato mais vendido da casa, vale.
-- =====================================================================
SELECT '3. fichas afetadas' AS parte,
       p.nome AS tempero,
       r.nome AS ficha,
       round(i.quantidade::numeric, 4) AS quantidade
FROM "IngredienteReceita" i
JOIN "Produto" p ON p.id = i."produtoId"
JOIN "Receita" r ON r.id = i."receitaId"
JOIN "Unidade" u ON u.id = r."unidadeId"
WHERE u.nome = 'Beira Lago'
  AND lower(btrim(p.nome)) IN (
    'pimenta do reino preta em pó', 'pimenta siria em po', 'cebola em pó',
    'alho em pó', 'pimenta da jamaica', 'cominho em pó'
  )
ORDER BY tempero, ficha;

-- =====================================================================
-- 4. QUANTOS OUTROS ESTÃO NA MESMA SITUAÇÃO.
--
--    Os seis apareceram porque entraram na lista de compra desta semana. O
--    número abaixo diz se são seis ou sessenta — e, se forem sessenta, o
--    conserto não é um a um.
-- =====================================================================
SELECT '4. todos sem preco' AS parte,
       count(DISTINCT p.id) AS insumos_de_ficha_sem_preco
FROM "IngredienteReceita" i
JOIN "Produto" p ON p.id = i."produtoId"
JOIN "Receita" r ON r.id = i."receitaId"
JOIN "Unidade" u ON u.id = r."unidadeId"
WHERE u.nome = 'Beira Lago'
  AND NOT EXISTS (
    SELECT 1 FROM "PrecoAtualProduto" pa
    WHERE pa."produtoId" = p.id
  );
