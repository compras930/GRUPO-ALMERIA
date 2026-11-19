-- Mais seis garrafas do bar. Beira Lago.
--
-- DE ONDE VEIO CADA PREÇO, porque não é tudo da mesma fonte:
--   Bon Vivant, Tanqueray Ten, Hendrick's → informados por você.
--   Maker's Mark, Buffalo Trace, Peachtree → Listagem de entrada do XMENU,
--     que já traz a unidade em LITRO e o preço POR LITRO calculado.
--
-- OS DOIS BATEM, E ISSO É A CONFERÊNCIA. R$ 34,89 a garrafa de 750 ml do Bon
-- Vivant dão R$ 46,52 o litro; o Xmenu diz 46,53. O Tanqueray Ten dá 220,39,
-- e a planilha do bar diz 220,39. Quando duas fontes independentes chegam ao
-- mesmo número, o número para de ser suposição.
--
-- O HENDRICK'S VOCÊ JÁ DEU POR LITRO (R$ 218,11), então entra direto — não
-- divido por 0,75 de novo. Dividir o que já está por litro seria o erro mais
-- fácil desta tela inteira.
--
-- OS NOMES SÃO OS DO XMENU onde ele tem a garrafa. Não é preferência
-- estética: é o que faz a entrada de mercadoria do Beira Lago casar sozinha
-- com o cadastro, do mesmo jeito que os nomes da nota do Teknisa fizeram no
-- 13.
--
-- SEGURO REPETIR: nada é criado duas vezes.

BEGIN;

INSERT INTO "Produto" ("id", "nome", "unidadeMedida", "ativo", "criadoEm")
SELECT v.id, v.nome, 'LT', true, now()
  FROM (VALUES
    ('probar-vivant',   'GIN BON VIVANT 750ML'),
    ('probar-ten',      'GIN TANQUERAY N TEN 750ML'),
    ('probar-hendrick', 'GIN HENDRICKS 750ML'),
    ('probar-makers',   'WHISKY MAKER''S MARK 750ML'),
    ('probar-buffalo',  'WHISKEY BUFFALO TRACE BOURBON 750ML'),
    ('probar-peach',    'LICOR DE PESSEGO PEACHETREE 700ML')
  ) AS v(id, nome)
 WHERE NOT EXISTS (
   SELECT 1 FROM "Produto" p
    WHERE upper(regexp_replace(translate(btrim(p.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g'))
        = upper(regexp_replace(translate(btrim(v.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g'))
 );

-- A garrafa, para quando a entrada vier em unidade.
INSERT INTO "ConversaoUnidadeCompra" ("id", "produtoId", "unidadeCompra", "fator", "observacao", "criadoEm")
SELECT v.id, v.produto, 'UND', v.fator, v.obs, now()
  FROM (VALUES
    ('convbar-vivant',   'probar-vivant',   0.75, 'garrafa de 750 ml'),
    ('convbar-ten',      'probar-ten',      0.75, 'garrafa de 750 ml'),
    ('convbar-hendrick', 'probar-hendrick', 0.75, 'garrafa de 750 ml'),
    ('convbar-makers',   'probar-makers',   0.75, 'garrafa de 750 ml'),
    ('convbar-buffalo',  'probar-buffalo',  0.75, 'garrafa de 750 ml'),
    ('convbar-peach',    'probar-peach',    0.70, 'garrafa de 700 ml')
  ) AS v(id, produto, fator, obs)
 WHERE EXISTS (SELECT 1 FROM "Produto" p WHERE p.id = v.produto)
ON CONFLICT ("produtoId", "unidadeCompra") DO UPDATE
   SET "fator" = EXCLUDED."fator", "observacao" = EXCLUDED."observacao";

-- Preço de partida, POR LITRO. Substituído pela primeira entrada que chegar.
INSERT INTO "PrecoAtualProduto" ("id", "unidadeId", "produtoId", "preco", "dataCompra", "atualizadoEm")
SELECT v.id, u.id, v.produto, v.preco, now(), now()
  FROM "Unidade" u, (VALUES
    ('precbar-vivant',   'probar-vivant',    46.52),  -- 34,89 / 0,75
    ('precbar-ten',      'probar-ten',      220.39),  -- 165,29 / 0,75
    ('precbar-hendrick', 'probar-hendrick', 218.11),  -- já informado por litro
    ('precbar-makers',   'probar-makers',   199.85),  -- Xmenu
    ('precbar-buffalo',  'probar-buffalo',  182.24),  -- Xmenu
    ('precbar-peach',    'probar-peach',    196.59)   -- Xmenu
  ) AS v(id, produto, preco)
 WHERE u.nome = 'Beira Lago'
   AND EXISTS (SELECT 1 FROM "Produto" p WHERE p.id = v.produto)
ON CONFLICT ("unidadeId", "produtoId") DO NOTHING;

COMMIT;

SELECT p.nome, p."unidadeMedida",
       (SELECT c.fator FROM "ConversaoUnidadeCompra" c WHERE c."produtoId" = p.id AND c."unidadeCompra" = 'UND') AS garrafa_em_litros,
       (SELECT round(pa.preco::numeric, 2) FROM "PrecoAtualProduto" pa WHERE pa."produtoId" = p.id LIMIT 1) AS preco_por_litro
  FROM "Produto" p
 WHERE p.id LIKE 'probar-%'
 ORDER BY p.nome;
