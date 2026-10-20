-- Resolve os três conflitos de unidade que a primeira carga do XMenu revelou.
--
--   APERITIVO APEROL 750ML   compra LT, cadastrado UND  -> conversão (passo 3)
--   ACELGA                   compra KG, cadastrado LT   -> corrigir unidade (passo 4)
--   CASTANHA DE CAJU ...     compra KG, cadastrado UND  -> depende do passo 2
--
-- Os passos 1 e 2 SÓ LEEM. Os demais escrevem, e cada um diz o que olhar antes.
--
-- ANTES DE RODAR OS PASSOS 3 E 5, O APP PRECISA ESTAR ATUALIZADO.
-- Até 20/10/2026 a ConversaoUnidadeCompra só era consultada no caminho do
-- CÓDIGO, e o XMenu não manda código nenhum (docs/n8n/contrato-integracao.md).
-- Cadastrar conversão para estas linhas não teria efeito NENHUM: elas
-- voltariam como "não reconhecidas" para sempre, e caladas, porque "não
-- encontrado" é a mesma resposta de produto que não existe. O passo 2b de
-- resolverLinhaCompraPura foi escrito para isso. As linhas de conversão abaixo
-- são inertes até aquele código estar no ar — não quebram nada, só não fazem
-- efeito.
--
-- POR QUE OS TRÊS NÃO TÊM A MESMA RESPOSTA. O catálogo de Produto é único pro
-- Grupo, então mexer na unidade de um produto mexe em toda casa que já o usa.
-- O que decide é quanto de vida cada cadastro tem:
--
--   Aperol:  0 fichas, mas 3 casas com preço e saldo, 9 linhas de compra
--   Castanha: 5 fichas, 3 casas com preço e saldo, 17 linhas de compra
--   Acelga:  1 ficha, 1 preço, ZERO compra, ZERO saldo, ZERO contagem
--
-- Cadastro com compra e saldo não se mexe — converte-se. Cadastro que nunca
-- recebeu uma compra sequer é cadastro errado, e aí corrigir é o certo.

-- ---------------------------------------------------------------------------
-- 1. A FICHA DA ACELGA. É o que falta olhar antes de trocar LT por KG.
--
--    A quantidade da ficha está escrita na unidade do cadastro, e o custo é
--    quantidade x preço sem converter nada (src/lib/receita.ts). Trocar a
--    unidade não mexe no número da ficha — mexe no que ele SIGNIFICA. Se
--    disser 0,2 "LT" de acelga e virar 0,2 kg, pode estar certo ou pode estar
--    dez vezes errado, e só quem conhece o prato sabe.
-- ---------------------------------------------------------------------------
SELECT u.nome AS casa, r.nome AS ficha, ir.quantidade, ir."unidadeMedida" AS unidade_na_ficha,
       p.nome AS insumo, p."unidadeMedida" AS unidade_do_cadastro,
       (SELECT string_agg(iv.nome, ', ') FROM "ItemVenda" iv WHERE iv."receitaId" = r.id) AS pratos
FROM "IngredienteReceita" ir
JOIN "Produto" p ON p.id = ir."produtoId"
JOIN "Receita" r ON r.id = ir."receitaId"
JOIN "Unidade" u ON u.id = r."unidadeId"
WHERE p.id = 'cmtc03t1q00lecwgtgtvb2bdg';  -- ACELGA

-- ---------------------------------------------------------------------------
-- 2. O PREÇO DOS TRÊS, por casa. Conferência, já respondida:
--    castanha a R$ 89,00 a UND e pacote de 1 kg — o mesmo R$ 89,00/kg que o
--    Beira Lago paga. Logo 1 UND = 1 kg, e o fator do passo 5 é 1.
-- ---------------------------------------------------------------------------
SELECT p.nome, p."unidadeMedida", u.nome AS casa,
       round(pa.preco::numeric, 2) AS preco_atual, pa."dataCompra"
FROM "PrecoAtualProduto" pa
JOIN "Produto" p ON p.id = pa."produtoId"
JOIN "Unidade" u ON u.id = pa."unidadeId"
WHERE p.id IN (
  'cmtj2f9zu00m3cjw5xi039qvm',  -- APERITIVO APEROL 750ML
  'cmtc03sy400j1cwgt41budf6c',  -- CASTANHA DE CAJU TORRADA SEM SAL
  'cmtc03t1q00lecwgtgtvb2bdg'   -- ACELGA
)
ORDER BY p.nome, u.nome;

-- ---------------------------------------------------------------------------
-- 3. APEROL: a conversão. PODE RODAR.
--
--    O produto é a garrafa de 750 ml (UND) e o XMenu compra em litro. Nada no
--    cadastro muda, e as outras casas não sentem nada: a conversão só diz como
--    LER uma linha de compra em LT.
--
--    fator = quanto da unidade DO PRODUTO cabe em UMA unidade DE COMPRA:
--      1 litro / 0,750 litro por garrafa = 1,3333 garrafas
--
--    A aritmética bate com a compra real. O Beira Lago compra sempre 4,5 LT
--    por pedido, a R$ 79,83/LT:
--      quantidade  4,5 x 1,3333 = 6 garrafas   (e 6 x 750ml = 4,5 LT, confere)
--      preço       79,83 / 1,3333 = R$ 59,87 por garrafa
--
--    Se o preço por UND do passo 2 estiver longe de R$ 59,87, PARE: uma das
--    duas pontas está errada, e o fator carimbaria a errada como verdade.
-- ---------------------------------------------------------------------------
INSERT INTO "ConversaoUnidadeCompra" (id, "produtoId", "unidadeCompra", fator, observacao, "criadoEm")
VALUES (
  'convblaperollt',
  'cmtj2f9zu00m3cjw5xi039qvm',
  'LT',
  1.3333333333333333,  -- 4/3 com casas suficientes pra 4,5 LT dar 6 garrafas redondas
  'XMenu Beira Lago compra Aperol em litro; o produto e a garrafa de 750ml. 1 LT = 1,3333 garrafas.',
  now()
)
ON CONFLICT ("produtoId", "unidadeCompra") DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. ACELGA: corrigir a unidade. SÓ DEPOIS DE OLHAR O PASSO 1.
--
--    Acelga é comprada e contada em quilo — o cadastro em LT é erro, e um erro
--    que nunca recebeu compra, saldo nem contagem. Não há nada para reinterpretar
--    além daquela ficha única.
--
--    O preço guardado NÃO é corrigido aqui de propósito: ele é um número por
--    "LT" que passaria a valer por kg sem ninguém ter medido nada. Deixe a
--    próxima carga sobrescrever com preço de compra de verdade — e, se aquela
--    casa não compra acelga, o certo é não ter preço mesmo. A linha do DELETE
--    abaixo faz isso; descomente junto com o UPDATE.
-- ---------------------------------------------------------------------------
-- UPDATE "Produto" SET "unidadeMedida" = 'KG' WHERE id = 'cmtc03t1q00lecwgtgtvb2bdg';
-- DELETE FROM "PrecoAtualProduto" WHERE "produtoId" = 'cmtc03t1q00lecwgtgtvb2bdg';

-- ---------------------------------------------------------------------------
-- 5. CASTANHA: a conversão. PODE RODAR.
--
--    O pacote é de 1 kg e custa R$ 89,00 — o mesmo R$ 89,00/kg que o Beira
--    Lago paga, nas duas compras. Logo 1 kg de compra = 1 pacote: fator 1.
--
--    FATOR 1 NÃO É O MESMO QUE NÃO PRECISAR DE CONVERSÃO. Sem esta linha, o
--    casamento procura "CASTANHA ... |||KG" e o produto está em UND: não acha
--    nada, e a linha volta como não reconhecida. O que a conversão faz aqui
--    não é converter número nenhum — é AUTORIZAR a leitura de uma compra em
--    kg como sendo daquele produto. Sem autorização declarada, nome em outra
--    unidade não casa, e é essa regra que impede preço de caixa virar preço
--    de quilo.
--
--    NÃO troque a unidade deste produto: 5 fichas, 3 casas com preço e saldo
--    e 17 linhas de compra dependem do UND.
-- ---------------------------------------------------------------------------
INSERT INTO "ConversaoUnidadeCompra" (id, "produtoId", "unidadeCompra", fator, observacao, "criadoEm")
VALUES (
  'convblcastanhakg',
  'cmtc03sy400j1cwgt41budf6c',
  'KG',
  1,
  'XMenu Beira Lago compra castanha em kg; o produto e o pacote de 1 kg, a R$ 89,00. 1 kg = 1 pacote.',
  now()
)
ON CONFLICT ("produtoId", "unidadeCompra") DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. CONFERÊNCIA
-- ---------------------------------------------------------------------------
SELECT p.nome, p."unidadeMedida" AS unidade_do_produto,
       cv."unidadeCompra", cv.fator
FROM "Produto" p
LEFT JOIN "ConversaoUnidadeCompra" cv ON cv."produtoId" = p.id
WHERE p.id IN (
  'cmtj2f9zu00m3cjw5xi039qvm',
  'cmtc03sy400j1cwgt41budf6c',
  'cmtc03t1q00lecwgtgtvb2bdg'
)
ORDER BY p.nome;
