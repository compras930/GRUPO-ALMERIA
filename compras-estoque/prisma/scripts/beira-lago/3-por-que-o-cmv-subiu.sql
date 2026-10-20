-- Por que o CMV de UM item de venda mudou: qual insumo, e quanto cada um pesou.
--
-- SÓ LÊ. Nenhum passo escreve.
--
-- DUAS COISAS PRA TROCAR, as duas no alto de cada bloco (os três blocos
-- repetem — é de propósito, pra cada um poder ser colado sozinho):
--
--   o nome do item   -> 'Spaghetti Almeria'
--   a data de corte  -> '2026-10-19 00:00:00'
--
-- O QUE É A DATA DE CORTE, e por que ela importa mais do que parece.
--
-- "Antes" é o preço que valia ANTES dessa data; "agora" é o preço atual. Então
-- a data é a pergunta que você está fazendo:
--
--   19/10/2026  -> "o que a entrada do XMenu fez com este prato?"
--                  É o corte que responde os 24,8% -> 30,8%: antes dele os
--                  preços do Beira Lago vinham todos da importação inicial do
--                  dashboard, e não havia uma única compra carregada.
--
--   ontem       -> "o que a carga de ontem fez?" — a pergunta da rotina
--                  semanal, daqui pra frente.
--
-- Comparar com "a última carga" seria o errado agora: a última carga do Beira
-- Lago é o REPROCESSAMENTO, que entrou minutos depois da primeira. Dividir a
-- entrada do XMenu em duas metades arbitrárias esconderia justamente o que se
-- quer ver.
--
-- COMO ISTO ACOMPANHA O APP. O custo não é guardado em lugar nenhum: a tela
-- recalcula na leitura a partir de PrecoAtualProduto (src/lib/cmv.ts,
-- custoDeReceita). Aqui a mesma conta, em SQL:
--
--   custo por unidade = SOMA(quantidade_do_insumo x preço) / rendimento
--
-- com a ficha explodida recursivamente e o fator de lote de cada nível igual
-- ao de explodirReceitaPura:
--
--   fator_do_filho = fator_do_pai x quantidade_da_subreceita / rendimento_dela
--
-- O preço segue a unidade FÍSICA (a despensa), não a casa — é o que
-- carregarPrecoAtualPorProduto faz. Daí o COALESCE("estoqueEmId", id).

-- ---------------------------------------------------------------------------
-- 1. O item e a ficha. Confira que achou UM item só.
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
-- 2. A RESPOSTA: cada insumo da ficha, antes e agora.
--
--    `delta_custo` é quanto aquele insumo sozinho acrescentou ao custo do
--    prato. Some a coluna e você tem a diferença inteira; quem está no topo é
--    o responsável. `delta_cmv_pp` diz o mesmo em pontos de CMV.
--
--    `preco_antes` NULO é o caso mais importante e o menos óbvio: insumo que
--    não tinha preço nenhum antes do corte. Ele não ficou mais caro — ele
--    SAIU DO ZERO. Antes o prato custava menos porque aquele insumo não
--    entrava na conta, não porque era barato. Num prato com muitos insumos
--    novos, é isso que explica o salto, e não um ingrediente caro.
-- ---------------------------------------------------------------------------
WITH RECURSIVE
parametros AS (
  SELECT lower('Spaghetti Almeria') AS item,
         timestamp '2026-10-19 00:00:00' AS corte
),
alvo AS (
  SELECT iv.id, iv.nome, iv."precoVenda", iv."receitaId",
         COALESCE(u."estoqueEmId", u.id) AS despensa_id
  FROM "ItemVenda" iv
  JOIN "Unidade" u ON u.id = iv."unidadeId"
  JOIN parametros p ON lower(btrim(iv.nome)) = p.item
),
-- Explosão recursiva da ficha. `fator` é quanto de UM lote da receita-raiz
-- cada nível representa; `caminho` existe só para barrar ciclo (a ficha do
-- bacalhau já apontou para si mesma — ver _corrigir-ciclo-bacalhau.ts).
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
),
precos AS (
  SELECT i."produtoId", i.quantidade,
         pa.preco AS preco_agora,
         (SELECT h.preco
            FROM "HistoricoPrecoProduto" h, parametros p
           WHERE h."produtoId" = i."produtoId"
             AND h."unidadeId" = a.despensa_id
             AND h."criadoEm" < p.corte
           ORDER BY h."dataCompra" DESC, h."criadoEm" DESC
           LIMIT 1) AS preco_antes
  FROM insumos i
  CROSS JOIN alvo a
  LEFT JOIN "PrecoAtualProduto" pa
    ON pa."produtoId" = i."produtoId" AND pa."unidadeId" = a.despensa_id
)
SELECT
  p2.nome AS insumo,
  p2."unidadeMedida",
  round(pr.quantidade::numeric, 4)                                       AS qtd_na_ficha,
  CASE WHEN pr.preco_antes IS NULL THEN 'SAIU DO ZERO' ELSE '' END       AS atencao,
  round(pr.preco_antes::numeric, 4)                                      AS preco_antes,
  round(pr.preco_agora::numeric, 4)                                      AS preco_agora,
  round((pr.quantidade * COALESCE(pr.preco_antes, 0) / r.q)::numeric, 4) AS custo_antes,
  round((pr.quantidade * COALESCE(pr.preco_agora, 0) / r.q)::numeric, 4) AS custo_agora,
  round((pr.quantidade * (COALESCE(pr.preco_agora, 0) - COALESCE(pr.preco_antes, 0)) / r.q)::numeric, 4) AS delta_custo,
  round((100 * pr.quantidade * (COALESCE(pr.preco_agora, 0) - COALESCE(pr.preco_antes, 0)) / r.q
         / NULLIF(a."precoVenda", 0))::numeric, 2)                       AS delta_cmv_pp
FROM precos pr
JOIN "Produto" p2 ON p2.id = pr."produtoId"
CROSS JOIN rendimento r
CROSS JOIN alvo a
ORDER BY delta_custo DESC NULLS LAST;

-- ---------------------------------------------------------------------------
-- 3. O TOTAL, pra bater com a tela. `cmv_agora_pct` tem que ser o número que
--    você vê no app. Se não bater, pare: ou a ficha mudou, ou o preço de venda
--    mudou — e aí a causa não é preço de insumo.
-- ---------------------------------------------------------------------------
WITH RECURSIVE
parametros AS (
  SELECT lower('Spaghetti Almeria') AS item,
         timestamp '2026-10-19 00:00:00' AS corte
),
alvo AS (
  SELECT iv.id, iv.nome, iv."precoVenda", iv."receitaId",
         COALESCE(u."estoqueEmId", u.id) AS despensa_id
  FROM "ItemVenda" iv
  JOIN "Unidade" u ON u.id = iv."unidadeId"
  JOIN parametros p ON lower(btrim(iv.nome)) = p.item
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
),
valores AS (
  SELECT i.quantidade,
         COALESCE(pa.preco, 0) AS agora,
         COALESCE((SELECT h.preco FROM "HistoricoPrecoProduto" h, parametros p
                    WHERE h."produtoId" = i."produtoId"
                      AND h."unidadeId" = a.despensa_id
                      AND h."criadoEm" < p.corte
                    ORDER BY h."dataCompra" DESC, h."criadoEm" DESC LIMIT 1), 0) AS antes,
         (SELECT h.preco FROM "HistoricoPrecoProduto" h, parametros p
           WHERE h."produtoId" = i."produtoId" AND h."unidadeId" = a.despensa_id
             AND h."criadoEm" < p.corte LIMIT 1) IS NULL AS era_zero
  FROM insumos i
  CROSS JOIN alvo a
  LEFT JOIN "PrecoAtualProduto" pa
    ON pa."produtoId" = i."produtoId" AND pa."unidadeId" = a.despensa_id
)
SELECT
  a.nome, a."precoVenda",
  count(*)                                        AS insumos_na_ficha,
  count(*) FILTER (WHERE v.era_zero)              AS insumos_que_sairam_do_zero,
  round(SUM(v.quantidade * v.antes / r.q)::numeric, 2) AS custo_antes,
  round(SUM(v.quantidade * v.agora / r.q)::numeric, 2) AS custo_agora,
  round((100 * SUM(v.quantidade * v.antes / r.q) / NULLIF(a."precoVenda", 0))::numeric, 1) AS cmv_antes_pct,
  round((100 * SUM(v.quantidade * v.agora / r.q) / NULLIF(a."precoVenda", 0))::numeric, 1) AS cmv_agora_pct
FROM valores v
CROSS JOIN alvo a
CROSS JOIN rendimento r
GROUP BY a.nome, a."precoVenda";
