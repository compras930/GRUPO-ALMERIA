-- Completa as TRÊS fichas em que a planilha e o app discordam por falta,
-- e não por receita diferente. Beira Lago.
--
-- As outras três do 7 ficam de fora de propósito:
--   ARROZ DE PATO    — o app tem aioli de chorizo, brócolis e migas que a
--                      planilha não tem. É receita que mudou, não falta.
--   STEAK AU POIVRE  — o app usa PICADINHO DE FILE MIGNON onde a planilha
--                      pede FILÉ RENDIMENTO. Cortes diferentes, preços
--                      diferentes: quem decide é a cozinha.
--   FALAFEL          — a ficha do app é a montagem do prato; a da planilha é
--                      a massa do falafel. Faltam as duas coisas: cadastrar a
--                      massa como sub-receita e dizer quanto dela vai por
--                      porção. Copiar ingrediente aqui não resolveria.
--
-- SEGURO REPETIR: cada linha tem id próprio e é regravada, não duplicada.
-- Linha cujo produto não for encontrado no cadastro simplesmente não entra —
-- e a conferência no fim diz qual foi, em vez de gravar meia ficha calada.

BEGIN;

INSERT INTO "IngredienteReceita" ("id", "receitaId", "produtoId", "subReceitaId", "quantidade", "unidadeMedida")
SELECT DISTINCT ON (v.id)
       v.id, r.id, pr.id, sub.id, v.quantidade,
       coalesce(pr."unidadeMedida", 'KG')
  FROM (VALUES
    -- BACALHAU COZIDO: o app tem só bacalhau e azeite.
    ('ingfix-bacalhau-alecrim',  'BACALHAU COZIDO',         'ALECRIM',               '', 0.002),
    ('ingfix-bacalhau-tomilho',  'BACALHAU COZIDO',         'TOMILHO',               '', 0.002),
    ('ingfix-bacalhau-alho',     'BACALHAU COZIDO',         'ALHO DESCASCADO',       '', 0.02),
    -- CALDEIRADA: 50 g de robalo por porção que hoje somem da conta.
    ('ingfix-caldeirada-robalo', 'CALDEIRADA MEDITERRANEA', 'ROBALO CRU',            '', 0.05),
    -- ROBALO MONTAGEM: as duas guarnições, já cadastradas como ficha.
    ('ingfix-robalo-pure',       'ROBALO MONTAGEM',         '', 'PURE DE BANANA DA TERRA', 0.12),
    ('ingfix-robalo-farofa',     'ROBALO MONTAGEM',         '', 'FAROFA BANANA',           0.08)
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
   SET "receitaId"    = EXCLUDED."receitaId",
       "produtoId"    = EXCLUDED."produtoId",
       "subReceitaId" = EXCLUDED."subReceitaId",
       "quantidade"   = EXCLUDED."quantidade",
       "unidadeMedida"= EXCLUDED."unidadeMedida";

COMMIT;

-- Conferência: das seis linhas, quais entraram e quais não acharam cadastro.
-- O que aparecer como 'NAO ENTROU' é nome que não existe no cadastro com essa
-- grafia, ou produto cadastrado em unidade (CX, UND) em vez de peso.
SELECT v.id AS linha, v.chave_ficha AS ficha, coalesce(nullif(v.chave_produto, ''), v.chave_sub) AS ingrediente,
       CASE WHEN i.id IS NULL THEN 'NAO ENTROU — confira o cadastro' ELSE 'ok' END AS situacao
  FROM (VALUES
    ('ingfix-bacalhau-alecrim',  'BACALHAU COZIDO',         'ALECRIM',               ''),
    ('ingfix-bacalhau-tomilho',  'BACALHAU COZIDO',         'TOMILHO',               ''),
    ('ingfix-bacalhau-alho',     'BACALHAU COZIDO',         'ALHO DESCASCADO',       ''),
    ('ingfix-caldeirada-robalo', 'CALDEIRADA MEDITERRANEA', 'ROBALO CRU',            ''),
    ('ingfix-robalo-pure',       'ROBALO MONTAGEM',         '', 'PURE DE BANANA DA TERRA'),
    ('ingfix-robalo-farofa',     'ROBALO MONTAGEM',         '', 'FAROFA BANANA')
  ) AS v(id, chave_ficha, chave_produto, chave_sub)
  LEFT JOIN "IngredienteReceita" i ON i.id = v.id
 ORDER BY 4, 1;
