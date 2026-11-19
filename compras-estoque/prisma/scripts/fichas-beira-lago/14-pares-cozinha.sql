-- As linhas de ficha que os produtos novos destravam. Beira Lago.
-- Rodar depois do 13.
--
-- Oito linhas que estavam de fora porque o produto não existia, mais as
-- claras, que existiam com outro nome (CLARA DE OVO 1KG) — e por isso não
-- foram cadastradas de novo.
--
-- SEGURO REPETIR: ids próprios, regrava em vez de duplicar. Linha cujo
-- produto não for encontrado não entra e aparece nomeada na conferência.

BEGIN;

INSERT INTO "IngredienteReceita" ("id", "receitaId", "produtoId", "subReceitaId", "quantidade", "unidadeMedida")
SELECT DISTINCT ON (v.id)
       v.id, r.id, pr.id, NULL, v.quantidade, pr."unidadeMedida"
  FROM (VALUES
    ('ingnv-angola-recheio',   'RECHEIO DE GALINHA',           'GALINHA D ANGOLA',  1.6),
    ('ingnv-wellington-massa', 'BEEF WELIGTON',                'MASSA FOLHADA',     0.5),
    ('ingnv-wellington-guan',  'BEEF WELIGTON',                'GUANCIALE',         0.18),
    ('ingnv-rigatoni-guan',    'RIGATONI AMATRICIANA MONTAGEM','GUANCIALE',         0.08),
    ('ingnv-almare-guan',      'SPAGUETTI AL MARE',            'GUANCIALE',         0.08),
    ('ingnv-farce-vermute',    'SB FARCE TERRINE',             'VERMUTE BRANCO',    0.02),
    ('ingnv-tartufo-manteiga', 'MONTAGEM FILETO AO TARTUFO',   'MANTEIGA TRUFADA',  0.005),
    ('ingnv-manzo-manteiga',   'MOTAGEM FILE DE MANZO',        'MANTEIGA TRUFADA',  0.001),
    -- Já existia no cadastro, com outro nome.
    ('ingnv-farce-claras',     'SB FARCE TERRINE',             'CLARA DE OVO 1KG',  0.02),
    ('ingnv-consome-claras',   'CONSOME DE TOMATE E MILHO',    'CLARA DE OVO 1KG',  0.5),
    -- Folha de arroz é o papel de arroz do cadastro (confirmado pelo chef).
    ('ingnv-tartar-folha',     'MONTAGEM TARTAR DE ATUM',      'PAPEL DE ARROZ',    0.02)
  ) AS v(id, chave_ficha, chave_produto, quantidade)
  JOIN "Unidade" u ON u.nome = 'Beira Lago'
  JOIN "Receita" r ON r."unidadeId" = u.id
                  AND upper(regexp_replace(translate(btrim(r.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g')) = v.chave_ficha
  JOIN "Produto" pr ON pr.ativo
                   AND upper(regexp_replace(translate(btrim(pr.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g')) = v.chave_produto
                   AND upper(btrim(pr."unidadeMedida")) IN ('KG', 'G', 'LT', 'L', 'ML')
 ORDER BY v.id, pr.id
ON CONFLICT ("id") DO UPDATE
   SET "receitaId"     = EXCLUDED."receitaId",
       "produtoId"     = EXCLUDED."produtoId",
       "quantidade"    = EXCLUDED."quantidade",
       "unidadeMedida" = EXCLUDED."unidadeMedida";

COMMIT;

-- Conferência: o que entrou e o que não achou cadastro.
SELECT v.id AS linha, v.chave_ficha AS ficha, v.chave_produto AS ingrediente,
       CASE WHEN i.id IS NULL THEN 'NAO ENTROU — confira nome ou unidade' ELSE 'ok' END AS situacao
  FROM (VALUES
    ('ingnv-angola-recheio',   'RECHEIO DE GALINHA',           'GALINHA D ANGOLA'),
    ('ingnv-wellington-massa', 'BEEF WELIGTON',                'MASSA FOLHADA'),
    ('ingnv-wellington-guan',  'BEEF WELIGTON',                'GUANCIALE'),
    ('ingnv-rigatoni-guan',    'RIGATONI AMATRICIANA MONTAGEM','GUANCIALE'),
    ('ingnv-almare-guan',      'SPAGUETTI AL MARE',            'GUANCIALE'),
    ('ingnv-farce-vermute',    'SB FARCE TERRINE',             'VERMUTE BRANCO'),
    ('ingnv-tartufo-manteiga', 'MONTAGEM FILETO AO TARTUFO',   'MANTEIGA TRUFADA'),
    ('ingnv-manzo-manteiga',   'MOTAGEM FILE DE MANZO',        'MANTEIGA TRUFADA'),
    ('ingnv-farce-claras',     'SB FARCE TERRINE',             'CLARA DE OVO 1KG'),
    ('ingnv-consome-claras',   'CONSOME DE TOMATE E MILHO',    'CLARA DE OVO 1KG'),
    ('ingnv-tartar-folha',     'MONTAGEM TARTAR DE ATUM',      'PAPEL DE ARROZ')
  ) AS v(id, chave_ficha, chave_produto)
  LEFT JOIN "IngredienteReceita" i ON i.id = v.id
 ORDER BY 4, 1;
