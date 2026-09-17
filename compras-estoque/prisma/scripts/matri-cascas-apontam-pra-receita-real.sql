-- Faz as fichas do Matri usarem as receitas de verdade do Noroeste, em vez de
-- cascas vazias com o mesmo nome.
--
-- O QUE É UMA CASCA. A importação do dashboard antigo criou, em Matri, três
-- Receitas com um único ingrediente: o Produto de mesmo nome. FONDUTA DE
-- PARMESÃO em Matri "contém" o produto FONDUTA DE PARMESÃO, e ponto — não
-- explica preparo nenhum, só empacota um número. A receita de verdade está no
-- Noroeste:
--
--   FONDUTA DE PARMESÃO (Noroeste): creme de leite 4000 G, leite 2660 ML,
--     farinha 500 G, manteiga 500 G, parmesão ralado 1000 G
--   FONDUTA DE PARMESÃO (Matri): "FONDUTA DE PARMESÃO" 0,06 KG   <- casca
--
-- POR QUE ISSO É LEGÍTIMO AGORA, E NÃO ERA ANTES. Enquanto Noroeste e Matri
-- eram duas cozinhas no modelo, uma ficha do Matri não podia usar receita do
-- Noroeste — a validação barrava, e com razão: cozinhas diferentes têm preços
-- diferentes. Agora que as duas estão registradas como a MESMA unidade física
-- (Unidade.estoqueEmId), a fonduta é uma panela só. Ver src/lib/unidade-fisica.ts.
--
-- O QUE MUDA NO CUSTO — e não é o que eu esperava. A previsão era "hoje custa
-- zero, vai subir". Errado: o Produto FONDUTA DE PARMESÃO tem preço cadastrado
-- (R$ 15.041/KG no Noroeste), que não é compra — é custo DERIVADO pela
-- importação do dashboard antigo. Enquanto Matri tinha despensa própria esse
-- preço não era lido e a casca custava zero mesmo; depois da unificação, ela
-- passou a custar o número congelado.
--
-- Então o que este script faz é trocar um custo congelado por um calculado. No
-- teste, as pizzas do Matri caíram ~0,6% (4 FORMAGGIO de R$ 17,42 pra R$ 17,31;
-- CABRISSIMA E FIGO de R$ 72,20 pra R$ 71,81). A diferença é pequena porque o
-- valor congelado ainda estava perto — mas ele estava PARADO, e o novo sobe e
-- desce com o preço do queijo sozinho. É a razão de existir deste sistema:
-- custo nunca é persistido, é sempre recalculado.
--
-- Pré-requisitos, nesta ordem:
--   1. migration 20260917180000_unidade_estoque_compartilhado
--   2. noroeste-matri-unificar.sql (Matri ligado à despensa do Noroeste)
--   3. o deploy do código que faz o índice de receitas cobrir a cozinha —
--      sem ele, a sub-receita do Noroeste não é encontrada e a ficha do Matri
--      continua custando zero (só que agora por outro motivo).
--
-- CAPRESE NÃO ENTRA AQUI, de propósito. As duas existem nas duas casas com o
-- mesmo nome, mas não são o mesmo prato: a do Noroeste é salada (búfala,
-- tomate cereja, rúcula) e a do Matri é PIZZA (massa, molho de bordas). Nome
-- igual, prato diferente — fundir seria destruir uma das duas.
--
-- Idempotente. Sem BEGIN/COMMIT (o editor do Neon roda cada comando em
-- autocommit). Faça o backup antes: mexe em linha de ficha.

-- ---------------------------------------------------------------------------
-- Passo 1 — PLANO. Confira antes de seguir.
--
-- Espere 3 linhas. `ingr_real` é quantos ingredientes a receita do Noroeste
-- tem (a de verdade); `ingr_casca` tem que ser 1 em todas. `linhas_a_repontar`
-- é quantas fichas do Matri passam a custar certo.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW "_cascas_matri" AS
WITH nomes(chave) AS (
  VALUES ('brigadeiro de pistache'), ('fonduta de parmesão'), ('doce de leite')
)
SELECT
  real.nome                AS receita,
  real.id                  AS receita_real_id,
  casca.id                 AS receita_casca_id,
  (SELECT count(*) FROM "IngredienteReceita" i WHERE i."receitaId" = real.id)  AS ingr_real,
  (SELECT count(*) FROM "IngredienteReceita" i WHERE i."receitaId" = casca.id) AS ingr_casca,
  (SELECT count(*) FROM "IngredienteReceita" i WHERE i."subReceitaId" = casca.id) AS linhas_a_repontar,
  (SELECT count(*) FROM "ItemVenda" iv WHERE iv."receitaId" = casca.id)        AS itens_de_venda_na_casca
FROM nomes n
JOIN "Unidade" un ON un.nome = 'Noroeste'
JOIN "Unidade" um ON um.nome = 'Matri'
JOIN "Receita" real  ON real."unidadeId"  = un.id AND lower(btrim(real.nome))  = n.chave
JOIN "Receita" casca ON casca."unidadeId" = um.id AND lower(btrim(casca.nome)) = n.chave;

SELECT receita, ingr_real, ingr_casca, linhas_a_repontar, itens_de_venda_na_casca
FROM "_cascas_matri" ORDER BY linhas_a_repontar DESC;

-- 1b) Quais fichas do Matri mudam de custo. É a lista pra conferir depois.
SELECT c.receita AS casca, r.nome AS ficha_do_matri, i.quantidade, i."unidadeMedida"
FROM "_cascas_matri" c
JOIN "IngredienteReceita" i ON i."subReceitaId" = c.receita_casca_id
JOIN "Receita" r ON r.id = i."receitaId"
ORDER BY c.receita, r.nome;

-- ---------------------------------------------------------------------------
-- Passo 2 — Reaponta as linhas de ficha da casca pra receita de verdade.
-- Quantidade e unidade não mudam: o que muda é o que a sub-receita contém.
-- ---------------------------------------------------------------------------
UPDATE "IngredienteReceita" i
SET "subReceitaId" = c.receita_real_id
FROM "_cascas_matri" c
WHERE i."subReceitaId" = c.receita_casca_id;

-- ---------------------------------------------------------------------------
-- Passo 3 — Se algum ItemVenda apontava direto pra casca, aponta pra real.
-- (No levantamento eram zero, mas rodar é barato e a alternativa é uma ficha
-- órfã depois do passo 4.)
-- ---------------------------------------------------------------------------
UPDATE "ItemVenda" iv
SET "receitaId" = c.receita_real_id
FROM "_cascas_matri" c
WHERE iv."receitaId" = c.receita_casca_id;

-- ---------------------------------------------------------------------------
-- Passo 4 — Apaga as cascas, agora sem nenhuma referência.
-- Primeiro o ingrediente único delas, depois a receita.
-- ---------------------------------------------------------------------------
DELETE FROM "IngredienteReceita"
WHERE "receitaId" IN (SELECT receita_casca_id FROM "_cascas_matri");

DELETE FROM "Receita" r
WHERE r.id IN (SELECT receita_casca_id FROM "_cascas_matri")
  AND NOT EXISTS (SELECT 1 FROM "IngredienteReceita" i WHERE i."subReceitaId" = r.id)
  AND NOT EXISTS (SELECT 1 FROM "ItemVenda" iv WHERE iv."receitaId" = r.id);

-- ---------------------------------------------------------------------------
-- Passo 5 — Desativa os produtos que eram só a casca disfarçada de insumo.
--
-- FONDUTA DE PARMESÃO e DOCE DE LEITE deixam de ser usados em ficha nenhuma
-- depois do passo 4. Enquanto estiverem ativos, continuam no seletor de
-- ingrediente com aquele preço congelado, esperando alguém escolher por engano.
-- Desativa, não apaga: o histórico de preço continua legível.
--
-- BRIGADEIRO DE PISTACHE NÃO entra: ele ainda é usado em 2 fichas — as receitas
-- BRIGADEIRO DE PISTACHE do Noroeste e do 104 Sul contêm, entre os ingredientes
-- reais, 35 G do produto de mesmo nome. É auto-referência da importação, um
-- defeito à parte (e em outra casa), que não é escopo deste script.
-- ---------------------------------------------------------------------------
UPDATE "Produto" p
SET ativo = false
WHERE lower(btrim(p.nome)) IN ('fonduta de parmesão', 'doce de leite')
  AND p.ativo
  AND NOT EXISTS (SELECT 1 FROM "IngredienteReceita" i WHERE i."produtoId" = p.id);

DROP VIEW "_cascas_matri";

-- ---------------------------------------------------------------------------
-- Verificação
-- ---------------------------------------------------------------------------

-- 4a) Tem que voltar VAZIO: nenhuma receita casca sobrou em Matri.
SELECT r.nome, (SELECT count(*) FROM "IngredienteReceita" i WHERE i."receitaId" = r.id) AS ingredientes
FROM "Receita" r JOIN "Unidade" un ON un.id = r."unidadeId"
WHERE un.nome = 'Matri'
  AND lower(btrim(r.nome)) IN ('brigadeiro de pistache', 'fonduta de parmesão', 'doce de leite');

-- 4b) As fichas do Matri agora apontam pra receita do Noroeste, que tem
--     ingrediente de verdade. `ingr_da_subreceita` tem que ser > 1 em todas.
SELECT r.nome AS ficha_do_matri, sr.nome AS sub_receita,
       un2.nome AS sub_receita_mora_em,
       (SELECT count(*) FROM "IngredienteReceita" x WHERE x."receitaId" = sr.id) AS ingr_da_subreceita
FROM "IngredienteReceita" i
JOIN "Receita" r   ON r.id = i."receitaId"
JOIN "Unidade" un  ON un.id = r."unidadeId"
JOIN "Receita" sr  ON sr.id = i."subReceitaId"
JOIN "Unidade" un2 ON un2.id = sr."unidadeId"
WHERE un.nome = 'Matri'
  AND lower(btrim(sr.nome)) IN ('brigadeiro de pistache', 'fonduta de parmesão', 'doce de leite')
ORDER BY sr.nome, r.nome;

-- 4c) O CAPRESE do Matri (a pizza) tem que continuar intacto, com os 7
--     ingredientes dele. Se vier diferente, algo pegou o que não devia.
SELECT r.nome, (SELECT count(*) FROM "IngredienteReceita" i WHERE i."receitaId" = r.id) AS ingredientes
FROM "Receita" r JOIN "Unidade" un ON un.id = r."unidadeId"
WHERE un.nome = 'Matri' AND lower(btrim(r.nome)) = 'caprese';
