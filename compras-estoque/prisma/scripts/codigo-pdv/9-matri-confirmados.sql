-- Matri — 22 pares confirmados.
--
-- O grupo MATRI vem DENTRO do export do Noroeste (as duas casas lançam no mesmo
-- Teknisa), e no primeiro casamento eu comparei essas linhas contra o cardápio
-- do Noroeste — nunca contra os 175 itens do Matri. Por isso R$ 81 mil tinham
-- caído em "não cadastrado".
--
-- Quatro pares vão além do que foi confirmado na planilha, e o motivo está no
-- preço. As pizzas doces são vendidas em dois tamanhos e o cadastro já tem os
-- dois — "Torta di Mela" (R$ 120) e "Torta di Mela (P)" (R$ 78). Meu casamento
-- por semelhança mandou as duas versões pro item sem sufixo. Corrigido aqui, e
-- no caminho apareceram NOCCIOLA e BANANA, que não tinham entrado na planilha
-- por semelhança baixa. O preço médio no PDV confirma a divisão: G entre
-- R$ 105 e R$ 129, P entre R$ 77 e R$ 88.
--
-- Só grava onde o código ainda está vazio, e recusa nome que exista duas vezes
-- na casa. Seguro reexecutar.
WITH mapa(casa, item, codigo) AS (VALUES
  ('Matri', 'Calabresa', '715000000004'),
  ('Matri', 'Margherita', '715000000009'),
  ('Matri', 'aMATRIciana', '715000000001'),
  ('Matri', 'Prosciutto & Rucola', '715000000013'),
  ('Matri', 'Quattro Formaggi', '715000000000'),
  ('Matri', 'Cabríssima & Figo', '715000000002'),
  ('Matri', 'Pepperoni', '715000000012'),
  ('Matri', 'Carbonara Moderna', '715000000006'),
  ('Matri', 'Carciofini', '715000000007'),
  ('Matri', 'Mortadella & Pistacchio', '715000000011'),
  ('Matri', 'Zucchine & Brie', '715000000016'),
  ('Matri', 'Gnocchi Trufado', '715000000702'),
  ('Matri', 'Gnocchi all''Amatriciana', '715000000701'),
  ('Matri', 'Pistacchio & Frutti di Bosco (P)', '715000000507'),
  ('Matri', 'Torta di Mela (P)', '715000000509'),
  ('Matri', 'Pistacchio & Frutti di Bosco', '715000000505'),
  ('Matri', 'Nocciola', '715000000504'),
  ('Matri', 'Banana (P)', '715000000511'),
  ('Matri', 'Nocciola (P)', '715000000508'),
  ('Matri', 'Banana', '715000000510'),
  ('Matri', 'Torta di Mela', '715000000502'),
  ('Matri', 'Tonno & Cipolla', '715000000014')
)
UPDATE "ItemVenda" iv
SET "codigoPdv" = m.codigo
FROM mapa m
JOIN "Unidade" un ON un.nome = m.casa
WHERE iv."unidadeId" = un.id
  AND lower(btrim(iv.nome)) = lower(btrim(m.item))
  AND iv."codigoPdv" IS NULL
  AND 1 = (SELECT count(*) FROM "ItemVenda" x
            WHERE x."unidadeId" = un.id
              AND lower(btrim(x.nome)) = lower(btrim(m.item)));

-- Conferência. Esperado: com_codigo = 22.
SELECT count(*) AS itens_de_venda, count(iv."codigoPdv") AS com_codigo
FROM "ItemVenda" iv JOIN "Unidade" un ON un.id = iv."unidadeId"
WHERE un.nome = 'Matri';
