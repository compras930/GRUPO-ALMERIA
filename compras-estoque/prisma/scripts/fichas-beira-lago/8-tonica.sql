-- A água tônica dos gin tônicas: de litro para lata. Beira Lago.
--
-- A ficha pede 0,2 LT de tônica. O cadastro tem "AGUA TONICA ST PIERRE
-- TRADICIONAL LATA 270ML", em UND — porque é assim que se compra e se conta:
-- lata. E o app explode a ficha NA UNIDADE DO PRODUTO, sem converter nada.
-- Gravar 0,2 contra um produto em UND diria que o gin tônica gasta um quinto
-- de lata, quando gasta três quartos.
--
-- O VOLUME VEIO DO NOME DO PRODUTO, não de suposição: 270ML está escrito no
-- cadastro. 0,2 ÷ 0,27 = 0,74 lata por drink. Era exatamente para isso que o
-- diagnóstico dos drinks lia o volume do nome.
--
-- SOBRA MEIA LATA, E ISSO É VERDADE, NÃO ERRO. A lata tem 270 ml, o drink
-- leva 200: os 70 ml que sobram são perda real do bar, que aparece no consumo
-- e não no custo da ficha. Quem quiser cobrar a lata inteira do drink muda o
-- 0,27 para 0,2 aqui — é uma decisão de gestão, não de cálculo.
--
-- FICA DE FORA O "ST PIERRE PALOMA" (3 drinks): a nota só traz as versões
-- Tradicional, Ginger e Zero da St Pierre. Paloma não é nenhuma das três, e
-- escolher uma seria inventar o sabor.
--
-- SEGURO REPETIR: ids próprios, regrava em vez de duplicar.

BEGIN;

INSERT INTO "IngredienteReceita" ("id", "receitaId", "produtoId", "subReceitaId", "quantidade", "unidadeMedida")
SELECT v.id, r.id, pr.id, NULL, v.litros / 0.27, 'UND'
  FROM (VALUES
    ('ingdk-tonica-bomvivant', 'GIN TONICA BOM VIVANT',      0.2),
    ('ingdk-tonica-tanqueray', 'GIN TONICA TANQUERAY',       0.2),
    ('ingdk-tonica-tanq-ten',  'GIN TONICA TANQUERAY N TEN', 0.2),
    ('ingdk-tonica-mare',      'GIN TONICA MARE',            0.2),
    ('ingdk-tonica-roku',      'GIN TONICA ROKU',            0.2),
    ('ingdk-tonica-nordes',    'GIN TONICA NORDES',          0.2),
    ('ingdk-tonica-hendrix',   'GIN TONICA HENDRIX',         0.2)
  ) AS v(id, chave_drink, litros)
  JOIN "Unidade" u ON u.nome = 'Beira Lago'
  JOIN "Receita" r ON r."unidadeId" = u.id
                  AND upper(regexp_replace(translate(btrim(r.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g')) = v.chave_drink
  JOIN "Produto" pr ON pr.ativo
                   AND upper(regexp_replace(translate(btrim(pr.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g'))
                       = 'AGUA TONICA ST PIERRE TRADICIONAL LATA 270ML'
                   -- Exige UND: se alguém recadastrar a tônica em litro, estas
                   -- linhas param de entrar em vez de virarem 0,74 LITRO de
                   -- tônica por drink.
                   AND upper(btrim(pr."unidadeMedida")) = 'UND'
ON CONFLICT ("id") DO UPDATE
   SET "receitaId"     = EXCLUDED."receitaId",
       "produtoId"     = EXCLUDED."produtoId",
       "quantidade"    = EXCLUDED."quantidade",
       "unidadeMedida" = EXCLUDED."unidadeMedida";

COMMIT;

-- Conferência: quantas latas cada gin tônica passou a levar.
SELECT r.nome AS drink, pr.nome AS ingrediente,
       round(i.quantidade::numeric, 3) AS latas, i."unidadeMedida"
  FROM "IngredienteReceita" i
  JOIN "Receita" r ON r.id = i."receitaId"
  JOIN "Produto" pr ON pr.id = i."produtoId"
 WHERE i.id LIKE 'ingdk-tonica-%'
 ORDER BY r.nome;
