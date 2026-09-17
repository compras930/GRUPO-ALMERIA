-- SÓ LEITURA. Mede o que hoje está duplicado entre Noroeste e Matri.
--
-- Contexto: as duas são casas separadas no sistema (cardápio próprio, caixa
-- próprio, venda medida em separado), mas são a MESMA unidade física — mesma
-- cozinha, mesmo estoque, mesma compra. O sistema não sabe disso: tudo que é
-- por unidade está duplicado entre elas, inclusive o que deveria ser um só.
--
-- O que é legítimo estar separado: ItemVenda e VendaSemanal (é o cardápio e o
-- caixa de cada casa — a razão de existirem duas).
--
-- O que NÃO deveria estar separado: preço de insumo, saldo de estoque,
-- movimento, contagem, nota de compra, parâmetro de estoque. E, discutivelmente,
-- Receita: uma fonduta feita naquela cozinha é uma preparação, não duas.
--
-- Rode as 4 consultas e me mande o resultado.

-- ---------------------------------------------------------------------------
-- 1) Preço duplicado. Cada linha aqui é um insumo comprado UMA vez e
--    precificado DUAS. `preco_diferente` é o que já divergiu — quando diverge,
--    a mesma compra produz dois custos e pelo menos um está errado.
-- ---------------------------------------------------------------------------
WITH n AS (SELECT id FROM "Unidade" WHERE nome = 'Noroeste'),
     m AS (SELECT id FROM "Unidade" WHERE nome = 'Matri')
SELECT
  count(*)                                                  AS insumos_precificados_nas_duas,
  count(*) FILTER (WHERE pn.preco <> pm.preco)              AS preco_diferente,
  count(*) FILTER (WHERE pn.preco > 0 AND pm.preco = 0)     AS so_noroeste_tem_preco,
  count(*) FILTER (WHERE pm.preco > 0 AND pn.preco = 0)     AS so_matri_tem_preco
FROM "PrecoAtualProduto" pn
JOIN "PrecoAtualProduto" pm
  ON pm."produtoId" = pn."produtoId" AND pm."unidadeId" = (SELECT id FROM m)
WHERE pn."unidadeId" = (SELECT id FROM n);

-- ---------------------------------------------------------------------------
-- 2) Onde já divergiu, e por quanto. Se vier vazio, ótimo: a duplicação existe
--    mas ainda não produziu custo errado.
-- ---------------------------------------------------------------------------
WITH n AS (SELECT id FROM "Unidade" WHERE nome = 'Noroeste'),
     m AS (SELECT id FROM "Unidade" WHERE nome = 'Matri')
SELECT p.nome AS insumo, p."unidadeMedida" AS un,
       round(pn.preco::numeric, 2) AS noroeste,
       round(pm.preco::numeric, 2) AS matri,
       round((abs(pn.preco - pm.preco) / NULLIF(greatest(pn.preco, pm.preco), 0) * 100)::numeric, 0) AS dif_pct
FROM "PrecoAtualProduto" pn
JOIN "PrecoAtualProduto" pm
  ON pm."produtoId" = pn."produtoId" AND pm."unidadeId" = (SELECT id FROM m)
JOIN "Produto" p ON p.id = pn."produtoId"
WHERE pn."unidadeId" = (SELECT id FROM n)
  AND pn.preco <> pm.preco
  AND pn.preco > 0 AND pm.preco > 0
ORDER BY abs(pn.preco - pm.preco) DESC
LIMIT 25;

-- ---------------------------------------------------------------------------
-- 3) O que já existe de operação em cada uma. É o que decide o CUSTO de
--    arrumar: enquanto estiver tudo zerado, unificar é de graça — não há
--    histórico de estoque pra fundir, nem contagem pra reconciliar.
-- ---------------------------------------------------------------------------
SELECT un.nome AS casa,
  (SELECT count(*) FROM "EstoqueSaldo"            x WHERE x."unidadeId" = un.id) AS saldos,
  (SELECT count(*) FROM "MovimentoEstoque"        x WHERE x."unidadeId" = un.id) AS movimentos,
  (SELECT count(*) FROM "ContagemEstoque"         x WHERE x."unidadeId" = un.id) AS contagens,
  (SELECT count(*) FROM "NotaCompra"              x WHERE x."unidadeId" = un.id) AS notas,
  (SELECT count(*) FROM "VendaSemanal"            x WHERE x."unidadeId" = un.id) AS vendas_semanais,
  (SELECT count(*) FROM "ParametroEstoqueProduto" x WHERE x."unidadeId" = un.id) AS parametros,
  (SELECT count(*) FROM "PedidoCompra"            x WHERE x."unidadeId" = un.id) AS pedidos
FROM "Unidade" un
ORDER BY un.nome;

-- ---------------------------------------------------------------------------
-- 4) Receitas com o mesmo nome nas duas. A contagem de ingredientes mostra
--    quando uma delas é casca: a preparação de verdade está do outro lado.
-- ---------------------------------------------------------------------------
WITH n AS (SELECT id FROM "Unidade" WHERE nome = 'Noroeste'),
     m AS (SELECT id FROM "Unidade" WHERE nome = 'Matri')
SELECT a.nome AS receita,
       (SELECT count(*) FROM "IngredienteReceita" i WHERE i."receitaId" = a.id) AS ingr_noroeste,
       (SELECT count(*) FROM "IngredienteReceita" i WHERE i."receitaId" = b.id) AS ingr_matri
FROM "Receita" a
JOIN "Receita" b ON lower(btrim(a.nome)) = lower(btrim(b.nome))
WHERE a."unidadeId" = (SELECT id FROM n) AND b."unidadeId" = (SELECT id FROM m)
ORDER BY a.nome;
