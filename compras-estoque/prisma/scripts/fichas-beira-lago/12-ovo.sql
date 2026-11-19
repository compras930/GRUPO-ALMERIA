-- O ovo das seis fichas, convertido de quilo para unidade. Beira Lago.
--
-- O PROBLEMA. A planilha do chef mede ovo em quilo (1,0 kg na croqueta,
-- 0,4 kg na massa de beterraba). O cadastro tem "Ovo de galinha" em UND,
-- porque é assim que a casa compra, conta e paga. E o app, ao explodir a
-- ficha, usa a quantidade NA UNIDADE DO PRODUTO — ele não converte nada
-- (ver explodirReceitaPura em src/lib/receita.ts). Gravar "1,0" contra um
-- produto em UND faria a croqueta gastar UM ovo onde a receita quer um quilo:
-- vinte vezes menos, com custo plausível e errado.
--
-- POR QUE NÃO MUDAR O CADASTRO DO OVO PARA QUILO. Porque a casa compra, conta
-- e precifica ovo por unidade. Mudar a unidade do produto para consertar seis
-- linhas de ficha quebraria a compra, a contagem e o preço — conserta-se o
-- lado que está errado, e o lado errado aqui é a ficha.
--
-- O FATOR: 1 ovo = 50 g, que é o ovo grande sem casca. É o único número
-- inventado deste arquivo, está escrito uma vez só, e a conferência do fim
-- mostra quantos ovos cada ficha passou a levar — se o chef disser outro
-- tamanho, muda-se aqui e roda de novo.
--
--   croqueta          1,0  kg → 20 ovos
--   massa beterraba   0,4  kg →  8
--   massa bacalhau    0,2  kg →  4
--   arancine          0,05 kg →  1
--   farce/terrine     0,04 kg →  0,8
--   bolinho de peixe  0,02 kg →  0,4
--
-- SEGURO REPETIR: ids próprios, regrava em vez de duplicar.

BEGIN;

INSERT INTO "IngredienteReceita" ("id", "receitaId", "produtoId", "subReceitaId", "quantidade", "unidadeMedida")
SELECT v.id, r.id, pr.id, NULL, v.quilos / 0.05, 'UND'
  FROM (VALUES
    ('ingpar-croqueta-ovo',     'MONTAGEM CROQUETA DE SOBREASSAD', 1.0),
    ('ingpar-beterraba-ovo',    'MASSA FRESCA DE BETERRABA',       0.4),
    ('ingpar-bacalhau-ovo',     'SB MASSA BOLINHO BACALHAU',       0.2),
    ('ingpar-arancine-ovo',     'MONTAGEM ARANCINE',               0.05),
    ('ingpar-farce-ovo',        'SB FARCE TERRINE',                0.04),
    ('ingpar-bolinhopeixe-ovo', 'MONTAGEM BOLINHO DE PEIXE',       0.02)
  ) AS v(id, chave_ficha, quilos)
  JOIN "Unidade" u ON u.nome = 'Beira Lago'
  JOIN "Receita" r ON r."unidadeId" = u.id
                  AND upper(regexp_replace(translate(btrim(r.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g')) = v.chave_ficha
  JOIN "Produto" pr ON pr.ativo
                   AND upper(regexp_replace(translate(btrim(pr.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g')) = 'OVO DE GALINHA'
                   -- Exige UND de propósito: se alguém recadastrar o ovo em
                   -- quilo, estas linhas param de entrar em vez de passarem a
                   -- significar 20 quilos de ovo por croqueta.
                   AND upper(btrim(pr."unidadeMedida")) = 'UND'
ON CONFLICT ("id") DO UPDATE
   SET "receitaId"     = EXCLUDED."receitaId",
       "produtoId"     = EXCLUDED."produtoId",
       "subReceitaId"  = EXCLUDED."subReceitaId",
       "quantidade"    = EXCLUDED."quantidade",
       "unidadeMedida" = EXCLUDED."unidadeMedida";

COMMIT;

-- Conferência: quantos ovos cada ficha passou a levar.
SELECT r.nome AS ficha, pr.nome AS ingrediente, g.quantidade AS ovos, g."unidadeMedida"
  FROM "IngredienteReceita" g
  JOIN "Receita" r ON r.id = g."receitaId"
  JOIN "Produto" pr ON pr.id = g."produtoId"
 WHERE g.id IN ('ingpar-croqueta-ovo', 'ingpar-beterraba-ovo', 'ingpar-bacalhau-ovo',
                'ingpar-arancine-ovo', 'ingpar-farce-ovo', 'ingpar-bolinhopeixe-ovo')
 ORDER BY g.quantidade DESC;
