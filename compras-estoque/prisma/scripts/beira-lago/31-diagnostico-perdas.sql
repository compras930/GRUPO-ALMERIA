-- Por que a baixa de prato/drink não lista nada no Beira Lago.
--
-- A tela só oferece item de venda que TEM ficha técnica: sem ficha, a ação
-- não tem como saber o que sai da despensa quando o prato volta, e oferecer
-- na lista para depois recusar é fazer a pessoa digitar duas vezes para ouvir
-- não.
--
-- Se a lista está vazia, a causa é uma destas três, e esta consulta diz qual.
-- Só LÊ, não muda nada.

-- 1. Quantos itens ativos, quantos com ficha. É o número que decide tudo.
SELECT 'resumo' AS parte,
       count(*) FILTER (WHERE iv.ativo) AS itens_ativos,
       count(*) FILTER (WHERE iv.ativo AND iv."receitaId" IS NOT NULL) AS ativos_com_ficha,
       count(*) FILTER (WHERE NOT iv.ativo) AS inativos,
       count(*) AS total
FROM "ItemVenda" iv
JOIN "Unidade" u ON u.id = iv."unidadeId"
WHERE u.nome = 'Beira Lago';

-- 2. Por tipo: prato, bebida, vinho. Se PRATO tem ficha e BEBIDA não, a tela
--    está certa e o que falta é ficha de drink.
SELECT 'por tipo' AS parte,
       iv.tipo,
       count(*) FILTER (WHERE iv.ativo) AS ativos,
       count(*) FILTER (WHERE iv.ativo AND iv."receitaId" IS NOT NULL) AS com_ficha
FROM "ItemVenda" iv
JOIN "Unidade" u ON u.id = iv."unidadeId"
WHERE u.nome = 'Beira Lago'
GROUP BY iv.tipo
ORDER BY ativos DESC;

-- 3. Existem receitas cadastradas na casa, mas não ligadas a item nenhum?
--    Esse é o caso que mais engana: a ficha existe, a tela não a vê, porque
--    quem liga as duas é `ItemVenda.receitaId` e ele está vazio.
SELECT 'receitas da casa' AS parte,
       count(*) AS receitas,
       count(*) FILTER (WHERE NOT EXISTS (
         SELECT 1 FROM "ItemVenda" iv WHERE iv."receitaId" = r.id
       )) AS sem_item_apontando
FROM "Receita" r
JOIN "Unidade" u ON u.id = r."unidadeId"
WHERE u.nome = 'Beira Lago';

-- 4. Os 10 itens ativos que mais venderam em outubro E não têm ficha. É a
--    fila de fichas a escrever, em ordem de quanto custa não ter.
SELECT 'fila de fichas' AS parte,
       iv.nome, iv.tipo, iv.categoria,
       round(sum(ivs."valorVendido")::numeric, 2) AS vendeu_em_outubro
FROM "ItemVendaSemanal" ivs
JOIN "ItemVenda" iv ON iv.id = ivs."itemVendaId"
JOIN "Unidade" u ON u.id = iv."unidadeId"
JOIN "VendaSemanal" vs ON vs.id = ivs."vendaSemanalId"
WHERE u.nome = 'Beira Lago'
  AND iv.ativo
  AND iv."receitaId" IS NULL
  AND vs."periodoInicio" >= DATE '2026-10-01'
  AND vs."periodoFim"   <= DATE '2026-10-31'
GROUP BY iv.nome, iv.tipo, iv.categoria
ORDER BY vendeu_em_outubro DESC NULLS LAST
LIMIT 10;
