-- As 21 linhas que sobraram do Wine Garden. Três consertos.
--
-- De 679 para 21 depois do cadastro e dos códigos alternativos. R$ 10.600 de
-- R$ 638 mil. O que restou são três casos distintos, e todos têm conserto.
--
--   9 recusadas       — GLP (4) e ÓLEO DE ALGODÃO (5): seção 1 e 2
--  12 não reconhecidas — COGUMELO (4) e 7 produtos que faltam: seção 3 e 4
--
-- Roda inteiro, de uma vez. Nenhum comando aqui duplica se rodar duas vezes.

-- =====================================================================
-- 1. O GLP (4 linhas, R$ 3.495) — unidade com duas grafias na mesma célula.
--
-- A nota diz "KG/M³" e o produto está em KG. O app recusou, e recusou CERTO:
-- preço de metro cúbico não pode virar preço de quilo, e ele não tem como
-- saber qual dos dois a célula quis dizer.
--
-- Mas o dado responde: 381 unidades por R$ 3.495 dá R$ 9,17 cada. Botijão de
-- GLP a R$ 9 o quilo é o preço de mercado; a R$ 9 o metro cúbico seria um
-- décimo do que custa. É quilo, e "KG/M³" é só o rótulo preguiçoso do Teknisa.
--
-- Entra como código alternativo com `fator = 1`: mesmo produto, mesma
-- quantidade, outra grafia de unidade. `normalizarUnidade` não mexe em
-- "KG/M³" (não é sinônimo conhecido), então a grafia tem que entrar crua,
-- exatamente como vem na nota.
INSERT INTO "CodigoCompraProduto" (id, origem, codigo, "produtoId", "unidadeCompra", fator, observacao)
SELECT gen_random_uuid()::text, 'TEKNISA', '125000000000', p.id, 'KG/M³', 1,
       'O Teknisa escreve a unidade do GLP como KG/M³; o preço por unidade (R$ 9,17) confirma que é quilo'
FROM "Produto" p
WHERE p."codigoTeknisa" = '125000000000'
  AND NOT EXISTS (
    SELECT 1 FROM "CodigoCompraProduto" c
    WHERE c.origem = 'TEKNISA' AND c.codigo = '125000000000' AND c."unidadeCompra" = 'KG/M³'
  );

-- =====================================================================
-- 2. O ÓLEO DE ALGODÃO (5 linhas, R$ 3.951) — QUATRO códigos para o mesmo item.
--
-- As notas trazem 105050007118, 7119, 7121 e 7123 — mesmo nome, mesma
-- unidade (BD, que o app normaliza para CX), mesmo balde de 14,5 litros. É o
-- caso do ALECRIM outra vez, com quatro códigos em vez de dois.
--
-- Os códigos 7121 e 7123 não estão em produto nenhum: as 5 linhas acharam o
-- produto pelo NOME e foram recusadas como CONFLITO_DE_CODIGO. A recusa
-- estava certa; o conserto é dizer que os quatro códigos são o mesmo balde.
INSERT INTO "CodigoCompraProduto" (id, origem, codigo, "produtoId", "unidadeCompra", fator, observacao)
SELECT gen_random_uuid()::text, 'TEKNISA', v.codigo, p.id, 'BD', 1,
       'Código adicional do Teknisa para o mesmo balde de óleo de algodão 14,5 LT'
FROM (VALUES ('105050007121'), ('105050007123')) AS v(codigo)
JOIN "Produto" p ON p."codigoTeknisa" = '105050007119'
WHERE NOT EXISTS (
  SELECT 1 FROM "CodigoCompraProduto" c
  WHERE c.origem = 'TEKNISA' AND c.codigo = v.codigo AND c."unidadeCompra" = 'BD'
);

-- =====================================================================
-- 3. O COGUMELO PORTO BELO (4 linhas, R$ 994) — um dígito de diferença.
--
-- O cadastro gravou o código 110020004109; as notas trazem 110020004113. Dois
-- códigos do Teknisa para o mesmo cogumelo, e o produto só podia carregar um.
--
-- A linha voltou como NÃO RECONHECIDA, não como conflito, porque o nome da
-- nota é "COGUMELO PORTO BELO KG" em KG e o produto foi cadastrado com esse
-- mesmo nome: o casamento por nome deveria ter funcionado. Se não funcionou,
-- o produto não nasceu — o INSERT do cadastro pula quem já tem o código em
-- outro produto. Os dois comandos abaixo cobrem as duas possibilidades e só
-- um deles faz efeito.

-- 3a. Se o produto existe, 110020004113 vira código adicional dele.
INSERT INTO "CodigoCompraProduto" (id, origem, codigo, "produtoId", "unidadeCompra", fator, observacao)
SELECT gen_random_uuid()::text, 'TEKNISA', '110020004113', p.id, 'KG', 1,
       'Segundo código do Teknisa para o COGUMELO PORTO BELO; o cadastro gravou 110020004109'
FROM "Produto" p
WHERE lower(btrim(p.nome)) = 'cogumelo porto belo kg'
  AND p."unidadeMedida" = 'KG'
  AND NOT EXISTS (
    SELECT 1 FROM "CodigoCompraProduto" c
    WHERE c.origem = 'TEKNISA' AND c.codigo = '110020004113' AND c."unidadeCompra" = 'KG'
  );

-- 3b. Se o produto NÃO existe, nasce agora, com o código que vem na nota.
INSERT INTO "Produto" (id, nome, "unidadeMedida", categoria, ativo, "codigoTeknisa")
SELECT gen_random_uuid()::text, 'COGUMELO PORTO BELO KG', 'KG', 'HORTIFRUTIGRANJEIRO', true, '110020004113'
WHERE NOT EXISTS (
    SELECT 1 FROM "Produto" p WHERE lower(btrim(p.nome)) = 'cogumelo porto belo kg'
  )
  AND NOT EXISTS (
    SELECT 1 FROM "Produto" p WHERE p."codigoTeknisa" = '110020004113'
  );

-- =====================================================================
-- 4. OS 7 PRODUTOS QUE FALTAM (8 linhas, R$ 1.820).
--
-- Eles ficaram de fora do 3-cadastro porque o nome não apareceu no export do
-- Teknisa que eu tinha, e sem export não havia grupo nem código. Mas a NOTA
-- traz o código, e o PREFIXO do código diz o grupo — é a mesma numeração que
-- o export usa:
--
--   100005 -> PROTEINAS            105045 -> MERCEARIA (farináceos)
--   105035 -> MERCEARIA (conserva) 105050 -> MERCEARIA (óleo)
--   105060 -> MERCEARIA (laticínio) 610005 -> GRAOS FUNCIONARIO
--
-- A UNIDADE é a canônica: FD e BD viram CX, UN vira UND. É o que
-- `normalizarUnidade` faz com a unidade da nota, e o produto tem que estar
-- gravado do mesmo lado dessa normalização — foi o erro que deixou o
-- DESINFETANTE em GA invisível.
--
-- OS DOIS "CREME DE LEITE 35%" do relatório antigo são UM produto só: as duas
-- grafias (com e sem "(COMPRA)") trazem o MESMO código 105060008549, e a nota
-- atual só usa uma delas. Nasce um produto, não dois.
INSERT INTO "Produto" (id, nome, "unidadeMedida", categoria, ativo, "codigoTeknisa")
SELECT gen_random_uuid()::text, v.nome, v.unidade, v.categoria, true, v.codigo
FROM (VALUES
  ('OLEO DE SOJA LT 20X900 (COMPRA)',               'CX',  'MERCEARIA',         '105050007124'),  -- R$ 389,79 · nota em CX
  ('CREME DE LEITE 35% - NESTILLY LT 12x1',         'CX',  'MERCEARIA',         '105060008549'),  -- R$ 597,94 · 2 linhas
  ('CAFE FUNCIONARIO',                              'UND', 'GRAOS FUNCIONARIO', '610005002500'),  -- R$ 185,00 · nota em UN
  ('FARINHA PANKO ROMARIZ 10X1KG',                  'CX',  'MERCEARIA',         '105045027152'),  -- R$ 177,40 · nota em FD
  ('LINGUICA CALABRESA FATIADA KG',                 'KG',  'PROTEINAS',         '100005019112'),  -- R$ 153,05
  ('AZEITONA VERDE EM CONSERVA S/ CAROCO (COMPRA)', 'CX',  'MERCEARIA',         '105035009629'),  -- R$ 135,50 · nota em BD
  ('FEIJAO PRETO FUNCIONARIO 10X1KG (COMPRA)',      'CX',  'GRAOS FUNCIONARIO', '610005002003')   -- R$  83,90 · nota em FD
) AS v(nome, unidade, categoria, codigo)
-- Não duplica, e não cria gêmeo de produto que já existe com OUTRA unidade:
-- o nome é checado em qualquer unidade, de propósito. Se algum destes já
-- estiver no banco em outra unidade, ele não nasce aqui e aparece na
-- conferência 4 lá embaixo — é cadastro a decidir, não a adivinhar.
WHERE NOT EXISTS (
    SELECT 1 FROM "Produto" p WHERE lower(btrim(p.nome)) = lower(btrim(v.nome))
  )
  AND NOT EXISTS (
    SELECT 1 FROM "Produto" p WHERE p."codigoTeknisa" = v.codigo
  );

-- =====================================================================
-- CONFERÊNCIAS

-- 1. Os códigos alternativos criados aqui: cada linha mostra o produto, o
--    código do cadastro e o código novo que agora também aponta pra ele.
SELECT 'codigos alternativos' AS conferencia,
       p.nome, p."unidadeMedida", p."codigoTeknisa" AS codigo_do_cadastro,
       c.codigo AS alternativo, c."unidadeCompra", c.fator
FROM "CodigoCompraProduto" c
JOIN "Produto" p ON p.id = c."produtoId"
WHERE c.codigo IN ('125000000000', '105050007121', '105050007123', '110020004113')
ORDER BY p.nome, c.codigo;

-- 2. Os produtos novos. Esperado: 7 linhas da seção 4, mais o COGUMELO se o
--    3b tiver sido o que pegou.
SELECT 'produtos novos' AS conferencia,
       p.nome, p."unidadeMedida", p.categoria, p."codigoTeknisa", p.ativo
FROM "Produto" p
WHERE p."codigoTeknisa" IN (
  '105050007124', '105060008549', '610005002500', '105045027152',
  '100005019112', '105035009629', '610005002003', '110020004113'
)
ORDER BY p.categoria, p.nome;

-- 3. O COGUMELO, pelos dois caminhos — pra ver qual dos dois comandos pegou.
SELECT 'cogumelo' AS conferencia,
       p.id, p.nome, p."unidadeMedida", p."codigoTeknisa", p.categoria, p.ativo
FROM "Produto" p
WHERE lower(btrim(p.nome)) LIKE '%porto belo%'
   OR p."codigoTeknisa" IN ('110020004109', '110020004113');

-- 4. Algum dos 7 nomes já existia em OUTRA unidade? Se vier linha aqui, esse
--    produto não nasceu e precisa de decisão — não rode o reprocessar
--    esperando que ele case.
SELECT 'nome ja existia' AS conferencia,
       p.nome, p."unidadeMedida", p."codigoTeknisa", p.categoria
FROM "Produto" p
WHERE lower(btrim(p.nome)) IN (
  'oleo de soja lt 20x900 (compra)',
  'creme de leite 35% - nestilly lt 12x1',
  'cafe funcionario',
  'farinha panko romariz 10x1kg',
  'linguica calabresa fatiada kg',
  'azeitona verde em conserva s/ caroco (compra)',
  'feijao preto funcionario 10x1kg (compra)'
)
AND p."codigoTeknisa" IS DISTINCT FROM (
  CASE lower(btrim(p.nome))
    WHEN 'oleo de soja lt 20x900 (compra)'               THEN '105050007124'
    WHEN 'creme de leite 35% - nestilly lt 12x1'         THEN '105060008549'
    WHEN 'cafe funcionario'                              THEN '610005002500'
    WHEN 'farinha panko romariz 10x1kg'                  THEN '105045027152'
    WHEN 'linguica calabresa fatiada kg'                 THEN '100005019112'
    WHEN 'azeitona verde em conserva s/ caroco (compra)' THEN '105035009629'
    WHEN 'feijao preto funcionario 10x1kg (compra)'      THEN '610005002003'
  END
);

-- =====================================================================
-- FICA PARA DEPOIS, e é de propósito: o ÓLEO DE ALGODÃO 14,5 LT está no
-- cadastro DUAS vezes — 105050007118 ("OLEO DE ALGODAO 14,5 LT") e
-- 105050007119 ("... (COMPRA)"). O mesmo balde, dois produtos, estoque
-- partido ao meio. Fundir é o procedimento que já rodamos no Beira Lago e
-- mexe em saldo e movimento; não entra num script de cadastro. Esta consulta
-- mostra o par, para a fusão:
SELECT 'duplicata a fundir' AS conferencia,
       p.id, p.nome, p."unidadeMedida", p."codigoTeknisa",
       s.quantidade AS saldo
FROM "Produto" p
LEFT JOIN "EstoqueSaldo" s ON s."produtoId" = p.id
WHERE p."codigoTeknisa" IN ('105050007118', '105050007119');
