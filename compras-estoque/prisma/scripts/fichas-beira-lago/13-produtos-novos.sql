-- Produtos que faltavam no cadastro. Beira Lago.
--
-- CRIAR PRODUTO É A COISA MAIS PERIGOSA DESTE PROJETO — foi assim que nasceu
-- o ROBALO FILE sem acento, que ficou em três fichas sem nunca ter sido
-- comprado nem contado. Por isso cada linha aqui só entra se NÃO existir
-- produto com esse nome (ignorando acento e caixa), e os nomes das bebidas
-- são EXATAMENTE os que aparecem na nota de compra: é o que faz a próxima
-- nota casar sozinha com o cadastro novo, em vez de criar um terceiro.
--
-- AS GARRAFAS FICAM EM LITRO, não em unidade. A ficha do drink mede em litro,
-- e o bar precifica por litro. Como a nota traz garrafa, cada uma leva junto
-- a sua conversão (UND → fração de litro) — é exatamente para isso que
-- ConversaoUnidadeCompra existe.
--
-- O PREÇO DO HIBIKI E DO YAMAZAKI foi informado pelo bar, porque essas duas
-- nunca passaram por nota: estavam em estoque de antes. Entra como preço
-- atual e será substituído pela primeira compra que chegar — preço neste app
-- vem da nota, e este é um ponto de partida, não uma exceção à regra.
--
-- NÃO CRIEI "CLARAS DE OVOS": já existe CLARA DE OVO 1KG no cadastro. Criar
-- de novo seria repetir o robalo.
--
-- SEGURO REPETIR: nada é criado duas vezes.

BEGIN;

-- 1. Os produtos.
INSERT INTO "Produto" ("id", "nome", "unidadeMedida", "ativo", "criadoEm")
SELECT v.id, v.nome, v.un, true, now()
  FROM (VALUES
    -- Bar: compradas e sem cadastro (o nome é o da nota).
    ('prodk-ketelone',   'VODKA KETEL ONE 1L',             'LT'),
    ('prodk-disaronno',  'LICOR AMARETTO DISARONNO 700ML', 'LT'),
    -- Bar: em estoque de antes, nunca compradas pelo app.
    ('prodk-hibiki',     'WHISKY HIBIKI 700ML',            'LT'),
    ('prodk-yamazaki',   'WHISKY YAMAZAKI 700ML',          'LT'),
    -- Cozinha: pedidos do chef.
    ('prock-angola',     'GALINHA D''ANGOLA',              'KG'),
    ('prock-guanciale',  'GUANCIALE',                      'KG'),
    ('prock-folhada',    'MASSA FOLHADA',                  'KG'),
    ('prock-vermute',    'VERMUTE BRANCO',                 'LT'),
    ('prock-mantrufada', 'MANTEIGA TRUFADA',               'KG')
  ) AS v(id, nome, un)
 WHERE NOT EXISTS (
   SELECT 1 FROM "Produto" p
    WHERE upper(regexp_replace(translate(btrim(p.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g'))
        = upper(regexp_replace(translate(btrim(v.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g'))
 );

-- 2. A conversão da garrafa: a nota traz UNIDADE, o produto está em LITRO.
--    Sem isto, uma garrafa de 700 ml entraria como 1 litro de estoque — 43%
--    a mais de whisky do que chegou.
INSERT INTO "ConversaoUnidadeCompra" ("id", "produtoId", "unidadeCompra", "fator", "observacao", "criadoEm")
SELECT v.id, v.produto, 'UND', v.fator, v.obs, now()
  FROM (VALUES
    ('convdk-disaronno', 'prodk-disaronno', 0.7, 'garrafa de 700 ml'),
    ('convdk-hibiki',    'prodk-hibiki',    0.7, 'garrafa de 700 ml'),
    ('convdk-yamazaki',  'prodk-yamazaki',  0.7, 'garrafa de 700 ml'),
    ('convdk-ketelone',  'prodk-ketelone',  1.0, 'garrafa de 1 litro')
  ) AS v(id, produto, fator, obs)
 WHERE EXISTS (SELECT 1 FROM "Produto" p WHERE p.id = v.produto)
ON CONFLICT ("produtoId", "unidadeCompra") DO UPDATE
   SET "fator" = EXCLUDED."fator", "observacao" = EXCLUDED."observacao";

-- 3. Preço de partida das duas que nunca passaram por nota.
--    Por LITRO: R$ 704,36 a garrafa de 700 ml dá R$ 1.006,23 o litro.
INSERT INTO "PrecoAtualProduto" ("id", "unidadeId", "produtoId", "preco", "dataCompra", "atualizadoEm")
SELECT v.id, u.id, v.produto, v.preco, now(), now()
  FROM "Unidade" u, (VALUES
    ('precdk-hibiki',   'prodk-hibiki',   1006.23),
    ('precdk-yamazaki', 'prodk-yamazaki', 1279.20)
  ) AS v(id, produto, preco)
 WHERE u.nome = 'Beira Lago'
   AND EXISTS (SELECT 1 FROM "Produto" p WHERE p.id = v.produto)
ON CONFLICT ("unidadeId", "produtoId") DO NOTHING;

COMMIT;

-- Conferência: o que existe agora, e se algum já existia com outro nome.
SELECT p.nome, p."unidadeMedida", p.ativo,
       (SELECT c.fator FROM "ConversaoUnidadeCompra" c WHERE c."produtoId" = p.id AND c."unidadeCompra" = 'UND') AS garrafa_em_litros,
       (SELECT pa.preco FROM "PrecoAtualProduto" pa WHERE pa."produtoId" = p.id LIMIT 1) AS preco_por_litro
  FROM "Produto" p
 WHERE p.id LIKE 'prodk-%' OR p.id LIKE 'prock-%'
 ORDER BY p.nome;
