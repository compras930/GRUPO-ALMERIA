-- O estado de cada casa, lado a lado. SÓ LÊ.
--
-- Serve para saber o que falta em cada uma antes de repetir o caminho do Beira
-- Lago, em vez de supor que todas estão no mesmo ponto. O Beira Lago aparece
-- junto de propósito: é a régua.
--
-- A ORDEM DO QUE FOI FEITO LÁ, que é a ordem que as outras vão seguir:
--
--   1. compra carregada          -> notas e preço por produto
--   2. produto cadastrado        -> linha de nota que não casou vira produto
--   3. unidade e conversão       -> KG x LT x UND, PCT -> CX
--   4. fantasma fundido          -> produto que a ficha usa e ninguém compra
--   5. curva ABC + rodízio       -> define QUEM entra na folha de contagem
--   6. gerente da unidade        -> quem conta
--   7. venda carregada           -> semanal, com valorTotal
--   8. item de venda + código    -> catálogo do PDV
--   9. categoria canônica        -> MAIÚSCULA, sem duplicata
--  10. ficha técnica             -> a parte longa, e a única sem atalho
--
-- O CPD NÃO TEM 7, 8 E 9 e nunca vai ter. Ele compra e o estoque sai para as
-- casas — não vira venda. Isso tem consequência no modelo, e está na consulta 3.
SELECT u.nome AS casa,
       CASE WHEN u."estoqueEmId" IS NULL THEN 'própria' ELSE 'usa a de outra' END AS despensa,
       (SELECT count(*) FROM "NotaCompra" n WHERE n."unidadeId" = COALESCE(u."estoqueEmId", u.id)) AS notas,
       (SELECT count(*) FROM "ItemNotaCompra" i JOIN "NotaCompra" n ON n.id = i."notaCompraId"
         WHERE n."unidadeId" = COALESCE(u."estoqueEmId", u.id)) AS linhas_de_nota,
       (SELECT count(*) FROM "ItemNotaCompra" i JOIN "NotaCompra" n ON n.id = i."notaCompraId"
         WHERE n."unidadeId" = COALESCE(u."estoqueEmId", u.id) AND i."produtoId" IS NULL) AS linhas_sem_produto,
       (SELECT count(*) FROM "PrecoAtualProduto" p WHERE p."unidadeId" = COALESCE(u."estoqueEmId", u.id)) AS produtos_com_preco,
       (SELECT count(*) FROM "ParametroEstoqueProduto" g
         WHERE g."unidadeId" = COALESCE(u."estoqueEmId", u.id) AND g."classeAbc" = 'A') AS curva_a,
       (SELECT count(*) FROM "ContagemEstoque" c WHERE c."unidadeId" = COALESCE(u."estoqueEmId", u.id)) AS contagens,
       (SELECT count(*) FROM "Usuario" us WHERE us."unidadeId" = u.id AND us.papel = 'GERENTE' AND us.ativo) AS gerentes,
       (SELECT count(*) FROM "ItemVenda" iv WHERE iv."unidadeId" = u.id) AS itens_de_venda,
       (SELECT count(*) FROM "ItemVenda" iv WHERE iv."unidadeId" = u.id AND iv."codigoPdv" IS NOT NULL) AS com_codigo_pdv,
       (SELECT count(*) FROM "ItemVenda" iv WHERE iv."unidadeId" = u.id AND iv."receitaId" IS NOT NULL) AS com_ficha,
       (SELECT count(*) FROM "VendaSemanal" vs WHERE vs."unidadeId" = u.id) AS semanas_de_venda
FROM "Unidade" u
WHERE u.ativo
ORDER BY u.nome;

-- =====================================================================
-- 2. AS CATEGORIAS DE VENDA de cada casa — o problema que acabamos de
--    resolver no Beira Lago, para ver se existe nas outras.
--
-- `escritas` maior que 1 na mesma chave é duplicata: TINTO ao lado de Tintos.
-- `minusculas` maior que 0 é a convenção antiga ainda viva.
-- =====================================================================
SELECT u.nome AS casa,
       count(DISTINCT iv.categoria) AS categorias,
       count(DISTINCT regexp_replace(
         lower(translate(btrim(iv.categoria), 'ÁÀÂÃÉÊÍÓÔÕÚÇ', 'aaaaeeiooouc')), 's$', ''
       )) AS categorias_distintas_de_verdade,
       count(DISTINCT iv.categoria) FILTER (WHERE iv.categoria <> upper(iv.categoria)) AS minusculas
FROM "Unidade" u
JOIN "ItemVenda" iv ON iv."unidadeId" = u.id
WHERE u.ativo AND iv.categoria IS NOT NULL
GROUP BY u.nome
ORDER BY u.nome;

-- =====================================================================
-- 3. O CPD: por onde o estoque SAI.
--
-- Casa normal dá baixa por SAIDA_CONSUMO, explodindo a ficha da venda. O CPD
-- não vende: ele compra e manda para as casas. Se não houver movimento de
-- saída registrado, o saldo dele só cresce, e a contagem vai acusar uma falta
-- gigante todo mês — falta que não é perda, é mercadoria que foi para outra
-- casa.
--
-- Esta consulta mostra que tipos de movimento existem hoje em cada despensa.
-- Se no CPD só houver ENTRADA_*, confirma que falta modelar a transferência.
-- =====================================================================
SELECT u.nome AS despensa,
       m.tipo,
       count(*) AS movimentos,
       round(sum(m.quantidade)::numeric, 2) AS quantidade_total,
       min(m."criadoEm")::date AS desde,
       max(m."criadoEm")::date AS ate
FROM "MovimentoEstoque" m
JOIN "Unidade" u ON u.id = m."unidadeId"
GROUP BY u.nome, m.tipo
ORDER BY u.nome, movimentos DESC;
