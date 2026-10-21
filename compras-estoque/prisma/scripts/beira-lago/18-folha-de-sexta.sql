-- A folha de contagem de sexta, antes de sexta. SÓ LÊ.
--
-- Confere o que a gerente vai ver na tela de Contagem da semana no modo
-- `?todos=1`, que é o da contagem inicial: a curva A e B inteiras num
-- lançamento só.
--
-- POR QUE OLHAR ISTO AGORA. A fusão trocou os produtos de lugar — a burrata
-- virou BURRATA CAMPANA 200GR, em potes. A classe ABC mora em
-- ParametroEstoqueProduto por (unidade, produto), então ela segue o PRODUTO,
-- não o nome. Se algum fantasma era curva A e o real não herdou a classe, o
-- item some da folha, e some calado: a tela não tem como saber que faltou.

-- 1. O TAMANHO DA FOLHA.
SELECT g."classeAbc" AS curva,
       count(*) AS itens,
       count(*) FILTER (WHERE p.ativo) AS ativos,
       count(*) FILTER (WHERE NOT p.ativo) AS inativos_nao_aparecem
FROM "ParametroEstoqueProduto" g
JOIN "Produto" p ON p.id = g."produtoId"
JOIN "Unidade" u ON u.nome = 'Beira Lago' AND g."unidadeId" = COALESCE(u."estoqueEmId", u.id)
WHERE g."classeAbc" IN ('A', 'B')
GROUP BY 1
ORDER BY 1;

-- 2. OS PRODUTOS DA FUSÃO: estão na folha?
--
-- `curva` tem que ser A ou B nos quatro. Se vier '-', o item NÃO aparece para
-- a gerente contar.
SELECT p.nome,
       p."unidadeMedida" AS conta_em,
       p.ativo,
       COALESCE(g."classeAbc", '-') AS curva,
       round(COALESCE(pa.preco, 0)::numeric, 2) AS preco
FROM "Produto" p
JOIN "Unidade" u ON u.nome = 'Beira Lago'
LEFT JOIN "ParametroEstoqueProduto" g ON g."produtoId" = p.id AND g."unidadeId" = COALESCE(u."estoqueEmId", u.id)
LEFT JOIN "PrecoAtualProduto" pa ON pa."produtoId" = p.id AND pa."unidadeId" = COALESCE(u."estoqueEmId", u.id)
WHERE upper(btrim(p.nome)) IN (
  'GEMA DE OVO 1KG', 'BURRATA CAMPANA 200GR', 'CONHAQUE DOMECQ 1LT',
  'VINHO BRANCO SAINT GERMAIN 750ML  (COZINHA)'
)
ORDER BY p.nome;

-- 3. CURVA A SEM PREÇO.
--
-- Item sem preço é contado de graça: ele entra na contagem, mas a diferença
-- dele vale R$ 0,00 na Conferência, e some do relatório que a reunião vai ler.
SELECT p.nome, p."unidadeMedida" AS conta_em, g."classeAbc" AS curva
FROM "ParametroEstoqueProduto" g
JOIN "Produto" p ON p.id = g."produtoId" AND p.ativo
JOIN "Unidade" u ON u.nome = 'Beira Lago' AND g."unidadeId" = COALESCE(u."estoqueEmId", u.id)
LEFT JOIN "PrecoAtualProduto" pa ON pa."produtoId" = p.id AND pa."unidadeId" = g."unidadeId"
WHERE g."classeAbc" = 'A' AND COALESCE(pa.preco, 0) = 0
ORDER BY p.nome;
