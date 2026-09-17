-- Remove a linha em que uma receita lista, entre os ingredientes reais dela, o
-- Produto de mesmo nome — quando essa linha não pode ser um ingrediente.
--
-- O LEVANTAMENTO E POR QUE ELE NÃO VIRA UMA REGRA. O padrão "receita contém
-- produto homônimo" aparece 17 vezes, em 12 receitas. A leitura óbvia seria
-- "é auto-referência da importação, apaga todas". O dado derruba isso: na
-- maioria dos casos a linha é o INSUMO PRINCIPAL e apagá-la destruiria a
-- receita.
--
--   ARROZ BRANCO    1000 G de "ARROZ BRANCO" + alho + azeite + sal + água
--                   -> o produto é o arroz CRU, a receita é o arroz COZIDO.
--                      Mesmo nome, coisas diferentes. LEGÍTIMO.
--   PARMA             70 G de "PARMA" + pão + pesto + búfala + tomate seco
--                   -> "PARMA" é o presunto (R$ 151,80/kg). LEGÍTIMO.
--   PATO / MÚSCULO RESFRIADO / ACEM MOIDA / COXINHA DA ASA / PEPPERONI /
--   LINGUIÇA DE FRANGO / CROQUETA DE SOBREASSADA / IOGURTE NATURAL
--                   -> proteína ou insumo comprado + um preparo pequeno.
--                      É o mesmo padrão das aparas. LEGÍTIMO.
--                      (IOGURTE NATURAL é o caso didático: 180 G de iogurte
--                       como cultura pra 2 L de leite. É assim que se faz
--                       iogurte — o produto homônimo é o fermento.)
--
-- Sobram dois casos em que a linha não tem leitura possível como ingrediente,
-- porque os outros ingredientes JÁ constituem o produto inteiro:
--
--   BRIGADEIRO DE PISTACHE (Noroeste e 104 Sul)
--     leite condensado 1600 G + creme de leite 600 G + manteiga 100 G +
--     pasta de pistache 200 G = 2500 G que rendem 2127 G. Isso É o brigadeiro.
--     Somar 35 G de brigadeiro ao brigadeiro não descreve preparo nenhum.
--
--   SALADA DE FRUTAS (Noroeste e 104 Sul)
--     mamão + melancia + melão + uva preta + uva verde + granola + iogurte,
--     rendendo 15 UND. A linha diz "1 UND de SALADA DE FRUTAS" — um lote de
--     15 porções contendo 1 porção de si mesmo.
--
-- O peso é pequeno — centavos por lote. O que justifica mexer não é o valor:
-- esses centavos são custo CONGELADO, vêm do preço de um Produto que a
-- importação derivou e que nenhuma nota de compra atualiza. É a mesma família
-- do que foi corrigido nas cascas do Matri. O passo 1 imprime o valor exato
-- em produção antes de qualquer alteração.
--
-- (Uma versão anterior deste cabeçalho trazia um "achado maior" sobre a
-- sub-receita IOGURTE NATURAL custar R$ 344/kg. Era falso: veio do meu banco
-- local, corrompido por um teste antigo meu do script de unificação de
-- homônimos. A varredura quantidades-infladas-diagnostico.sql rodou em
-- produção e voltou ZERO linhas. Em produção a receita está correta.)
--
-- Idempotente. Sem BEGIN/COMMIT (o editor do Neon roda cada comando em
-- autocommit). Faça o backup antes: mexe em linha de ficha.

-- ---------------------------------------------------------------------------
-- Passo 1 — PLANO. Espere 4 linhas (2 receitas x 2 casas). `outros_ingredientes`
-- mostra que a receita continua de pé sem a linha removida.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW "_autoref_plano" AS
WITH alvo(chave) AS (
  VALUES ('brigadeiro de pistache'), ('salada de frutas')
)
SELECT
  un.nome                                        AS casa,
  r.nome                                         AS receita,
  i.id                                           AS linha_id,
  i.quantidade,
  i."unidadeMedida"                              AS un_linha,
  round(COALESCE(pa.preco, 0)::numeric, 4)       AS preco_do_produto,
  round((i.quantidade * COALESCE(pa.preco, 0))::numeric, 2) AS custo_que_sai,
  (SELECT count(*) - 1 FROM "IngredienteReceita" x WHERE x."receitaId" = r.id) AS outros_ingredientes
FROM alvo a
JOIN "Receita" r  ON lower(btrim(r.nome)) = a.chave
JOIN "Unidade" un ON un.id = r."unidadeId"
JOIN "IngredienteReceita" i ON i."receitaId" = r.id
JOIN "Produto" p  ON p.id = i."produtoId" AND lower(btrim(p.nome)) = lower(btrim(r.nome))
LEFT JOIN "PrecoAtualProduto" pa
       ON pa."produtoId" = p.id AND pa."unidadeId" = COALESCE(un."estoqueEmId", un.id);

SELECT casa, receita, quantidade, un_linha, preco_do_produto, custo_que_sai, outros_ingredientes
FROM "_autoref_plano" ORDER BY receita, casa;

-- ---------------------------------------------------------------------------
-- Passo 2 — Remove as linhas.
--
-- Só a linha, nunca a receita: o que fica é a receita real, com os
-- ingredientes que de fato a compõem. O rendimentoQtd NÃO é tocado — ao
-- contrário do caso de auto-referência por sub-receita (corrigido antes neste
-- projeto), aqui a quantidade não é uma anotação de rendimento disfarçada:
-- as duas receitas já têm rendimento próprio (2127 G e 15 UND).
-- ---------------------------------------------------------------------------
DELETE FROM "IngredienteReceita"
WHERE id IN (SELECT linha_id FROM "_autoref_plano");

-- ---------------------------------------------------------------------------
-- Passo 3 — Desativa os produtos que ficaram sem uso nenhum.
--
-- Enquanto estiverem ativos, seguem no seletor de ingrediente com aquele preço
-- derivado, esperando alguém escolher por engano. Desativa só se não sobrou
-- nenhuma referência — se ainda for usado em alguma ficha, fica como está.
-- ---------------------------------------------------------------------------
UPDATE "Produto" p
SET ativo = false
WHERE lower(btrim(p.nome)) IN ('brigadeiro de pistache', 'salada de frutas')
  AND p.ativo
  AND NOT EXISTS (SELECT 1 FROM "IngredienteReceita" i WHERE i."produtoId" = p.id);

DROP VIEW "_autoref_plano";

-- ---------------------------------------------------------------------------
-- Verificação
-- ---------------------------------------------------------------------------

-- 3a) Tem que voltar VAZIO: nenhuma das duas receitas ainda cita a si mesma.
SELECT un.nome AS casa, r.nome AS receita, i.quantidade
FROM "IngredienteReceita" i
JOIN "Receita" r  ON r.id = i."receitaId"
JOIN "Unidade" un ON un.id = r."unidadeId"
JOIN "Produto" p  ON p.id = i."produtoId"
WHERE lower(btrim(p.nome)) = lower(btrim(r.nome))
  AND lower(btrim(r.nome)) IN ('brigadeiro de pistache', 'salada de frutas');

-- 3b) As receitas continuam completas. Esperado: BRIGADEIRO DE PISTACHE com 4
--     ingredientes, SALADA DE FRUTAS com 7, nas duas casas.
SELECT un.nome AS casa, r.nome AS receita,
       (SELECT count(*) FROM "IngredienteReceita" i WHERE i."receitaId" = r.id) AS ingredientes
FROM "Receita" r JOIN "Unidade" un ON un.id = r."unidadeId"
WHERE lower(btrim(r.nome)) IN ('brigadeiro de pistache', 'salada de frutas')
ORDER BY r.nome, un.nome;

-- 3c) As outras 13 linhas do padrão continuam intactas — são insumo comprado,
--     não artefato. Esperado: 13 linhas, nenhuma delas brigadeiro ou salada.
SELECT un.nome AS casa, r.nome AS receita, i.quantidade, i."unidadeMedida"
FROM "IngredienteReceita" i
JOIN "Receita" r  ON r.id = i."receitaId"
JOIN "Unidade" un ON un.id = r."unidadeId"
JOIN "Produto" p  ON p.id = i."produtoId"
WHERE lower(btrim(p.nome)) = lower(btrim(r.nome))
  AND (SELECT count(*) FROM "IngredienteReceita" x WHERE x."receitaId" = r.id) > 1
ORDER BY r.nome, un.nome;
