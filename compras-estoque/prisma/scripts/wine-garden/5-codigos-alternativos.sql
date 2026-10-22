-- Um produto, vários códigos: liga os códigos que faltavam.
--
-- O reprocessamento do Wine Garden devolveu 46 linhas como CONFLITO_DE_CODIGO.
-- Elas acharam o produto PELO NOME — a regra do sufixo redundante faz
-- "ALECRIM KG" em KG encontrar "ALECRIM" —, mas o código da linha é diferente
-- do gravado no produto. O Teknisa tem um código por EMBALAGEM e por cadastro:
-- ALECRIM é 110015009101 e 110015009123, CHOPP BRAHMA 50LT é 900107000103 e
-- 130000000001. Os dois são certos; cabia um só.
--
-- A RECUSA ESTAVA CERTA. Escolher um código e gravar o preço nele deixaria o
-- outro sem preço, calado — que é o modo de falhar que este projeto mais
-- paga para evitar.
--
-- POR QUE NÃO CADASTRAR UM PRODUTO NOVO. Seria o caminho fácil e o errado:
-- "ALECRIM KG" nasceria ao lado de "ALECRIM", a ficha consumiria de um e a
-- nota abasteceria o outro. É o fantasma da gema e da burrata, fabricado de
-- propósito. Esses 11 nomes foram tirados do 3-cadastro justamente por isso.
--
-- `fator` é 1 em todos: o código é outro, a embalagem é a mesma. Se algum dia
-- aparecer um código de CAIXA para um produto em quilo, aí o fator diz quantos
-- quilos tem a caixa — e é para isso que a coluna existe.
--
-- Rodar duas vezes não duplica: a tabela tem único em (origem, código, unidade).

INSERT INTO "CodigoCompraProduto" (id, origem, codigo, "produtoId", "unidadeCompra", fator, observacao)
SELECT gen_random_uuid()::text, 'TEKNISA', v.codigo, p.id, v.unidade, 1,
       'Segundo código do Teknisa, visto na compra do Wine Garden como ' || v.nome_na_nota
FROM (VALUES
  ('100000017103', 'KG', 'ALCATRA BOVINO KG', 'KG', 'ALCATRA BOVINO KG'),
  ('110015009101', 'KG', 'ALECRIM', 'KG', 'ALECRIM KG'),
  ('110000020602', 'KG', 'Abacaxi', 'KG', 'ABACAXI KG'),
  ('320000000002', 'KG', 'BACON FATIADO', 'KG', 'BACON FATIADO KG'),
  ('110015009106', 'KG', 'CEBOLETE', 'KG', 'CEBOLETE KG'),
  ('110015009107', 'KG', 'CEBOLINHA', 'KG', 'CEBOLINHA KG'),
  ('900107000103', 'BBL', 'CHOPP BRAHMA 50LT', 'UND', 'CHOPP BRAHMA 50LT'),
  ('110030000602', 'UN', 'OVOS GRANDE BRANCO UND', 'UND', 'OVOS GRANDE BRANCO UND'),
  ('320000000041', 'KG', 'Queijo brie', 'KG', 'QUEIJO BRIE KG'),
  ('110010013645', 'KG', 'RUCULA HIDROPONICA', 'KG', 'RUCULA HIDROPONICA KG'),
  ('110015009118', 'KG', 'SALSA', 'KG', 'SALSA KG')
) AS v(codigo, unidade, produto_nome, produto_unidade, nome_na_nota)
JOIN "Produto" p
  ON lower(btrim(p.nome)) = lower(btrim(v.produto_nome))
 AND p."unidadeMedida" = v.produto_unidade
WHERE NOT EXISTS (
  SELECT 1 FROM "CodigoCompraProduto" c
  WHERE c.origem = 'TEKNISA' AND c.codigo = v.codigo AND c."unidadeCompra" = v.unidade
);

-- CONFERÊNCIA: cada linha mostra o produto e os DOIS códigos que agora
-- apontam para ele — o do cadastro e o alternativo.
SELECT p.nome, p."unidadeMedida", p."codigoTeknisa" AS codigo_do_cadastro,
       c.codigo AS codigo_alternativo, c."unidadeCompra", c.fator
FROM "CodigoCompraProduto" c
JOIN "Produto" p ON p.id = c."produtoId"
ORDER BY p.nome;
