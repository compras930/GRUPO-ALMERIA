-- SÓ LEITURA. Procura linha de ficha cuja QUANTIDADE está na escala errada —
-- número em grama/ml contra um produto precificado em KG/LT, o que multiplica
-- o custo daquela linha por 1000.
--
-- POR QUE ESTA CONSULTA EXISTE. O custo é `quantidade × preço por unidade
-- canônica do produto`, sem conversão nenhuma (explodirReceitaPura). Então uma
-- linha "3830" contra um produto de R$ 58,20/KG custa R$ 222.906 — e, enquanto
-- ninguém olha o número absoluto, isso é invisível: a ficha só fica cara.
--
-- DE ONDE VEIO A SUSPEITA, e por que eu não consigo responder sozinho. No meu
-- banco local aparecem 81 linhas assim. Só que esse banco carrega uma
-- corrupção minha: numa das primeiras vezes que testei o script de unificação
-- de homônimos (homonimos-unidade-mesclar.sql), rodei uma versão SEM a
-- checagem de preço, e ela repontou ~82 linhas de produtos em G para os
-- equivalentes em KG sem converter a quantidade. O número bate. Quase
-- certamente o que estou vendo é o meu próprio estrago local.
--
-- Mas "quase certamente" não basta, porque a versão que foi pra produção tem
-- duas brechas conhecidas na checagem de preço:
--   1. ela libera a mesclagem quando um dos lados não tem preço nenhum
--      ("sem evidência contra, mesclar só pode melhorar") — e um cadastro em G
--      sem preço é exatamente o caso que passaria;
--   2. grupos marcados como decisão manual pulam a checagem inteira.
--
-- Rode as três consultas e me mande o resultado. Se vier vazio, produção está
-- limpa e o problema é só do meu ambiente.

-- ---------------------------------------------------------------------------
-- 1) O quadro geral. `linhas_suspeitas` é o que importa.
--
-- Critério: o produto é vendido em KG ou LT (onde uma receita real quase nunca
-- passa de algumas dezenas) e a linha traz 100 ou mais. 100 KG de qualquer
-- coisa numa receita é 100 quilos.
-- ---------------------------------------------------------------------------
SELECT
  count(*)                                                   AS linhas_suspeitas,
  count(DISTINCT r.id)                                       AS receitas_afetadas,
  round(sum(i.quantidade * pa.preco)::numeric, 2)            AS custo_somado_hoje,
  round(sum(i.quantidade * pa.preco)::numeric / 1000, 2)     AS custo_se_fosse_grama
FROM "IngredienteReceita" i
JOIN "Receita" r  ON r.id = i."receitaId"
JOIN "Unidade" un ON un.id = r."unidadeId"
JOIN "Produto" p  ON p.id = i."produtoId"
JOIN "PrecoAtualProduto" pa
  ON pa."produtoId" = p.id AND pa."unidadeId" = COALESCE(un."estoqueEmId", un.id)
WHERE upper(btrim(p."unidadeMedida")) IN ('KG', 'LT', 'L')
  AND i.quantidade >= 100
  AND pa.preco > 0;

-- ---------------------------------------------------------------------------
-- 2) As 25 mais caras, pra dar pra reconhecer o padrão. Se aparecerem coisas
--    como "3830 KG de cogumelo" ou "9000 KG de tomate pelati", é a corrupção
--    de escala. Se a lista vier vazia, produção está limpa.
-- ---------------------------------------------------------------------------
SELECT un.nome AS casa, r.nome AS receita, p.nome AS insumo,
       i.quantidade, p."unidadeMedida" AS un_do_produto,
       round(pa.preco::numeric, 2)                      AS preco_unitario,
       round((i.quantidade * pa.preco)::numeric, 2)     AS custo_da_linha_hoje
FROM "IngredienteReceita" i
JOIN "Receita" r  ON r.id = i."receitaId"
JOIN "Unidade" un ON un.id = r."unidadeId"
JOIN "Produto" p  ON p.id = i."produtoId"
JOIN "PrecoAtualProduto" pa
  ON pa."produtoId" = p.id AND pa."unidadeId" = COALESCE(un."estoqueEmId", un.id)
WHERE upper(btrim(p."unidadeMedida")) IN ('KG', 'LT', 'L')
  AND i.quantidade >= 100
  AND pa.preco > 0
ORDER BY (i.quantidade * pa.preco) DESC
LIMIT 25;

-- ---------------------------------------------------------------------------
-- 3) O caso específico do IOGURTE NATURAL, que é o que motivou tudo isto.
--
-- A cozinha confirmou que são 180 G de iogurte (culturа) para 2 L de leite —
-- coerente: 180 G + 2000 ML entram, 1915 G saem, ~12% de perda.
--
-- O que preciso saber é como a linha está gravada AQUI. Se `quantidade` vier
-- 180 com o produto em KG, a receita conta 180 quilos e o conserto é trocar
-- por 0,18. Se vier 0,18 ou se o produto estiver em G, produção já está certa
-- e o que eu vi era só o meu banco local.
-- ---------------------------------------------------------------------------
SELECT un.nome AS casa, p.nome AS insumo,
       p."unidadeMedida"                              AS un_do_produto,
       i.quantidade                                   AS quantidade_na_ficha,
       i."unidadeMedida"                              AS rotulo_na_linha,
       round(pa.preco::numeric, 2)                    AS preco,
       round((i.quantidade * pa.preco)::numeric, 2)   AS custo_da_linha,
       round(r."rendimentoQtd"::numeric, 0) || ' ' || COALESCE(r."rendimentoUnidade", '') AS rendimento
FROM "Receita" r
JOIN "Unidade" un ON un.id = r."unidadeId"
JOIN "IngredienteReceita" i ON i."receitaId" = r.id
JOIN "Produto" p ON p.id = i."produtoId"
LEFT JOIN "PrecoAtualProduto" pa
  ON pa."produtoId" = p.id AND pa."unidadeId" = COALESCE(un."estoqueEmId", un.id)
WHERE lower(btrim(r.nome)) = 'iogurte natural'
ORDER BY un.nome, p.nome;
