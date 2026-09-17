-- Noroeste — 3 pares confirmados na planilha de conferência.
-- Cada linha é um item que o PDV vende com um nome e o sistema tem com outro,
-- confirmado como o mesmo prato pelo setor de compras.
--
-- Categoria vazia = casa só pelo nome, e só se o nome for único na casa.
-- Só grava onde o código ainda está vazio. Seguro reexecutar.
WITH mapa(casa, item, codigo, categoria) AS (VALUES
  ('Noroeste', 'Ovos Mexidos Cremosos', '700005000096', ''),
  ('Noroeste', 'Mineirinho', '700000000099', ''),
  ('Noroeste', 'Panqueca Banana e Caramelo', '700010000098', '')
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
WHERE un.nome = 'Noroeste';
