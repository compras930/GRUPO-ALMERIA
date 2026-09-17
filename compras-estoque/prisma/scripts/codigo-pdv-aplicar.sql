-- Preenche ItemVenda.codigoPdv nas 4 casas com os códigos que casam por nome
-- EXATO contra a exportação de venda de setembro/2026.
--
-- Gerado por: npx tsx prisma/scripts/backfill-codigo-pdv.ts "<casa>" <planilha> --sql
-- Não edite à mão: regere se a planilha mudar.
--
-- Pré-requisito: a migration 20260917150000_item_venda_codigo_pdv já aplicada
-- (sem a coluna, estes comandos falham na hora, sem estragar nada).
--
-- Seguro reexecutar: só grava onde codigoPdv está NULL, e recusa qualquer nome
-- que exista duas vezes na mesma casa.

-- 104 Sul — 50 códigos
WITH mapa(casa, item, codigo) AS (VALUES
  ('104 Sul', 'Eggs Bacon', '700005000091'),
  ('104 Sul', 'Cappuccino Tradicional', '905045000012'),
  ('104 Sul', 'Coado', '905045000016'),
  ('104 Sul', 'Salada de Frutas', '700005000095'),
  ('104 Sul', 'Croque Monsieur', '700005000089'),
  ('104 Sul', 'Croque Madame', '700005000090'),
  ('104 Sul', 'Misto Quente', '700005000092'),
  ('104 Sul', 'Queijo Quente', '700005000093'),
  ('104 Sul', 'Pão na Chapa Vegano', '700005000097'),
  ('104 Sul', 'Pão na Chapa Cremoso', '700005000098'),
  ('104 Sul', 'Panqueca de Morango e Pistache', '700010000097'),
  ('104 Sul', 'Apple French Toast', '700010000099'),
  ('104 Sul', 'Vegantoast', '705000000096'),
  ('104 Sul', 'Pastrami Fries', '726000000097'),
  ('104 Sul', 'Vegan Bowl', '730001000098'),
  ('104 Sul', 'Salmão Bowl', '730001000099'),
  ('104 Sul', 'Fit Peito de Frango', '735000000001'),
  ('104 Sul', 'PF do Casa', '735000000094'),
  ('104 Sul', 'Frango à Parmegiana', '735000000098'),
  ('104 Sul', 'Picadinho do Casa', '735000000099'),
  ('104 Sul', 'Mimosa', '900100009117'),
  ('104 Sul', 'Gin Tônica', '900100009199'),
  ('104 Sul', 'Suco de Abacaxi', '905020000001'),
  ('104 Sul', 'Limonada Suiça', '905020000006'),
  ('104 Sul', 'Suco Rosa', '905020000008'),
  ('104 Sul', 'Suco Verde', '905020000009'),
  ('104 Sul', 'Chá Verde', '905025000006'),
  ('104 Sul', 'Chá Verde e Hortelã', '905025000007'),
  ('104 Sul', 'Chocolate quente', '905045000000'),
  ('104 Sul', 'Cappuccino de Pistache', '905045000011'),
  ('104 Sul', 'Cappuccino Vegano', '905045000013'),
  ('104 Sul', 'Macchiato', '905045000020'),
  ('104 Sul', 'Prensa Francesa', '905045000022'),
  ('104 Sul', 'Chococcino', '905045000099'),
  ('104 Sul', 'Caramelo Latte', '905045000594'),
  ('104 Sul', 'Almeria Coffee', '905045000595'),
  ('104 Sul', 'Cold Capim Limão', '905045000596'),
  ('104 Sul', 'CTT Cold Brew', '905045000597'),
  ('104 Sul', 'Cold Brew Puro', '905045000598'),
  ('104 Sul', 'Apple Lemonade', '905067000001'),
  ('104 Sul', 'Berry Lime', '905067000002'),
  ('104 Sul', 'Espresso Tônica', '905045000599'),
  ('104 Sul', 'Salada Gravlax', '730000001099'),
  ('104 Sul', 'GT Clássico', '900100009102'),
  ('104 Sul', 'Negroni', '900100009107'),
  ('104 Sul', 'Baileys Coffee', '900100009125'),
  ('104 Sul', 'Cosmo', '905067000003'),
  ('104 Sul', 'Fit Bombom de Alcatra', '735000000014'),
  ('104 Sul', 'Kir Royal', '900100009118'),
  ('104 Sul', 'Soda Almeria', '905067000007')
)
UPDATE "ItemVenda" iv
SET "codigoPdv" = m.codigo
FROM mapa m
JOIN "Unidade" un ON un.nome = m.casa
WHERE iv."unidadeId" = un.id
  AND lower(btrim(iv.nome)) = lower(btrim(m.item))
  AND iv."codigoPdv" IS NULL          -- nunca sobrescreve código já gravado
  AND 1 = (SELECT count(*) FROM "ItemVenda" x
            WHERE x."unidadeId" = un.id
              AND lower(btrim(x.nome)) = lower(btrim(m.item)));


-- Wine Garden — 16 códigos
WITH mapa(casa, item, codigo) AS (VALUES
  ('Wine Garden', 'Salada do Wine', '751000000096'),
  ('Wine Garden', 'Chan de Rosas Albariño Clássico', '900001000024'),
  ('Wine Garden', 'Casa Perini Vintage Blanc de Noir Brut', '900001000311'),
  ('Wine Garden', 'Aperol Spritz', '900100009101'),
  ('Wine Garden', 'Caipirinha', '900100009108'),
  ('Wine Garden', 'Fitzgerald', '900100009112'),
  ('Wine Garden', 'Kir Royal', '900100009118'),
  ('Wine Garden', 'Shot de Limão', '905020000010'),
  ('Wine Garden', 'Negroni', '900100009107'),
  ('Wine Garden', 'Gin Tônica', '900100009199'),
  ('Wine Garden', 'Marques de Tomares Excellence Rioja DOC', '900001000663'),
  ('Wine Garden', 'Tom Collins', '900100009116'),
  ('Wine Garden', 'Tabalí Pedregoso Gran Reserva Chardonnay', '900001000109'),
  ('Wine Garden', 'Whispering Angel', '900001001311'),
  ('Wine Garden', 'Suco de Maracuja', '905020000014'),
  ('Wine Garden', 'Tabalí Pedregoso Gran Reserva Cabernet Sauvignon', '900001000869')
)
UPDATE "ItemVenda" iv
SET "codigoPdv" = m.codigo
FROM mapa m
JOIN "Unidade" un ON un.nome = m.casa
WHERE iv."unidadeId" = un.id
  AND lower(btrim(iv.nome)) = lower(btrim(m.item))
  AND iv."codigoPdv" IS NULL          -- nunca sobrescreve código já gravado
  AND 1 = (SELECT count(*) FROM "ItemVenda" x
            WHERE x."unidadeId" = un.id
              AND lower(btrim(x.nome)) = lower(btrim(m.item)));


-- Noroeste — 49 códigos
WITH mapa(casa, item, codigo) AS (VALUES
  ('Noroeste', 'Panqueca de Morango e Pistache', '700010000097'),
  ('Noroeste', 'Cappuccino Vegano', '905045000013'),
  ('Noroeste', 'Coado', '905045000016'),
  ('Noroeste', 'Cappuccino de Pistache', '905045000011'),
  ('Noroeste', 'Chá Verde e Hortelã', '905025000007'),
  ('Noroeste', 'GT Clássico', '900100009102'),
  ('Noroeste', 'Croque Madame', '700005000090'),
  ('Noroeste', 'Misto Quente', '700005000092'),
  ('Noroeste', 'Vegan Bowl', '730001000098'),
  ('Noroeste', 'Fit Peito de Frango', '735000000001'),
  ('Noroeste', 'Fit Bombom de Alcatra', '735000000014'),
  ('Noroeste', 'PF do Casa', '735000000094'),
  ('Noroeste', 'Frango à Parmegiana', '735000000098'),
  ('Noroeste', 'Picadinho do Casa', '735000000099'),
  ('Noroeste', 'Suco de Abacaxi', '905020000001'),
  ('Noroeste', 'Vegantoast', '705000000096'),
  ('Noroeste', 'Eggs Bacon', '700005000091'),
  ('Noroeste', 'Queijo Quente', '700005000093'),
  ('Noroeste', 'Salada de Frutas', '700005000095'),
  ('Noroeste', 'Pão na Chapa Cremoso', '700005000098'),
  ('Noroeste', 'Salada Gravlax', '730000001099'),
  ('Noroeste', 'Croque Monsieur', '700005000089'),
  ('Noroeste', 'Salmão Bowl', '730001000099'),
  ('Noroeste', 'Pão na Chapa Vegano', '700005000097'),
  ('Noroeste', 'Negroni', '900100009107'),
  ('Noroeste', 'Mimosa', '900100009117'),
  ('Noroeste', 'Limonada Suiça', '905020000006'),
  ('Noroeste', 'Suco Rosa', '905020000008'),
  ('Noroeste', 'Chocolate quente', '905045000000'),
  ('Noroeste', 'Cappuccino Tradicional', '905045000012'),
  ('Noroeste', 'Chococcino', '905045000099'),
  ('Noroeste', 'Caramelo Latte', '905045000594'),
  ('Noroeste', 'Espresso Tônica', '905045000599'),
  ('Noroeste', 'Berry Lime', '905067000002'),
  ('Noroeste', 'Cosmo', '905067000003'),
  ('Noroeste', 'Pastrami Fries', '726000000097'),
  ('Noroeste', 'Kir Royal', '900100009118'),
  ('Noroeste', 'Suco Verde', '905020000009'),
  ('Noroeste', 'Macchiato', '905045000020'),
  ('Noroeste', 'Prensa Francesa', '905045000022'),
  ('Noroeste', 'CTT Cold Brew', '905045000597'),
  ('Noroeste', 'Cold Brew Puro', '905045000598'),
  ('Noroeste', 'Soda Almeria', '905067000007'),
  ('Noroeste', 'Apple French Toast', '700010000099'),
  ('Noroeste', 'Chá Verde', '905025000006'),
  ('Noroeste', 'Almeria Coffee', '905045000595'),
  ('Noroeste', 'Cold Capim Limão', '905045000596'),
  ('Noroeste', 'Apple Lemonade', '905067000001'),
  ('Noroeste', 'Baileys Coffee', '900100009125')
)
UPDATE "ItemVenda" iv
SET "codigoPdv" = m.codigo
FROM mapa m
JOIN "Unidade" un ON un.nome = m.casa
WHERE iv."unidadeId" = un.id
  AND lower(btrim(iv.nome)) = lower(btrim(m.item))
  AND iv."codigoPdv" IS NULL          -- nunca sobrescreve código já gravado
  AND 1 = (SELECT count(*) FROM "ItemVenda" x
            WHERE x."unidadeId" = un.id
              AND lower(btrim(x.nome)) = lower(btrim(m.item)));


-- Beira Lago — 26 códigos
WITH mapa(casa, item, codigo) AS (VALUES
  ('Beira Lago', 'Couvert', '70039502351'),
  ('Beira Lago', 'Steak Caviar', '70039502522'),
  ('Beira Lago', 'Camarão à Provençal', '70039501905'),
  ('Beira Lago', 'Tapas de Pulpo', '70039501898'),
  ('Beira Lago', 'Burrata Artesanal', '70039501902'),
  ('Beira Lago', 'Kibe Cru', '70039501903'),
  ('Beira Lago', 'Les Frites', '70039501904'),
  ('Beira Lago', 'Carpaccio e Grana Padano', '70039501907'),
  ('Beira Lago', 'Tartare de Atum', '70039502518'),
  ('Beira Lago', 'Spaghetti alla Norma', '70039502528'),
  ('Beira Lago', 'Rigatoni All''Amatriciana', '70039501910'),
  ('Beira Lago', 'Filetto di Manzo', '70039501916'),
  ('Beira Lago', 'T-Bone alla Fiorentina', '70039501919'),
  ('Beira Lago', 'Fideuá de Gambas', '70039501920'),
  ('Beira Lago', 'Robalo au Beurre Blanc', '70039501923'),
  ('Beira Lago', 'Polpo alla Griglia', '70039501925'),
  ('Beira Lago', 'Spaghetti al Mare', '70039502350'),
  ('Beira Lago', 'Bacalhau à Lagareiro', '70039502529'),
  ('Beira Lago', 'Ravioli d''Ossobuco', '70039501913'),
  ('Beira Lago', 'Paella Almeria', '70039501921'),
  ('Beira Lago', 'Tonno in Crosta di Pistacchio', '70039501926'),
  ('Beira Lago', 'Steak au Poivre', '70039502349'),
  ('Beira Lago', 'Melanzane', '70039502519'),
  ('Beira Lago', 'Gnocchetti al Ragu Bianco', '70039501909'),
  ('Beira Lago', 'Frios Artesanais', '70039502359'),
  ('Beira Lago', 'Filet Rossini', '70039501917')
)
UPDATE "ItemVenda" iv
SET "codigoPdv" = m.codigo
FROM mapa m
JOIN "Unidade" un ON un.nome = m.casa
WHERE iv."unidadeId" = un.id
  AND lower(btrim(iv.nome)) = lower(btrim(m.item))
  AND iv."codigoPdv" IS NULL          -- nunca sobrescreve código já gravado
  AND 1 = (SELECT count(*) FROM "ItemVenda" x
            WHERE x."unidadeId" = un.id
              AND lower(btrim(x.nome)) = lower(btrim(m.item)));


-- ---------------------------------------------------------------------------
-- Verificação. Esperado: 50 / 16 / 49 / 26 — total 141.
-- ---------------------------------------------------------------------------
SELECT un.nome AS casa,
       count(*)                                        AS itens_de_venda,
       count(iv."codigoPdv")                           AS com_codigo,
       count(*) FILTER (WHERE iv."receitaId" IS NOT NULL AND iv."codigoPdv" IS NOT NULL) AS com_codigo_e_ficha
FROM "ItemVenda" iv
JOIN "Unidade" un ON un.id = iv."unidadeId"
GROUP BY un.nome
ORDER BY un.nome;
