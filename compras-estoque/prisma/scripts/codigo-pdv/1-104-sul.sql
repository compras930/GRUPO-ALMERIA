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

-- Conferência desta casa. Esperado: com_codigo = 50.
SELECT count(*) AS itens_de_venda, count(iv."codigoPdv") AS com_codigo
FROM "ItemVenda" iv JOIN "Unidade" un ON un.id = iv."unidadeId"
WHERE un.nome = '104 Sul';
