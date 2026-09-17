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

-- Conferência desta casa. Esperado: com_codigo = 49.
SELECT count(*) AS itens_de_venda, count(iv."codigoPdv") AS com_codigo
FROM "ItemVenda" iv JOIN "Unidade" un ON un.id = iv."unidadeId"
WHERE un.nome = 'Noroeste';
