-- FUSÃO DOS PRODUTOS-FANTASMA — passo 1 de 2: CONFERIR.
--
-- SÓ LÊ. Nada aqui escreve. Rode, confira, e só então rode o 14-fundir-2.
--
-- O QUE É UM FANTASMA. O produto que as fichas consomem e que NUNCA recebeu
-- compra, convivendo com o produto que a casa compra de verdade e que nenhuma
-- ficha menciona. Quebra as três coisas de uma vez: o custo sai de um preço
-- inventado, o saldo do fantasma afunda para sempre enquanto o do real só
-- cresce, e a lista de compra pede o fantasma.
--
-- POR QUE SOMAR OS SALDOS ESTÁ CERTO. O fantasma tem saldo muito negativo
-- (saiu sempre, nunca entrou) e o real muito positivo (entrou sempre, nunca
-- saiu). O estoque físico verdadeiro é a soma dos dois — não o maior deles.
--
-- OS PARES, e de onde saiu cada um: o passo 2 do 13-unidades-e-fichas mostrou
-- o fantasma com `linhas_de_nota = 0` e o real com nota, preço e volume.
--
--   GEMA              -> GEMA DE OVO 1KG                        fator 1
--   BURRATA           -> BURRATA CAMPANA 200GR                  fator 5
--   CONHAQUE DOMECQ   -> CONHAQUE DOMECQ 1LT                    fator 1
--   VINHO BRANCO      -> VINHO BRANCO SAINT GERMAIN 750ML (COZINHA)  fator 1
--
-- O FATOR 5 DA BURRATA é a decisão desta rodada: o real é vendido em UND de
-- 200 g, a ficha pede em KG, então 1 kg vira 5 potes. Ficou em UND porque é
-- assim que a gerente conta na geladeira — ela conta potes.
--
-- O FATOR 1 DO CONHAQUE E DO VINHO é aproximação assumida: o fantasma está em
-- KG, o real em LT, e para álcool 1 kg não é exatamente 1 LT (fica perto de
-- 1,05 LT). O erro é de 5% sobre insumo de molho, e tratá-lo como 1 é mais
-- honesto do que inventar densidade por produto.
--
-- FICAM DE FORA, de propósito, três que você apontou:
--
--   ATUM (R$ 84,90, sem nota) — o único com nota é ATUM EM LATA 170G, e
--     tartare não se faz com atum de lata. Fundir os dois estragaria a ficha
--     em vez de consertá-la. Precisa saber o que a casa compra de verdade.
--   VINHO TINTO CULINARIO e VINHO PERMATIN JEREZ — não apareceu nenhum
--     gêmeo com nota. Ou a compra entra com outro nome, ou não foram
--     comprados no período.
--
-- Me diga o que a casa compra nesses três e eu escrevo a fusão deles.

-- =====================================================================
-- CONFERÊNCIA 1 — AS FICHAS: quantidade de hoje e quantidade depois.
--
-- É AQUI QUE SE OLHA COM CUIDADO. Se a ficha da burrata disser "1" querendo
-- dizer um pote (e não um quilo), o fator 5 vai transformar 1 pote em 5. A
-- coluna `quantidade_depois` é a que vai ficar gravada: leia linha por linha e
-- pergunte se faz sentido no prato.
-- =====================================================================
WITH pares(fantasma, real_, fator) AS (
  VALUES ('GEMA', 'GEMA DE OVO 1KG', 1.0),
         ('BURRATA', 'BURRATA CAMPANA 200GR', 5.0),
         ('CONHAQUE DOMECQ', 'CONHAQUE DOMECQ 1LT', 1.0),
         ('VINHO BRANCO', 'VINHO BRANCO SAINT GERMAIN 750ML  (COZINHA)', 1.0)
)
SELECT f.nome AS fantasma,
       r.nome AS vira,
       rc.nome AS receita,
       ing.quantidade AS quantidade_hoje,
       ing."unidadeMedida" AS unidade_hoje,
       round((ing.quantidade * pa.fator)::numeric, 4) AS quantidade_depois,
       r."unidadeMedida" AS unidade_depois
FROM pares pa
JOIN "Produto" f ON upper(btrim(f.nome)) = upper(btrim(pa.fantasma))
JOIN "Produto" r ON upper(btrim(r.nome)) = upper(btrim(pa.real_))
JOIN "IngredienteReceita" ing ON ing."produtoId" = f.id
JOIN "Receita" rc ON rc.id = ing."receitaId"
JOIN "Unidade" u ON u.id = rc."unidadeId" AND u.nome = 'Beira Lago'
ORDER BY f.nome, rc.nome;

-- =====================================================================
-- CONFERÊNCIA 2 — O SALDO, o preço e a curva que serão fundidos.
--
-- `saldo_depois` é a soma dos dois. Se ele sair muito negativo, não é erro da
-- fusão: é consumo que nunca teve compra lançada, e a contagem de segunda
-- resolve, porque contagem SOBRESCREVE o saldo.
--
-- `curva` importa para a folha de contagem: se o fantasma é curva A e o real
-- não é, a fusão leva a classificação junto — senão o produto some da folha.
-- =====================================================================
WITH pares(fantasma, real_, fator) AS (
  VALUES ('GEMA', 'GEMA DE OVO 1KG', 1.0),
         ('BURRATA', 'BURRATA CAMPANA 200GR', 5.0),
         ('CONHAQUE DOMECQ', 'CONHAQUE DOMECQ 1LT', 1.0),
         ('VINHO BRANCO', 'VINHO BRANCO SAINT GERMAIN 750ML  (COZINHA)', 1.0)
),
u AS (SELECT id AS casa, COALESCE("estoqueEmId", id) AS despensa FROM "Unidade" WHERE nome = 'Beira Lago')
SELECT f.nome AS fantasma,
       f."unidadeMedida" AS un_fantasma,
       round(COALESCE(sf.quantidade, 0)::numeric, 3) AS saldo_fantasma,
       round(COALESCE(pf.preco, 0)::numeric, 4) AS preco_fantasma,
       r.nome AS vira,
       r."unidadeMedida" AS un_real,
       round(COALESCE(sr.quantidade, 0)::numeric, 3) AS saldo_real,
       round(COALESCE(pr.preco, 0)::numeric, 4) AS preco_real,
       round((COALESCE(sf.quantidade, 0) * pa.fator + COALESCE(sr.quantidade, 0))::numeric, 3) AS saldo_depois,
       COALESCE(gf."classeAbc", '-') AS curva_fantasma,
       COALESCE(gr."classeAbc", '-') AS curva_real,
       (SELECT count(*) FROM "MovimentoEstoque" m WHERE m."produtoId" = f.id AND m."unidadeId" = u.despensa) AS movimentos_a_mover,
       (SELECT count(*) FROM "ContagemEstoque" c WHERE c."produtoId" = f.id AND c."unidadeId" = u.despensa) AS contagens_a_mover
FROM pares pa
CROSS JOIN u
JOIN "Produto" f ON upper(btrim(f.nome)) = upper(btrim(pa.fantasma))
JOIN "Produto" r ON upper(btrim(r.nome)) = upper(btrim(pa.real_))
LEFT JOIN "EstoqueSaldo" sf ON sf."produtoId" = f.id AND sf."unidadeId" = u.despensa
LEFT JOIN "EstoqueSaldo" sr ON sr."produtoId" = r.id AND sr."unidadeId" = u.despensa
LEFT JOIN "PrecoAtualProduto" pf ON pf."produtoId" = f.id AND pf."unidadeId" = u.despensa
LEFT JOIN "PrecoAtualProduto" pr ON pr."produtoId" = r.id AND pr."unidadeId" = u.despensa
LEFT JOIN "ParametroEstoqueProduto" gf ON gf."produtoId" = f.id AND gf."unidadeId" = u.despensa
LEFT JOIN "ParametroEstoqueProduto" gr ON gr."produtoId" = r.id AND gr."unidadeId" = u.despensa
ORDER BY f.nome;

-- =====================================================================
-- CONFERÊNCIA 3 — os dois insumos a zerar.
--
-- Água de cocção e salada de ervas estão em ficha, custam centavos e nunca
-- foram compradas. Zerar o preço tira o custo falso do CMV.
--
-- MAS ZERAR O PREÇO NÃO AS TIRA DA LISTA DE COMPRA: a lista sugere tudo que
-- foi consumido, com preço ou sem. O passo 2 traz as duas formas, e você
-- escolhe lá.
-- =====================================================================
SELECT p.nome,
       p."unidadeMedida" AS unidade,
       round(COALESCE(pa.preco, 0)::numeric, 4) AS preco_hoje,
       count(DISTINCT ing."receitaId") AS fichas_que_usam
FROM "Produto" p
JOIN "Unidade" u ON u.nome = 'Beira Lago'
LEFT JOIN "PrecoAtualProduto" pa ON pa."produtoId" = p.id AND pa."unidadeId" = COALESCE(u."estoqueEmId", u.id)
LEFT JOIN "IngredienteReceita" ing ON ing."produtoId" = p.id
LEFT JOIN "Receita" r ON r.id = ing."receitaId" AND r."unidadeId" = u.id
WHERE upper(btrim(p.nome)) IN ('AGUA COCCÃO', 'ÁGUA COCCÃO', 'SALADA DE ERVAS')
GROUP BY 1, 2, 3
ORDER BY 1;
