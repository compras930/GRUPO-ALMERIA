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

-- Conferência desta casa. Esperado: com_codigo = 26.
SELECT count(*) AS itens_de_venda, count(iv."codigoPdv") AS com_codigo
FROM "ItemVenda" iv JOIN "Unidade" un ON un.id = iv."unidadeId"
WHERE un.nome = 'Beira Lago';
