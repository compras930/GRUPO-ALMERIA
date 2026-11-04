-- Dá ao Beira Lago o preço dos temperos que as outras casas compraram.
--
-- O QUE A CONSULTA 35 MOSTROU: quatro dos seis temperos têm preço em outras
-- casas, todos da MESMA compra de 27/08 — mesmo produto, mesmo fornecedor,
-- mesmo dia. Não é nome errado; o Beira Lago é que não comprou esses itens
-- desde agosto.
--
-- POR QUE COPIAR É HONESTO AQUI. Preço de produto é por casa porque casa
-- diferente negocia diferente. Mas "não sei" virou ZERO, e zero não é a
-- ausência do número: é a afirmação de que o tempero é de graça — que desinfla,
-- calada, toda ficha que o usa. Entre um preço de compra real do grupo e zero,
-- o preço real erra menos, e erra para o lado seguro.
--
-- QUAL PREÇO, QUANDO AS CASAS DIVERGEM. A compra mais RECENTE; empatou, o
-- MAIOR. Alho em pó está R$ 23,00 em duas casas e R$ 22,98 na terceira — a
-- diferença é de dois centavos e não vale regra elaborada, mas a regra existe
-- e é escolhida de propósito: subestimar custo é o erro perigoso, porque faz o
-- prato parecer mais lucrativo do que é.
--
-- NÃO MEXE EM QUEM JÁ TEM PREÇO. Se o Beira Lago comprar o tempero amanhã, a
-- nota sobrescreve isto — que é como deve ser: nota de verdade manda mais que
-- preço emprestado.
--
-- FICAM DE FORA, porque ninguém no grupo comprou: COMINHO EM PÓ e PIMENTA DA
-- JAMAICA. Para esses não há o que copiar, e inventar um preço de mercado
-- seria exatamente o palpite que este arquivo evita. Peça a última nota ao
-- setor de compras.

-- =====================================================================
-- PASSO 1 — QUANTO ISSO PESA, antes de mexer. Só lê.
--
-- Um tempero sem preço numa ficha que vende dois pratos por mês não muda
-- CMV nenhum. Rode isto antes do passo 2 e veja se o conserto importa.
-- =====================================================================
SELECT p.nome AS tempero,
       count(DISTINCT r.id) AS fichas_que_usam,
       round(sum(i.quantidade)::numeric, 4) AS quantidade_somada_nas_fichas
FROM "IngredienteReceita" i
JOIN "Produto" p ON p.id = i."produtoId"
JOIN "Receita" r ON r.id = i."receitaId"
JOIN "Unidade" u ON u.id = r."unidadeId"
WHERE u.nome = 'Beira Lago'
  AND lower(btrim(p.nome)) IN (
    'pimenta do reino preta em pó', 'pimenta siria em po', 'cebola em pó',
    'alho em pó', 'pimenta da jamaica', 'cominho em pó'
  )
GROUP BY p.nome
ORDER BY fichas_que_usam DESC;

-- =====================================================================
-- PASSO 2 — COPIA O PREÇO. Um comando só.
--
-- Rodar duas vezes não duplica nem sobrescreve: o NOT EXISTS pula quem já
-- tem preço na casa.
-- =====================================================================
INSERT INTO "PrecoAtualProduto" (id, "unidadeId", "produtoId", preco, "dataCompra", "atualizadoEm")
SELECT gen_random_uuid()::text, bl.id, v."produtoId", v.preco, v."dataCompra", now()
FROM (
  SELECT DISTINCT ON (pa."produtoId")
         pa."produtoId", pa.preco, pa."dataCompra"
  FROM "PrecoAtualProduto" pa
  JOIN "Produto" p ON p.id = pa."produtoId"
  WHERE lower(btrim(p.nome)) IN (
    'pimenta do reino preta em pó', 'pimenta siria em po', 'cebola em pó', 'alho em pó'
  )
  -- A compra mais recente primeiro; empate resolvido pelo maior preço.
  ORDER BY pa."produtoId", pa."dataCompra" DESC, pa.preco DESC
) v
CROSS JOIN "Unidade" bl
WHERE bl.nome = 'Beira Lago'
  AND NOT EXISTS (
    SELECT 1 FROM "PrecoAtualProduto" x
    WHERE x."unidadeId" = bl.id AND x."produtoId" = v."produtoId"
  );

-- =====================================================================
-- PASSO 3 — CONFERÊNCIA. Esperado: as quatro linhas do Beira Lago com
-- preço, e COMINHO/JAMAICA ainda sem — eles são a pergunta para o setor
-- de compras, não um erro deste arquivo.
-- =====================================================================
SELECT p.nome AS tempero,
       u.nome AS casa,
       round(pa.preco::numeric, 2) AS preco,
       pa."dataCompra"::date AS da_compra_de
FROM "Produto" p
LEFT JOIN "PrecoAtualProduto" pa ON pa."produtoId" = p.id
LEFT JOIN "Unidade" u ON u.id = pa."unidadeId"
WHERE lower(btrim(p.nome)) IN (
  'pimenta do reino preta em pó', 'pimenta siria em po', 'cebola em pó',
  'alho em pó', 'pimenta da jamaica', 'cominho em pó'
)
ORDER BY tempero, casa;
