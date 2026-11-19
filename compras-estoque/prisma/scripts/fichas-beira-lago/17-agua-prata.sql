-- A água com gás do highball: de litro para garrafa. Beira Lago.
--
-- Mesmo caso da tônica. A ficha do YAMAZAKI HIGHBALL pede 0,12 LT; o cadastro
-- tem "AGUA PRATA 1,27 LT CG" em UND, porque se compra e se conta garrafa.
-- O app explode a ficha na unidade do produto, sem converter: gravar 0,12
-- diria um oitavo de garrafa, quando é um décimo.
--
-- O VOLUME VEIO DO NOME: 1,27 LT está escrito no cadastro.
-- 0,12 ÷ 1,27 = 0,0945 garrafa por drink.
--
-- SEGURO REPETIR: id próprio, regrava em vez de duplicar.

BEGIN;

INSERT INTO "IngredienteReceita" ("id", "receitaId", "produtoId", "subReceitaId", "quantidade", "unidadeMedida")
SELECT 'ingdk-highball-agua', r.id, pr.id, NULL, 0.12 / 1.27, 'UND'
  FROM "Unidade" u
  JOIN "Receita" r ON r."unidadeId" = u.id
                  AND upper(regexp_replace(translate(btrim(r.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g')) = 'YAMAZAKI HIGHBALL'
  JOIN "Produto" pr ON pr.ativo
                   AND upper(regexp_replace(translate(btrim(pr.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g')) = 'AGUA PRATA 1 27 LT CG'
                   -- Exige UND: se a água for recadastrada em litro, a linha
                   -- para de entrar em vez de virar 0,09 LITRO de água.
                   AND upper(btrim(pr."unidadeMedida")) = 'UND'
 WHERE u.nome = 'Beira Lago'
ON CONFLICT ("id") DO UPDATE
   SET "receitaId" = EXCLUDED."receitaId", "produtoId" = EXCLUDED."produtoId",
       "quantidade" = EXCLUDED."quantidade", "unidadeMedida" = EXCLUDED."unidadeMedida";

COMMIT;

SELECT r.nome AS drink, pr.nome AS ingrediente,
       round(i.quantidade::numeric, 4) AS garrafas, i."unidadeMedida"
  FROM "IngredienteReceita" i
  JOIN "Receita" r ON r.id = i."receitaId"
  JOIN "Produto" pr ON pr.id = i."produtoId"
 WHERE i.id = 'ingdk-highball-agua';
