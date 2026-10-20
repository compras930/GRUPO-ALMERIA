-- Por que o CMV de UM item de venda mudou depois de uma carga de compras.
--
-- Responde: "qual insumo fez o CMV do Spaghetti Almeria ir de 24,8% para
-- 30,8%" — com o número de cada um, não com um palpite.
--
-- SÓ LÊ. Nenhum passo escreve.
--
-- Troque o nome do item no passo 1. O resto segue dele.
--
-- COMO ISTO ACOMPANHA O APP. O custo não é guardado em lugar nenhum: a tela
-- recalcula na leitura a partir de PrecoAtualProduto (src/lib/cmv.ts,
-- custoDeReceita). Esta consulta repete a mesma conta em SQL:
--
--   custo por unidade = SOMA(quantidade_do_insumo x preço_atual) / rendimento
--
-- com a ficha explodida recursivamente (sub-receita dentro de sub-receita), e
-- o fator de lote de cada nível igual ao de explodirReceitaPura:
--
--   fator_do_filho = fator_do_pai x quantidade_da_subreceita / rendimento_dela
--
-- O preço segue a unidade FÍSICA (a despensa), não a casa — é o que
-- carregarPrecoAtualPorProduto faz. Por isso o JOIN usa COALESCE("estoqueEmId", id).

-- ---------------------------------------------------------------------------
-- 1. O item, a ficha e a última carga. Confira que achou UM item só.
-- ---------------------------------------------------------------------------
WITH alvo AS (
  SELECT iv.id, iv.nome, iv."precoVenda", iv."receitaId",
         COALESCE(u."estoqueEmId", u.id) AS despensa_id
  FROM "ItemVenda" iv
  JOIN "Unidade" u ON u.id = iv."unidadeId"
  WHERE lower(btrim(iv.nome)) = lower('Spaghetti Almeria')
)
SELECT a.nome, a."precoVenda", r.nome AS ficha, r."rendimentoQtd", d.nome AS despensa
FROM alvo a
LEFT JOIN "Receita" r ON r.id = a."receitaId"
JOIN "Unidade" d ON d.id = a.despensa_id;

-- ---------------------------------------------------------------------------
-- 2. A RESPOSTA: cada insumo da ficha, com o preço de antes e o de agora.
--
--    `delta_custo` é quanto aquele insumo sozinho acrescentou ao custo do
--    prato. Some a coluna e você tem a diferença inteira — quem está no topo
--    é o culpado.
--
--    "Antes" = o preço que valia antes da ÚLTIMA carga desta despensa, lido de
--    HistoricoPrecoProduto. Insumo com antes NULO é preço que nasceu agora:
--    antes dele o prato custava menos porque aquele insumo valia zero na
--    conta, não porque ficou mais barato. Isso sozinho explica salto de CMV.
-- ---------------------------------------------------------------------------
WITH RECURSIVE alvo AS (
  SELECT iv.id, iv.nome, iv."precoVenda", iv."receitaId",
         COALESCE(u."estoqueEmId", u.id) AS despensa_id
  FROM "ItemVenda" iv
  JOIN "Unidade" u ON u.id = iv."unidadeId"
  WHERE lower(btrim(iv.nome)) = lower('Spaghetti Almeria')
),
ultima_carga AS (
  SELECT n.id
  FROM "NotaCompra" n
  JOIN alvo a ON a.despensa_id = n."unidadeId"
  ORDER BY n."criadoEm" DESC
  LIMIT 1
),
-- Explosão recursiva da ficha. `fator` é quanto de UM lote da receita-raiz
-- cada nível representa; `caminho` existe só para barrar ciclo (a ficha do
-- bacalhau já apontou para si mesma uma vez — ver _corrigir-ciclo-bacalhau.ts).
explosao AS (
  SELECT r.id AS receita_id, 1.0::double precision AS fator,
         ARRAY[r.id] AS caminho
  FROM alvo a
  JOIN "Receita" r ON r.id = a."receitaId"
  UNION ALL
  SELECT sub.id,
         e.fator * ir.quantidade
           / CASE WHEN COALESCE(sub."rendimentoQtd", 0) > 0 THEN sub."rendimentoQtd" ELSE 1 END,
         e.caminho || sub.id
  FROM explosao e
  JOIN "IngredienteReceita" ir ON ir."receitaId" = e.receita_id
  JOIN "Receita" sub ON sub.id = ir."subReceitaId"
  WHERE NOT sub.id = ANY(e.caminho)
    AND array_length(e.caminho, 1) < 12
),
insumos AS (
  SELECT ir."produtoId", SUM(ir.quantidade * e.fator) AS quantidade
  FROM explosao e
  JOIN "IngredienteReceita" ir ON ir."receitaId" = e.receita_id
  WHERE ir."produtoId" IS NOT NULL
  GROUP BY ir."produtoId"
),
rendimento AS (
  SELECT CASE WHEN COALESCE(r."rendimentoQtd", 0) > 0 THEN r."rendimentoQtd" ELSE 1 END AS q
  FROM alvo a JOIN "Receita" r ON r.id = a."receitaId"
),
precos AS (
  SELECT i."produtoId",
         i.quantidade,
         pa.preco AS preco_agora,
         -- O preço imediatamente anterior: o histórico mais recente desta
         -- despensa que NÃO veio da última carga.
         (SELECT h.preco
            FROM "HistoricoPrecoProduto" h, alvo a, ultima_carga uc
           WHERE h."produtoId" = i."produtoId"
             AND h."unidadeId" = a.despensa_id
             AND h."origemId" <> uc.id
           ORDER BY h."dataCompra" DESC, h."criadoEm" DESC
           LIMIT 1) AS preco_antes,
         EXISTS (SELECT 1 FROM "HistoricoPrecoProduto" h, alvo a, ultima_carga uc
                  WHERE h."produtoId" = i."produtoId"
                    AND h."unidadeId" = a.despensa_id
                    AND h."origemId" = uc.id) AS mexido_na_carga
  FROM insumos i
  CROSS JOIN alvo a
  LEFT JOIN "PrecoAtualProduto" pa
    ON pa."produtoId" = i."produtoId" AND pa."unidadeId" = a.despensa_id
)
SELECT
  p2.nome AS insumo,
  p2."unidadeMedida",
  round(pr.quantidade::numeric, 4)                                   AS qtd_na_ficha,
  pr.mexido_na_carga                                                 AS mexido_nesta_carga,
  round(pr.preco_antes::numeric, 4)                                  AS preco_antes,
  round(pr.preco_agora::numeric, 4)                                  AS preco_agora,
  round((pr.quantidade * COALESCE(pr.preco_antes, 0) / r.q)::numeric, 4) AS custo_antes,
  round((pr.quantidade * COALESCE(pr.preco_agora, 0) / r.q)::numeric, 4) AS custo_agora,
  round((pr.quantidade * (COALESCE(pr.preco_agora, 0) - COALESCE(pr.preco_antes, 0)) / r.q)::numeric, 4) AS delta_custo,
  round((100 * pr.quantidade * (COALESCE(pr.preco_agora, 0) - COALESCE(pr.preco_antes, 0)) / r.q
         / NULLIF(a."precoVenda", 0))::numeric, 2)                   AS delta_cmv_pp
FROM precos pr
JOIN "Produto" p2 ON p2.id = pr."produtoId"
CROSS JOIN rendimento r
CROSS JOIN alvo a
ORDER BY delta_custo DESC NULLS LAST;

-- ---------------------------------------------------------------------------
-- 3. O TOTAL, pra bater com a tela. `cmv_agora` tem que ser o 30,8%.
--    Se não bater, pare: ou a ficha mudou junto, ou o preço de venda mudou, e
--    aí a causa não é a carga.
-- ---------------------------------------------------------------------------
WITH RECURSIVE alvo AS (
  SELECT iv.id, iv.nome, iv."precoVenda", iv."receitaId",
         COALESCE(u."estoqueEmId", u.id) AS despensa_id
  FROM "ItemVenda" iv
  JOIN "Unidade" u ON u.id = iv."unidadeId"
  WHERE lower(btrim(iv.nome)) = lower('Spaghetti Almeria')
),
ultima_carga AS (
  SELECT n.id FROM "NotaCompra" n JOIN alvo a ON a.despensa_id = n."unidadeId"
  ORDER BY n."criadoEm" DESC LIMIT 1
),
explosao AS (
  SELECT r.id AS receita_id, 1.0::double precision AS fator, ARRAY[r.id] AS caminho
  FROM alvo a JOIN "Receita" r ON r.id = a."receitaId"
  UNION ALL
  SELECT sub.id,
         e.fator * ir.quantidade
           / CASE WHEN COALESCE(sub."rendimentoQtd", 0) > 0 THEN sub."rendimentoQtd" ELSE 1 END,
         e.caminho || sub.id
  FROM explosao e
  JOIN "IngredienteReceita" ir ON ir."receitaId" = e.receita_id
  JOIN "Receita" sub ON sub.id = ir."subReceitaId"
  WHERE NOT sub.id = ANY(e.caminho) AND array_length(e.caminho, 1) < 12
),
insumos AS (
  SELECT ir."produtoId", SUM(ir.quantidade * e.fator) AS quantidade
  FROM explosao e
  JOIN "IngredienteReceita" ir ON ir."receitaId" = e.receita_id
  WHERE ir."produtoId" IS NOT NULL
  GROUP BY ir."produtoId"
),
rendimento AS (
  SELECT CASE WHEN COALESCE(r."rendimentoQtd", 0) > 0 THEN r."rendimentoQtd" ELSE 1 END AS q
  FROM alvo a JOIN "Receita" r ON r.id = a."receitaId"
)
SELECT
  a.nome,
  a."precoVenda",
  round(SUM(i.quantidade * COALESCE((SELECT h.preco FROM "HistoricoPrecoProduto" h, ultima_carga uc
                                      WHERE h."produtoId" = i."produtoId" AND h."unidadeId" = a.despensa_id
                                        AND h."origemId" <> uc.id
                                      ORDER BY h."dataCompra" DESC, h."criadoEm" DESC LIMIT 1), 0)
            / r.q)::numeric, 2) AS custo_antes,
  round(SUM(i.quantidade * COALESCE(pa.preco, 0) / r.q)::numeric, 2) AS custo_agora,
  round((100 * SUM(i.quantidade * COALESCE((SELECT h.preco FROM "HistoricoPrecoProduto" h, ultima_carga uc
                                             WHERE h."produtoId" = i."produtoId" AND h."unidadeId" = a.despensa_id
                                               AND h."origemId" <> uc.id
                                             ORDER BY h."dataCompra" DESC, h."criadoEm" DESC LIMIT 1), 0)
                   / r.q) / NULLIF(a."precoVenda", 0))::numeric, 1) AS cmv_antes_pct,
  round((100 * SUM(i.quantidade * COALESCE(pa.preco, 0) / r.q) / NULLIF(a."precoVenda", 0))::numeric, 1) AS cmv_agora_pct
FROM insumos i
CROSS JOIN alvo a
CROSS JOIN rendimento r
LEFT JOIN "PrecoAtualProduto" pa ON pa."produtoId" = i."produtoId" AND pa."unidadeId" = a.despensa_id
GROUP BY a.nome, a."precoVenda", a.despensa_id;

-- ---------------------------------------------------------------------------
-- 4. EXTRA, independente do item: os insumos que mais mudaram de preço na
--    última carga, com quantas fichas usam cada um DIRETAMENTE.
--
--    Serve pra quando o mesmo insumo explica vários pratos de uma vez — e pra
--    achar erro de origem antes de acreditar no CMV. Preço que multiplica por
--    cinco quase nunca é o mercado; quase sempre é quantidade ou embalagem
--    trocada na nota.
--
--    ATENÇÃO ao produto NOVO (antes nulo): a trava de salto de preço do app só
--    compara com o preço anterior, então produto cadastrado agora entra com o
--    primeiro preço SEM conferência nenhuma, seja ele qual for.
-- ---------------------------------------------------------------------------
WITH ultima_carga AS (
  SELECT n.id, n."unidadeId"
  FROM "NotaCompra" n
  JOIN "Unidade" u ON u.id = n."unidadeId"
  WHERE u.nome = 'Beira Lago'
  ORDER BY n."criadoEm" DESC
  LIMIT 1
)
SELECT p.nome, p."unidadeMedida",
       round(ant.preco::numeric, 4)  AS preco_antes,
       round(h.preco::numeric, 4)    AS preco_agora,
       round((h.preco / NULLIF(ant.preco, 0))::numeric, 2) AS vezes,
       (SELECT count(*) FROM "IngredienteReceita" ir WHERE ir."produtoId" = p.id) AS fichas_que_usam
FROM "HistoricoPrecoProduto" h
JOIN ultima_carga uc ON uc.id = h."origemId"
JOIN "Produto" p ON p.id = h."produtoId"
LEFT JOIN LATERAL (
  SELECT h2.preco
  FROM "HistoricoPrecoProduto" h2
  WHERE h2."produtoId" = h."produtoId"
    AND h2."unidadeId" = h."unidadeId"
    AND h2."origemId" <> uc.id
  ORDER BY h2."dataCompra" DESC, h2."criadoEm" DESC
  LIMIT 1
) ant ON true
WHERE (SELECT count(*) FROM "IngredienteReceita" ir WHERE ir."produtoId" = p.id) > 0
  AND (ant.preco IS NULL OR h.preco / NULLIF(ant.preco, 0) >= 1.2 OR h.preco / NULLIF(ant.preco, 0) <= 0.8)
ORDER BY (SELECT count(*) FROM "IngredienteReceita" ir WHERE ir."produtoId" = p.id) DESC,
         abs(h.preco - COALESCE(ant.preco, 0)) DESC;
