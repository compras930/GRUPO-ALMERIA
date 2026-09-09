-- Faz a TELHA DE PARMESÃO da ficha 4 FORMAGGIO (Matri) custar o parmesão que
-- entra nela, em vez de custar zero.
--
-- POR QUE NÃO COPIEI A RECEITA QUE JÁ EXISTE. O diagnóstico classificou este
-- caso como "copiar de outra casa", porque existe uma Receita TELHA DE PARMESÃO
-- em 104 Sul e Noroeste. Investigando, copiar é o caminho pior:
--
--   TELHA DE PARMESÃO (rendimento 71,97 G)
--     <- 100 G da sub-receita QUEIJO PARMESÃO RALADO (rendimento 6.438,24 G)
--          <- 6.440 G do produto QUEIJO PARMESÃO
--
-- São duas receitas em cadeia, e os dois rendimentos são números DERIVADOS pela
-- importação do dashboard antigo (o decimal 6438.235616438356 é a assinatura
-- dessa derivação a partir do custo_unit). Replicar isso em Matri seria empilhar
-- estimativa sobre estimativa pra resolver uma linha de ficha — e a sub-receita
-- do meio ("parmesão ralado", 6.440 g entram, 6.438 g saem) não acrescenta
-- informação: é ralar queijo.
--
-- O caminho escolhido é o mesmo das aparas: uma Receita em Matri com 1 KG de
-- QUEIJO PARMESÃO, que passa a acompanhar sozinha o preço do queijo.
--
-- O RENDIMENTO NÃO É 1:1, e o número vem da própria casa. A receita de 104 Sul
-- registra 100 G de parmesão rendendo 71,97 G de telha — queijo assado perde
-- água, ~28%. Minha primeira versão assumia 1 KG rende 1 KG, o que dava R$ 75,90
-- por quilo de telha; o dado deles implica ~R$ 101/kg. Usar 0,72 em vez de 1
-- respeita a medição que a casa já tinha feito em vez do meu palpite. (0,72 e não
-- 0,719723865877712: aquele decimal é derivação da importação, e carregar 15
-- casas fingiria uma precisão que o dado não tem.)
--
-- DUAS SUPOSIÇÕES, confirmadas com o setor de compras antes de rodar:
--   1. O "0,03 UN" da linha significa 0,03 KG (30 g) de telha. Os outros cinco
--      ingredientes da ficha 4 FORMAGGIO estão todos em KG (0,01 / 0,1 / 0,32 /
--      0,17 / 0,04) — só a telha está marcada UN.
--   2. A telha de Matri é feita como a de 104 Sul (mesma perda de ~28%).
--
-- Escolhi o QUEIJO PARMESÃO genérico como origem, que é o mesmo insumo das
-- receitas de telha em 104 Sul e Noroeste — mantém a telha comparável entre as
-- casas. Matri também tem QUEIJO PARMESÃO HEBRON (mais barato, e usado nessa
-- mesma ficha): se a decisão for esse, troque o nome na tabela `mapa` do passo 1.
--
-- ACHADO À PARTE, que este script NÃO resolve: a Receita TELHA DE PARMESÃO de
-- BEIRA LAGO tem FARINHA DE TRIGO 0,25 KG + MOUSSELINE DE ABOBORA 0,5 KG. Isso
-- não é telha de parmesão — é outra preparação com o nome errado, e 2 fichas de
-- Beira Lago usam ela. Mesma família dos 33 ciclos já corrigidos: nome que casou
-- errado na importação. Entra na frente de saneamento.
--
-- Idempotente. Sem BEGIN/COMMIT (o editor do Neon roda cada comando em
-- autocommit). Mexe em linha de ficha — faça o backup antes.

-- ---------------------------------------------------------------------------
-- Passo 1 — Plano. CONFIRA: espere 1 linha (ficha 4 FORMAGGIO, Matri) com o
-- preço do parmesão em Matri preenchido. Se `preco_origem_na_casa` vier vazio,
-- PARE: o parmesão não tem preço em Matri e a telha continuaria em zero — nesse
-- caso o que falta é o preço do queijo, não esta receita.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW "_telha_plano" AS
WITH mapa(alvo_chave, origem_chave) AS (
  VALUES ('telha de parmesão', 'queijo parmesão')
)
SELECT
  alvo.id            AS alvo_produto_id,
  alvo.nome          AS alvo_nome,
  org.id             AS origem_produto_id,
  org.nome           AS origem_nome,
  i.id               AS linha_id,
  i.quantidade,
  i."unidadeMedida"  AS un_linha,
  r.nome             AS ficha,
  un.id              AS casa_id,
  un.nome            AS casa,
  (SELECT pr.preco FROM "PrecoAtualProduto" pr
    WHERE pr."produtoId" = org.id AND pr."unidadeId" = un.id) AS preco_origem_na_casa
FROM mapa m
JOIN "Produto" alvo ON lower(btrim(alvo.nome)) = m.alvo_chave
JOIN "Produto" org  ON lower(btrim(org.nome))  = m.origem_chave
JOIN "IngredienteReceita" i ON i."produtoId" = alvo.id
JOIN "Receita" r  ON r.id = i."receitaId"
JOIN "Unidade" un ON un.id = r."unidadeId";

SELECT alvo_nome, casa, ficha, quantidade, un_linha, origem_nome, preco_origem_na_casa
FROM "_telha_plano";

-- ---------------------------------------------------------------------------
-- Passo 2 — Cria a Receita da telha na casa da ficha (1 KG de parmesão rende
-- 0,72 KG de telha) e o ingrediente dela. Só age onde a origem TEM preço na
-- casa: sem preço, a receita nasceria custando zero e não resolveria nada.
-- ---------------------------------------------------------------------------
INSERT INTO "Receita" (id, "unidadeId", nome, "modoPreparo", "rendimentoQtd", "rendimentoUnidade", "criadoEm", "atualizadoEm")
SELECT DISTINCT gen_random_uuid()::text, p.casa_id, p.alvo_nome,
       'Parmesão ralado assado. 1 KG de queijo rende ~0,72 KG de telha (perde água no forno). Carrega o custo do ' || p.origem_nome || '.',
       0.72, 'KG', now(), now()
FROM "_telha_plano" p
WHERE p.preco_origem_na_casa > 0
ON CONFLICT ("unidadeId", nome) DO NOTHING;

INSERT INTO "IngredienteReceita" (id, "receitaId", "produtoId", "subReceitaId", quantidade, "unidadeMedida")
SELECT DISTINCT gen_random_uuid()::text, rc.id, p.origem_produto_id, NULL, 1, 'KG'
FROM "_telha_plano" p
JOIN "Receita" rc ON rc."unidadeId" = p.casa_id AND rc.nome = p.alvo_nome
WHERE p.preco_origem_na_casa > 0
  AND NOT EXISTS (SELECT 1 FROM "IngredienteReceita" x WHERE x."receitaId" = rc.id);

-- ---------------------------------------------------------------------------
-- Passo 3 — Reaponta a linha da ficha pro sub-receita. A quantidade permanece
-- (0,03) e a unidade passa de UN pra KG, que é a leitura confirmada: 30 g.
-- ---------------------------------------------------------------------------
UPDATE "IngredienteReceita" i
SET "produtoId" = NULL, "subReceitaId" = rc.id, "unidadeMedida" = 'KG'
FROM "_telha_plano" p
JOIN "Receita" rc ON rc."unidadeId" = p.casa_id AND rc.nome = p.alvo_nome
WHERE i.id = p.linha_id
  AND i."produtoId" = p.alvo_produto_id
  AND p.preco_origem_na_casa > 0;

-- ---------------------------------------------------------------------------
-- Passo 4 — Desativa o produto se ele não é mais usado em ficha nenhuma.
-- ---------------------------------------------------------------------------
UPDATE "Produto" p
SET ativo = false
WHERE lower(btrim(p.nome)) = 'telha de parmesão'
  AND p.ativo
  AND NOT EXISTS (SELECT 1 FROM "IngredienteReceita" i WHERE i."produtoId" = p.id);

DROP VIEW "_telha_plano";

-- ---------------------------------------------------------------------------
-- Verificação
-- ---------------------------------------------------------------------------

-- 4a) O custo que a linha passou a contar (era ZERO). Esperado:
--     0,03 ÷ 0,72 × preço do parmesão em Matri.
SELECT un.nome AS casa, r.nome AS ficha, sr.nome AS sub_receita, i.quantidade, i."unidadeMedida",
       round((i.quantidade * (
         SELECT ing.quantidade * pr.preco
         FROM "IngredienteReceita" ing
         JOIN "PrecoAtualProduto" pr ON pr."produtoId" = ing."produtoId" AND pr."unidadeId" = r."unidadeId"
         WHERE ing."receitaId" = sr.id
       ) / NULLIF(sr."rendimentoQtd", 0))::numeric, 2) AS custo_da_linha
FROM "IngredienteReceita" i
JOIN "Receita" sr ON sr.id = i."subReceitaId"
JOIN "Receita" r  ON r.id = i."receitaId"
JOIN "Unidade" un ON un.id = r."unidadeId"
WHERE lower(btrim(sr.nome)) = 'telha de parmesão';

-- 4b) Tem que voltar VAZIO: nenhuma linha de ficha ainda apontando pro produto.
SELECT un.nome AS casa, r.nome AS ficha, i.quantidade
FROM "IngredienteReceita" i
JOIN "Produto" p  ON p.id = i."produtoId"
JOIN "Receita" r  ON r.id = i."receitaId"
JOIN "Unidade" un ON un.id = r."unidadeId"
WHERE lower(btrim(p.nome)) = 'telha de parmesão';
