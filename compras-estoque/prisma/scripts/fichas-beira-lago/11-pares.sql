-- Os ingredientes que a planilha chama por um nome e o app por outro.
-- Beira Lago. Dez pares, nenhum deles chute.
--
-- PRODUTO (a planilha escreve; o cadastro chama):
--   OVO               → Ovo de galinha            6 fichas
--   GEMA PAUSTERIZDA  → Gema pasteurizada         erro de digitação da planilha
--   LECITINA DE SOJA  → LECITINA 75GR
--
-- SUB-RECEITA (o preparo já é ficha, só não estava apontado):
--   SB - CALDO BASE          → SB - CALDO BASE ARROZ CALDOSO
--   RECHEIO GALINHA D'ANGOLA → RECHEIO DE GALINHA
--   PURE DE LIMÃO            → PURE DE LIMÃO SICILIANO       2 fichas
--   Tartare atum tortinha    → Tartare de Atum
--   LULA GRELHADA            → MINI LULA GRELHADA
--   POLVO GRELHADO           → ficha POLVO                   2 fichas
--     (esse tem prova: a CALDEIRADA já usa a ficha POLVO exatamente onde a
--      planilha escreve POLVO GRELHADO.)
--
-- A TRAVA DA UNIDADE CONTINUA VALENDO. Produto cadastrado em UND ou CX não
-- entra: a ficha mede em quilo, e gravar "0,4" contra um cadastro em unidade
-- diria que o preparo leva 0,4 ovo em vez de 400 g. O custo sairia baixo,
-- plausível e errado — e é o erro que ninguém revisa. A linha recusada
-- aparece nomeada na conferência do fim.
--
-- SEGURO REPETIR: cada linha tem id próprio e é regravada, não duplicada.

BEGIN;

INSERT INTO "IngredienteReceita" ("id", "receitaId", "produtoId", "subReceitaId", "quantidade", "unidadeMedida")
SELECT DISTINCT ON (v.id)
       v.id, r.id, pr.id, sub.id, v.quantidade,
       coalesce(pr."unidadeMedida", 'KG')
  FROM (VALUES
    -- OVO → Ovo de galinha
    ('ingpar-croqueta-ovo',    'MONTAGEM CROQUETA DE SOBREASSAD', 'OVO DE GALINHA',  '', 1.0),
    ('ingpar-beterraba-ovo',   'MASSA FRESCA DE BETERRABA',       'OVO DE GALINHA',  '', 0.4),
    ('ingpar-bacalhau-ovo',    'SB MASSA BOLINHO BACALHAU',       'OVO DE GALINHA',  '', 0.2),
    ('ingpar-arancine-ovo',    'MONTAGEM ARANCINE',               'OVO DE GALINHA',  '', 0.05),
    ('ingpar-farce-ovo',       'SB FARCE TERRINE',                'OVO DE GALINHA',  '', 0.04),
    ('ingpar-bolinhopeixe-ovo','MONTAGEM BOLINHO DE PEIXE',       'OVO DE GALINHA',  '', 0.02),
    -- Erro de digitação da planilha: PAUSTERIZDA
    ('ingpar-mayo-gema',       'SB MAYO DE HORTELA',              'GEMA PASTEURIZADA', '', 0.5),
    ('ingpar-espuma-lecitina', 'SB ESPUMA DE LIMAO',              'LECITINA 75GR',   '', 0.08),
    -- Preparos que já são ficha
    ('ingpar-caldoso-base',    'MONTAGEM ARROZ CALDOSO',  '', 'SB CALDO BASE ARROZ CALDOSO', 0.35),
    ('ingpar-torteline-recheio','TORTELINE DE GALINHA',   '', 'RECHEIO DE GALINHA',          0.12),
    ('ingpar-croqueta-pure',   'MONTAGEM CROQUETA DE SOBREASSAD', '', 'PURE DE LIMAO SICILIANO', 0.01),
    ('ingpar-tortinhapeixe-pure','TORTINHA DE PEIXE E MOSTARDA',  '', 'PURE DE LIMAO SICILIANO', 0.01),
    ('ingpar-tortinhaatum-tartare','TORTINHA DE ATUM E CREME AZEDO','', 'TARTARE DE ATUM',       0.03),
    ('ingpar-lularecheada-lula','LULA RECHEADA',          '', 'MINI LULA GRELHADA',          0.05),
    ('ingpar-polvoabobora-polvo','POLVO COM ABOBORA MONTAGEM','', 'POLVO',                    0.2),
    ('ingpar-tapapolvo-polvo', 'TAPA DE POLVO',           '', 'POLVO',                        0.05)
  ) AS v(id, chave_ficha, chave_produto, chave_sub, quantidade)
  JOIN "Unidade" u ON u.nome = 'Beira Lago'
  JOIN "Receita" r ON r."unidadeId" = u.id
                  AND upper(regexp_replace(translate(btrim(r.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g')) = v.chave_ficha
  LEFT JOIN "Produto" pr ON v.chave_produto <> '' AND pr.ativo
                        AND upper(regexp_replace(translate(btrim(pr.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g')) = v.chave_produto
                        AND upper(btrim(pr."unidadeMedida")) IN ('KG', 'G', 'LT', 'L', 'ML')
  LEFT JOIN "Receita" sub ON v.chave_sub <> '' AND sub."unidadeId" = u.id
                         AND upper(regexp_replace(translate(btrim(sub.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g')) = v.chave_sub
 WHERE pr.id IS NOT NULL OR sub.id IS NOT NULL
 ORDER BY v.id, pr.id, sub.id
ON CONFLICT ("id") DO UPDATE
   SET "receitaId"     = EXCLUDED."receitaId",
       "produtoId"     = EXCLUDED."produtoId",
       "subReceitaId"  = EXCLUDED."subReceitaId",
       "quantidade"    = EXCLUDED."quantidade",
       "unidadeMedida" = EXCLUDED."unidadeMedida";

COMMIT;

-- Conferência: linha a linha, o que entrou e o que não achou cadastro.
SELECT v.id AS linha, v.chave_ficha AS ficha,
       coalesce(nullif(v.chave_produto, ''), v.chave_sub) AS ingrediente,
       CASE WHEN i.id IS NULL THEN 'NAO ENTROU — confira nome ou unidade' ELSE 'ok' END AS situacao
  FROM (VALUES
    ('ingpar-croqueta-ovo',    'MONTAGEM CROQUETA DE SOBREASSAD', 'OVO DE GALINHA',  ''),
    ('ingpar-beterraba-ovo',   'MASSA FRESCA DE BETERRABA',       'OVO DE GALINHA',  ''),
    ('ingpar-bacalhau-ovo',    'SB MASSA BOLINHO BACALHAU',       'OVO DE GALINHA',  ''),
    ('ingpar-arancine-ovo',    'MONTAGEM ARANCINE',               'OVO DE GALINHA',  ''),
    ('ingpar-farce-ovo',       'SB FARCE TERRINE',                'OVO DE GALINHA',  ''),
    ('ingpar-bolinhopeixe-ovo','MONTAGEM BOLINHO DE PEIXE',       'OVO DE GALINHA',  ''),
    ('ingpar-mayo-gema',       'SB MAYO DE HORTELA',              'GEMA PASTEURIZADA', ''),
    ('ingpar-espuma-lecitina', 'SB ESPUMA DE LIMAO',              'LECITINA 75GR',   ''),
    ('ingpar-caldoso-base',    'MONTAGEM ARROZ CALDOSO',  '', 'SB CALDO BASE ARROZ CALDOSO'),
    ('ingpar-torteline-recheio','TORTELINE DE GALINHA',   '', 'RECHEIO DE GALINHA'),
    ('ingpar-croqueta-pure',   'MONTAGEM CROQUETA DE SOBREASSAD', '', 'PURE DE LIMAO SICILIANO'),
    ('ingpar-tortinhapeixe-pure','TORTINHA DE PEIXE E MOSTARDA',  '', 'PURE DE LIMAO SICILIANO'),
    ('ingpar-tortinhaatum-tartare','TORTINHA DE ATUM E CREME AZEDO','', 'TARTARE DE ATUM'),
    ('ingpar-lularecheada-lula','LULA RECHEADA',          '', 'MINI LULA GRELHADA'),
    ('ingpar-polvoabobora-polvo','POLVO COM ABOBORA MONTAGEM','', 'POLVO'),
    ('ingpar-tapapolvo-polvo', 'TAPA DE POLVO',           '', 'POLVO')
  ) AS v(id, chave_ficha, chave_produto, chave_sub)
  LEFT JOIN "IngredienteReceita" i ON i.id = v.id
 ORDER BY 4, 1;

-- Se "Ovo de galinha" aparecer como NAO ENTROU, é a trava da unidade: ele
-- está cadastrado em UND. Nesse caso o conserto não é na ficha, é no cadastro
-- do produto — e vale também para a compra e para a contagem, não só aqui.
-- Esta consulta diz em que unidade ele está:
SELECT nome, "unidadeMedida", ativo FROM "Produto"
 WHERE nome ILIKE '%ovo%galinha%' OR nome ILIKE '%gema%' OR nome ILIKE '%lecitina%'
 ORDER BY nome;
