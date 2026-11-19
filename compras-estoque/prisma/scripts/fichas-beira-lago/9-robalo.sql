-- O robalo: um peixe, dois cadastros, quatro fichas sem ele. Beira Lago.
--
-- O QUE A CONSULTA MOSTROU:
--   ROBALO FILÉ    19 compras, 8 contagens, 67,4 kg em estoque — é o de verdade.
--   ROBALO FILE    0 compras, 0 contagens, 0 saldo, e 3 fichas usando. O mesmo
--                  peixe cadastrado de novo sem o acento: esses 3 pratos baixam
--                  zero e custam zero, sem ninguém ver.
--   ROBALO GRELHADO  saldo −260,48 kg. FICA DE FORA DESTE SQL — ver no fim.
--
-- E a planilha do chef chama o peixe de ROBALO CRU, nome que não existe no
-- cadastro. Por isso a linha do robalo não entrou em quatro fichas.
--
-- NÃO USA OS ids TRANSCRITOS DA TELA. Os dois cadastros são escolhidos pelo
-- que eles SÃO — o que tem compra fica, o que não tem compra, nem saldo, nem
-- contagem é o duplicado. Copiar id de captura de tela é o tipo de erro que
-- ninguém revisa e que aponta a ficha para o produto errado.
--
-- SEGURO REPETIR: na segunda vez não há mais nada para mover.

BEGIN;

-- 1. As fichas que usam o cadastro duplicado passam a usar o de verdade.
WITH robalos AS (
  SELECT p.id,
         (SELECT count(*) FROM "ItemNotaCompra"   i WHERE i."produtoId" = p.id) AS compras,
         (SELECT count(*) FROM "EstoqueSaldo"     s WHERE s."produtoId" = p.id) AS saldos,
         (SELECT count(*) FROM "ContagemEstoque"  c WHERE c."produtoId" = p.id) AS contagens
    FROM "Produto" p
   WHERE upper(regexp_replace(translate(btrim(p.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g')) = 'ROBALO FILE'
),
fica AS (SELECT id FROM robalos WHERE compras > 0),
sai  AS (SELECT id FROM robalos WHERE compras = 0 AND saldos = 0 AND contagens = 0)
UPDATE "IngredienteReceita" g
   SET "produtoId" = (SELECT id FROM fica)
 WHERE g."produtoId" IN (SELECT id FROM sai)
   -- Só mexe se a leitura for inequívoca: um que fica, e o que sai não é ele.
   AND (SELECT count(*) FROM fica) = 1
   AND (SELECT count(*) FROM sai) >= 1;

-- 2. O robalo que a planilha pede e que não entrou em quatro fichas.
--    "ROBALO CRU" na planilha é o ROBALO FILÉ do cadastro.
INSERT INTO "IngredienteReceita" ("id", "receitaId", "produtoId", "subReceitaId", "quantidade", "unidadeMedida")
SELECT v.id, r.id, (SELECT p.id FROM "Produto" p
                     WHERE upper(regexp_replace(translate(btrim(p.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g')) = 'ROBALO FILE'
                       AND (SELECT count(*) FROM "ItemNotaCompra" i WHERE i."produtoId" = p.id) > 0
                     LIMIT 1),
       NULL, v.quantidade, 'KG'
  FROM (VALUES
    ('ingfix-caldeirada-robalo', 'CALDEIRADA MEDITERRANEA',     0.05),
    ('ingfix-pagina1-robalo',    'PAGINA1',                     0.06),
    ('ingfix-farce-robalo',      'SB FARCE TERRINE',            0.6),
    ('ingfix-bolinhopeixe-robalo','SB MASSA BOLINHO DE PEIXE',  6.0)
  ) AS v(id, chave_ficha, quantidade)
  JOIN "Unidade" u ON u.nome = 'Beira Lago'
  JOIN "Receita" r ON r."unidadeId" = u.id
                  AND upper(regexp_replace(translate(btrim(r.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g')) = v.chave_ficha
 WHERE EXISTS (SELECT 1 FROM "Produto" p
                WHERE upper(regexp_replace(translate(btrim(p.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g')) = 'ROBALO FILE'
                  AND (SELECT count(*) FROM "ItemNotaCompra" i WHERE i."produtoId" = p.id) > 0)
ON CONFLICT ("id") DO UPDATE
   SET "receitaId" = EXCLUDED."receitaId",
       "produtoId" = EXCLUDED."produtoId",
       "quantidade" = EXCLUDED."quantidade",
       "unidadeMedida" = EXCLUDED."unidadeMedida";

-- 3. O cadastro duplicado sai de circulação — só depois de ninguém mais usar.
--    Desativa, não apaga: o histórico dele continua existindo.
WITH robalos AS (
  SELECT p.id,
         (SELECT count(*) FROM "ItemNotaCompra"  i WHERE i."produtoId" = p.id) AS compras,
         (SELECT count(*) FROM "EstoqueSaldo"    s WHERE s."produtoId" = p.id) AS saldos,
         (SELECT count(*) FROM "ContagemEstoque" c WHERE c."produtoId" = p.id) AS contagens,
         (SELECT count(*) FROM "IngredienteReceita" g WHERE g."produtoId" = p.id) AS fichas
    FROM "Produto" p
   WHERE upper(regexp_replace(translate(btrim(p.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g')) = 'ROBALO FILE'
)
UPDATE "Produto" p
   SET ativo = false
  FROM robalos b
 WHERE p.id = b.id
   AND b.compras = 0 AND b.saldos = 0 AND b.contagens = 0 AND b.fichas = 0;

COMMIT;

-- Conferência 1: como ficaram os robalos do cadastro.
SELECT p.nome, p.ativo, p."unidadeMedida",
       (SELECT count(*) FROM "ItemNotaCompra" i WHERE i."produtoId" = p.id)     AS compras,
       (SELECT count(*) FROM "IngredienteReceita" g WHERE g."produtoId" = p.id) AS usado_em_fichas
  FROM "Produto" p
 WHERE p.nome ILIKE '%robalo%'
 ORDER BY p.ativo DESC, 4 DESC;

-- Conferência 2: as quatro fichas que estavam sem o peixe.
SELECT r.nome AS ficha, pr.nome AS ingrediente, g.quantidade, g."unidadeMedida"
  FROM "IngredienteReceita" g
  JOIN "Receita" r ON r.id = g."receitaId"
  LEFT JOIN "Produto" pr ON pr.id = g."produtoId"
 WHERE g.id LIKE 'ingfix-%robalo'
 ORDER BY 1;

-- FICA PENDENTE, E DE PROPÓSITO: ROBALO GRELHADO, saldo −260,48 kg.
-- Estoque negativo aí não é erro de contagem: é ficha baixando de um produto
-- em que nunca entra nada, porque ninguém compra robalo grelhado. Grelhado é
-- preparo. O certo é ele virar ficha — ROBALO FILÉ mais o rendimento da
-- grelha, que tem perda de água — e os pratos passarem a usar essa ficha.
-- Quanto 1 kg de filé rende grelhado é número que só a cozinha tem, e chutar
-- aqui erraria o custo de todos os pratos de robalo de uma vez.
