-- De onde vêm as categorias duplicadas do painel de vendas. SÓ LÊ.
--
-- O QUE SE VÊ NO PAINEL: TINTO e Tintos, BRANCO e Brancos, ESPUMANTE e
-- Espumante, ROSÉ e Rosé, ENTRADAS e Entradas — e ainda VINHOS, um terceiro
-- balde de vinho. São duas convenções de nome convivendo (MAIÚSCULA e
-- Capitalizada), e o painel agrupa pelo texto exato, então cada convenção vira
-- uma barra.
--
-- A HIPÓTESE QUE ESTAS CONSULTAS TESTAM: as duas convenções têm origens
-- diferentes. Os itens cadastrados pela carga do XMenu (os que têm
-- `codigoPdv`) herdaram o grupo do export; os que já existiam antes vieram do
-- cadastro antigo, com outra convenção. Se for isso, a coluna `com_codigo_pdv`
-- separa as duas quase perfeitamente — e o conserto é um mapa de para-onde-vai
-- cada nome, rodado uma vez.
--
-- MENU, com 29,9% do faturamento, é outro problema e não é duplicação: é um
-- balde genérico que engoliu um terço da venda. A consulta 3 mostra o que tem
-- dentro, pra decidir se ele se quebra em categorias de verdade.

-- =====================================================================
-- 1. AS CATEGORIAS, com origem e tamanho.
--
-- `com_codigo_pdv` = itens que vieram da carga do XMenu.
-- `sem_codigo_pdv` = itens que já estavam no cadastro antes.
-- Categoria com os dois > 0 é categoria que as duas convenções usam.
-- =====================================================================
SELECT COALESCE(iv.categoria, '(nulo)') AS categoria,
       iv.tipo,
       count(*) AS itens,
       count(*) FILTER (WHERE iv."codigoPdv" IS NOT NULL) AS com_codigo_pdv,
       count(*) FILTER (WHERE iv."codigoPdv" IS NULL) AS sem_codigo_pdv,
       count(*) FILTER (WHERE iv."receitaId" IS NOT NULL) AS com_ficha,
       round(COALESCE(sum(v.faturamento), 0)::numeric, 2) AS vendido_em_outubro
FROM "ItemVenda" iv
JOIN "Unidade" u ON u.id = iv."unidadeId" AND u.nome = 'Beira Lago'
LEFT JOIN LATERAL (
  SELECT sum(COALESCE(ivs."valorVendido", ivs."quantidadeVendida" * iv."precoVenda")) AS faturamento
  FROM "ItemVendaSemanal" ivs
  JOIN "VendaSemanal" vs ON vs.id = ivs."vendaSemanalId"
  WHERE ivs."itemVendaId" = iv.id
    AND vs."periodoFim" >= DATE '2026-10-01'
    AND vs."periodoFim" < DATE '2026-11-01'
) v ON true
GROUP BY 1, 2
ORDER BY vendido_em_outubro DESC;

-- =====================================================================
-- 2. OS PARES SUSPEITOS, lado a lado.
--
-- Junta pelo nome normalizado (sem caixa, sem acento, sem o "s" do plural):
-- se duas categorias caem na mesma chave, são a mesma coisa escrita de dois
-- jeitos. É esta lista que vira o mapa do conserto.
-- =====================================================================
WITH cat AS (
  SELECT DISTINCT iv.categoria,
         regexp_replace(
           lower(translate(btrim(iv.categoria), 'ÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç', 'aaaaeeioooucaaaaeeiooouc')),
           's$', ''
         ) AS chave
  FROM "ItemVenda" iv
  JOIN "Unidade" u ON u.id = iv."unidadeId" AND u.nome = 'Beira Lago'
  WHERE iv.categoria IS NOT NULL AND btrim(iv.categoria) <> ''
)
SELECT chave AS mesma_coisa,
       count(*) AS escritas_diferentes,
       string_agg(categoria, '  |  ' ORDER BY categoria) AS como_esta_escrito
FROM cat
GROUP BY chave
HAVING count(*) > 1
ORDER BY escritas_diferentes DESC, chave;

-- =====================================================================
-- 3. O QUE TEM DENTRO DE "MENU" (e dos outros baldes genéricos).
--
-- 20 itens mais vendidos de cada um. Se vierem pratos de tipos diferentes —
-- carne, massa, peixe —, MENU não é categoria, é ausência de categoria com
-- outro nome, e vale quebrar.
-- =====================================================================
SELECT iv.categoria,
       iv.nome AS item,
       iv.tipo,
       round(iv."precoVenda"::numeric, 2) AS preco,
       round(COALESCE(sum(COALESCE(ivs."valorVendido", ivs."quantidadeVendida" * iv."precoVenda")), 0)::numeric, 2) AS vendido
FROM "ItemVenda" iv
JOIN "Unidade" u ON u.id = iv."unidadeId" AND u.nome = 'Beira Lago'
LEFT JOIN "ItemVendaSemanal" ivs ON ivs."itemVendaId" = iv.id
LEFT JOIN "VendaSemanal" vs ON vs.id = ivs."vendaSemanalId"
  AND vs."periodoFim" >= DATE '2026-10-01' AND vs."periodoFim" < DATE '2026-11-01'
WHERE upper(btrim(iv.categoria)) IN ('MENU', 'SERVICOS', 'SERVIÇOS', 'TAXAS', 'PRINCIPAIS')
GROUP BY 1, 2, 3, 4
ORDER BY iv.categoria, vendido DESC
LIMIT 60;
