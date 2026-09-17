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

-- Conferência desta casa. Esperado: com_codigo = 16.
SELECT count(*) AS itens_de_venda, count(iv."codigoPdv") AS com_codigo
FROM "ItemVenda" iv JOIN "Unidade" un ON un.id = iv."unidadeId"
WHERE un.nome = 'Wine Garden';
