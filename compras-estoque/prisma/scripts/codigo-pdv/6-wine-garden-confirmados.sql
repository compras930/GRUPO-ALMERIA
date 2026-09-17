-- Wine Garden — 40 pares confirmados na planilha de conferência.
-- Cada linha é um item que o PDV vende com um nome e o sistema tem com outro,
-- confirmado como o mesmo prato pelo setor de compras.
--
-- 4 linha(s) trazem categoria: o nome existe DUAS vezes nesta casa
-- (taça e garrafa do mesmo vinho, ou o mesmo prato em dois cardápios).
-- A categoria diz qual dos dois recebe o código.
--
-- Categoria vazia = casa só pelo nome, e só se o nome for único na casa.
-- Só grava onde o código ainda está vazio. Seguro reexecutar.
WITH mapa(casa, item, codigo, categoria) AS (VALUES
  ('Wine Garden', 'Salmão Garden', '751000000120', ''),
  ('Wine Garden', 'Robata de Cupim', '751000000087', ''),
  ('Wine Garden', 'Burrata de Bottega', '751000000091', ''),
  ('Wine Garden', 'TABUA DE SALUMERIA', '751000000082', ''),
  ('Wine Garden', 'Pancetta com Creme de Couve-Flor', '751000000125', ''),
  ('Wine Garden', 'Salada Caesar', '751000000080', ''),
  ('Wine Garden', 'PANI E ANTIPASTI', '751000000099', ''),
  ('Wine Garden', 'Croqueta de Pato', '751000000089', ''),
  ('Wine Garden', 'Crudo de Atum', '751000000000', ''),
  ('Wine Garden', 'Máscara de Fuego Carménère', '900001000665', ''),
  ('Wine Garden', 'Moscow Mule', '900100009410', ''),
  ('Wine Garden', 'Michele Carraro Cabernet Franc', '900001000881', ''),
  ('Wine Garden', 'Intensamente Chocolate', '751000000203', ''),
  ('Wine Garden', 'Champs Elysées', '900100009401', ''),
  ('Wine Garden', 'Stemmari Pinot Grigio DOC Sicilia', '900001000167', ''),
  ('Wine Garden', 'Robata de Língua', '751000000086', ''),
  ('Wine Garden', 'Mas Andes Reserva Rosé', '900001000216', ''),
  ('Wine Garden', 'Suppli al Telefono', '751000000088', 'Tapas'),
  ('Wine Garden', 'Cala Rey Tempranillo - Syrah', '900001000871', 'Vinhos'),
  ('Wine Garden', 'Garden Sour', '900100009416', ''),
  ('Wine Garden', 'Collezione Rosato IGT Toscana', '900001000242', ''),
  ('Wine Garden', 'Toscanini Reserve Tannat', '900001001307', ''),
  ('Wine Garden', 'Cave Amadeu Rosé Brut', '900001000320', ''),
  ('Wine Garden', 'Cobogó Sauvignon Blanc', '900001000032', ''),
  ('Wine Garden', 'Covela Avesso Vinho Verde DOC', '900001000036', ''),
  ('Wine Garden', 'Bourbon Lemonade', '900100009111', ''),
  ('Wine Garden', 'Piper-Heidsieck Cuvée Brut', '900001000334', ''),
  ('Wine Garden', 'Regia Colheita DOC Alentejo', '900001000199', ''),
  ('Wine Garden', 'Torta de Queso', '751000000201', ''),
  ('Wine Garden', 'Garzon Reserva Albariño', '900001000171', 'Vinhos'),
  ('Wine Garden', 'Ronan by Clinet AOC Bordeaux', '900001000754', ''),
  ('Wine Garden', 'Meandro do Vale Meão', '900001000668', ''),
  ('Wine Garden', 'Château Haura AOC Graves', '900001000872', ''),
  ('Wine Garden', 'Klet Brda Quercus Pinot Bianco', '900001000170', 'Vinhos'),
  ('Wine Garden', 'Le Rosé de Floridene', '900001000214', ''),
  ('Wine Garden', 'Muscadet de Sèvre et Maine Saget La Perrière', '900001000081', ''),
  ('Wine Garden', 'Abbotts & Delaunay Languedoc Rouge', '900001000886', ''),
  ('Wine Garden', 'Ladiva Tokaj Furmint Dry', '900001000051', ''),
  ('Wine Garden', 'Carajillo', '900100009106', ''),
  ('Wine Garden', 'Red Bull Sugarfree', '905005011198', '')
)
UPDATE "ItemVenda" iv
SET "codigoPdv" = m.codigo
FROM mapa m
JOIN "Unidade" un ON un.nome = m.casa
WHERE iv."unidadeId" = un.id
  AND lower(btrim(iv.nome)) = lower(btrim(m.item))
  AND (m.categoria = '' OR iv.categoria = m.categoria)
  AND iv."codigoPdv" IS NULL
  AND 1 = (SELECT count(*) FROM "ItemVenda" x
            WHERE x."unidadeId" = un.id
              AND lower(btrim(x.nome)) = lower(btrim(m.item))
              AND (m.categoria = '' OR x.categoria = m.categoria));

-- Conferência desta casa.
SELECT count(*) AS itens_de_venda, count(iv."codigoPdv") AS com_codigo
FROM "ItemVenda" iv JOIN "Unidade" un ON un.id = iv."unidadeId"
WHERE un.nome = 'Wine Garden';
