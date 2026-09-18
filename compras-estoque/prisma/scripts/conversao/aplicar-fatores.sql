-- Fatores de conversão entre embalagem de compra e unidade do produto.
-- Respondidos pelo setor de compras em 18/09/2026 e conferidos contra o preço.
--
-- SEIS RESPOSTAS FORAM CORRIGIDAS NA CONFERÊNCIA. Cinco vinham com fator 1 e
-- produziriam preço 10x menor — salsa a R$ 2,50 o quilo em vez de R$ 26,80, o
-- que deixaria toda ficha com salsa barata demais. A razão entre o preço da
-- nota e o preço cadastrado reconstrói o que faltava: 0,09 é o maço de salsa,
-- 25 são os pães de queijo por quilo. Não é adivinhação — é a única leitura em
-- que os dois números fecham.
--
-- O AZEITE mudou de unidade. A própria observação dizia que a medida devia ser
-- em litro, e com fator 1 em KG entraria R$ 135,26 o quilo, que é o preço da
-- garrafa de 3 litros.
--
-- O IOGURTE é o caso invertido: o fator 0,17 está certo (pote de 170 g) e o
-- preço cadastrado de R$ 3,60 o quilo é que é impossível. Corrigido no passo 3,
-- porque a trava de salto recusaria a correção justamente por ser grande.
--
-- Idempotente. Rode os três passos juntos.

-- ---------------------------------------------------------------------------
-- 1) Azeite passa a LT, pra que o fator 3 signifique 3 litros.
--
-- As fichas que usam azeite tinham a quantidade em KG e passam a lê-la em LT.
-- Com densidade 0,91 o custo dessas linhas cai ~9% — e fica mais certo do que
-- estava, porque o que entrava antes era o preço da garrafa inteira.
-- ---------------------------------------------------------------------------
UPDATE "Produto" SET "unidadeMedida" = 'LT'
WHERE nome = 'AZEITE EXTRA VIRGEM' AND "unidadeMedida" = 'KG'
  AND NOT EXISTS (SELECT 1 FROM "Produto" x WHERE x.nome = 'AZEITE EXTRA VIRGEM' AND x."unidadeMedida" = 'LT');

-- ---------------------------------------------------------------------------
-- 2) Os 26 fatores.
-- ---------------------------------------------------------------------------
INSERT INTO "ConversaoUnidadeCompra" (id, "produtoId", "unidadeCompra", fator, observacao)
SELECT 'cnv' || left(md5(p.id || v.un), 22), p.id, v.un, v.fator, v.obs
FROM (VALUES
  ('COXINHA DA ASA EMPANADA DE FRANGO - FUNCIONÁRIO', 'UND', 1, '1 kg por pacote'),
  ('MICROVERDE KG', 'UND', 0.04, 'bandeja de 40 g — confirmado por compras em 18/09/2026'),
  ('OVOS GRANDE BRANCO UND', 'CX', 360, 'unidades'),
  ('TOMATE PELATI MUTTI SAN MANZARNO', 'LA', 2.5, '2,5 kg por lata'),
  ('AZEITE EXTRA VIRGEM', 'UND', 3, 'garrafa de 3 litros; cadastro passa a ser LT'),
  ('CREAM CHEESE', 'UND', 1.5, 'a bisnaga vem com 1,5 kg'),
  ('MOSTARDA DIJON', 'LT', 1, 'em kg'),
  ('CREME AVELA NUTELLA', 'BD', 3, 'bade vem com 3 kg'),
  ('Abacaxi', 'UND', 1, 'unidades compra por unidade'),
  ('MEL DE ABELHA', 'LT', 1, NULL),
  ('REQUEIJÃO CREMOSO', 'BG', 1.5, 'bisnaga de 1,5kg'),
  ('CASTANHA DE CAJU TORRADA SEM SAL', 'KG', 1, 'kg'),
  ('PÃO DE QUEIJO', 'KG', 25, '25 unidades por quilo — deduzido da razão de preço e confirmado'),
  ('FEIJAO PRETO KG CMV', 'UND', 10, 'compramos em fardos co 10 unidades de 1 kg'),
  ('RUCULA HIDROPONICA', 'UND', 1, 'kg'),
  ('ARROZ BRANCO COZIDO', 'UND', 1, 'kg'),
  ('SALSA', 'UND', 0.09, 'maço de ~90 g — deduzido da razão de preço e confirmado'),
  ('CEBOLETE', 'UND', 0.09, 'maço de ~90 g — deduzido da razão de preço e confirmado'),
  ('Fusilli', 'UND', 1, 'kg'),
  ('Milho em conserva', 'LA', 1.8, 'compra em lata de 1,8 kg'),
  ('ALECRIM', 'UND', 0.07, 'maço de ~70 g — deduzido da razão de preço e confirmado'),
  ('CEBOLINHA', 'UND', 1, 'kg'),
  ('MOLHO SHOYU FOOD 5LT', 'GA', 1, 'compramos em galão de 5LT'),
  ('Hortelã', 'UND', 0.11, 'maço de ~110 g — deduzido da razão de preço e confirmado'),
  ('IOGURTE NATURAL', 'UND', 0.17, 'compramos por unidade cada unidade 170g'),
  ('COENTRO GRAO', 'UND', 1, 'kg')
) AS v(produto, un, fator, obs)
JOIN "Produto" p ON p.nome = v.produto
ON CONFLICT ("produtoId", "unidadeCompra") DO UPDATE
  SET fator = EXCLUDED.fator, observacao = EXCLUDED.observacao;

-- ---------------------------------------------------------------------------
-- 3) Iogurte: R$ 3,90 o pote de 170 g = R$ 22,94 o quilo.
-- ---------------------------------------------------------------------------
UPDATE "PrecoAtualProduto" pa SET preco = 22.94, "dataCompra" = now()
FROM "Produto" p WHERE p.id = pa."produtoId" AND p.nome = 'IOGURTE NATURAL';

-- ---------------------------------------------------------------------------
-- VERIFICAÇÃO. Esperado: 26 conversões, azeite em LT.
-- ---------------------------------------------------------------------------
SELECT count(*) AS conversoes FROM "ConversaoUnidadeCompra";

SELECT p.nome, p."unidadeMedida" AS un_produto, c."unidadeCompra" AS un_compra, c.fator
FROM "ConversaoUnidadeCompra" c JOIN "Produto" p ON p.id = c."produtoId"
ORDER BY p.nome;
