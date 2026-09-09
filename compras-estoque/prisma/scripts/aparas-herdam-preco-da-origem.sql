-- Faz as aparas e a carcaça herdarem o preço do insumo de onde saem, em vez de
-- receberem um preço fixo.
--
-- Contexto: três dos 19 produtos com custo zero são aproveitamento — sobra de
-- outro corte, que segundo o setor de compras carrega o custo normal do insumo
-- de origem:
--
--   Apara de Carne             <- ALCATRA BOVINO KG     (104 Sul, Noroeste)
--   Aparas/Talos de Cogumelo   <- COGUMELO PORTO BELLO  (104 Sul, Noroeste)
--   CARCAÇA DE PEIXE           <- ROBALO FILE           (Beira Lago)
--
-- POR QUE HERANÇA E NÃO PREÇO FIXO. Gravar 74,90 direto na "Apara de Carne"
-- resolveria hoje e criaria um problema amanhã: quando a alcatra mudar de preço,
-- a apara ficaria congelada, silenciosamente. É exatamente a família de bug que
-- este projeto passou dias corrigindo (fichas penduradas em cadastros que o
-- importador de preço nunca atualiza). O sistema não tem como um Produto seguir
-- o preço de outro Produto — o mecanismo que existe pra isso é a sub-receita,
-- cujo custo é sempre recalculado a partir dos ingredientes.
--
-- COMO FICA. Para cada apara, uma Receita na casa dela com um único ingrediente:
-- 1 KG do insumo de origem, rendendo 1 KG. A ficha passa a apontar pra essa
-- sub-receita em vez do produto zerado, mantendo a quantidade. O cálculo fica
-- quantidade ÷ rendimento × custo do lote = 1,5 ÷ 1 × 74,90 = R$ 112,35 pros
-- 1,5 kg de apara do CALDO DE CARNE. Quando a alcatra subir, esse número sobe
-- sozinho.
--
-- Uma receita de 1 ingrediente tem a mesma FORMA das "cascas" que a importação
-- deixou e que eu sinalizei como artefato — a diferença é o conteúdo: casca é
-- receita que contém o produto de mesmo nome (não explica nada); esta contém um
-- produto DIFERENTE, e é a afirmação "apara de carne é alcatra", que é
-- informação de verdade.
--
-- Também preenche duas lacunas de preço no catálogo, que são pré-requisito:
-- ALCATRA BOVINO KG não tinha preço em Noroeste (R$ 74,90, informado) e ROBALO
-- FILE não tinha em Beira Lago (R$ 79,90, informado). Sem isso a herança
-- funcionaria numa casa e deixaria a outra em zero.
--
-- Idempotente e sem BEGIN/COMMIT (o editor do Neon roda cada comando em
-- autocommit). Faça o branch de backup antes: os passos 4 e 5 mexem em ficha.

-- ---------------------------------------------------------------------------
-- Passo 1 — Mapa do que vai ser feito. CONFIRA antes de seguir: têm que
-- aparecer 5 linhas (2 aparas de carne + 2 de cogumelo + 1 carcaça), cada uma
-- com o insumo de origem identificado e o preço dele naquela casa.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW "_aparas_plano" AS
WITH mapa(apara_chave, origem_chave, preco_informado) AS (
  VALUES ('apara de carne',           'alcatra bovino kg',    74.90),
         ('aparas/talos de cogumelo', 'cogumelo porto bello', 58.20),
         ('carcaça de peixe',         'robalo file',          79.90)
)
SELECT
  m.apara_chave,
  m.origem_chave,
  m.preco_informado,
  pa_prod.id                AS apara_produto_id,
  pa_prod.nome              AS apara_nome,
  org.id                    AS origem_produto_id,
  org.nome                  AS origem_nome,
  i.id                      AS linha_id,
  i.quantidade,
  i."unidadeMedida"         AS un_linha,
  r.nome                    AS ficha,
  un.id                     AS casa_id,
  un.nome                   AS casa,
  (SELECT pr.preco FROM "PrecoAtualProduto" pr
    WHERE pr."produtoId" = org.id AND pr."unidadeId" = un.id) AS preco_origem_na_casa
FROM mapa m
JOIN "Produto" pa_prod ON lower(btrim(pa_prod.nome)) = m.apara_chave
JOIN "Produto" org     ON lower(btrim(org.nome))     = m.origem_chave
JOIN "IngredienteReceita" i ON i."produtoId" = pa_prod.id
JOIN "Receita" r  ON r.id = i."receitaId"
JOIN "Unidade" un ON un.id = r."unidadeId";

SELECT apara_nome, casa, ficha, quantidade, un_linha, origem_nome,
       preco_origem_na_casa, preco_informado
FROM "_aparas_plano"
ORDER BY apara_nome, casa;

-- ---------------------------------------------------------------------------
-- Passo 2 — Preenche o preço do insumo de ORIGEM onde falta (pré-requisito).
-- Só onde está zerado ou ausente; preço positivo existente manda.
-- ---------------------------------------------------------------------------
WITH atualizadas AS (
  UPDATE "PrecoAtualProduto" pr
  SET preco = p.preco_informado, "dataCompra" = now(), "atualizadoEm" = now()
  FROM "_aparas_plano" p
  WHERE pr."produtoId" = p.origem_produto_id
    AND pr."unidadeId" = p.casa_id
    AND pr.preco = 0
  RETURNING pr."unidadeId", pr."produtoId", pr.preco
),
inseridas AS (
  INSERT INTO "PrecoAtualProduto" (id, "unidadeId", "produtoId", preco, "dataCompra", "atualizadoEm")
  SELECT DISTINCT gen_random_uuid()::text, p.casa_id, p.origem_produto_id, p.preco_informado, now(), now()
  FROM "_aparas_plano" p
  ON CONFLICT ("unidadeId", "produtoId") DO NOTHING
  RETURNING "unidadeId", "produtoId", preco
),
aplicadas AS (SELECT * FROM atualizadas UNION ALL SELECT * FROM inseridas)
INSERT INTO "HistoricoPrecoProduto" (id, "unidadeId", "produtoId", preco, origem, "origemId", "dataCompra", "criadoEm")
SELECT gen_random_uuid()::text, a."unidadeId", a."produtoId", a.preco,
       'AJUSTE_PRECO_INFORMADO', 'preco informado pelo setor de compras', now(), now()
FROM aplicadas a;

-- ---------------------------------------------------------------------------
-- Passo 3 — Cria a Receita da apara em cada casa (1 KG de origem rende 1 KG),
-- e o ingrediente dela. Não recria se já existir.
-- ---------------------------------------------------------------------------
INSERT INTO "Receita" (id, "unidadeId", nome, "modoPreparo", "rendimentoQtd", "rendimentoUnidade", "criadoEm", "atualizadoEm")
SELECT DISTINCT gen_random_uuid()::text, p.casa_id, p.apara_nome,
       'Aproveitamento de ' || p.origem_nome || '. Carrega o custo do insumo de origem.',
       1, 'KG', now(), now()
FROM "_aparas_plano" p
ON CONFLICT ("unidadeId", nome) DO NOTHING;

-- O ingrediente único: 1 KG do insumo de origem. Só insere se a receita ainda
-- não tiver ingrediente nenhum (evita duplicar em reexecução).
INSERT INTO "IngredienteReceita" (id, "receitaId", "produtoId", "subReceitaId", quantidade, "unidadeMedida")
SELECT DISTINCT gen_random_uuid()::text, rc.id, p.origem_produto_id, NULL, 1, 'KG'
FROM "_aparas_plano" p
JOIN "Receita" rc ON rc."unidadeId" = p.casa_id AND rc.nome = p.apara_nome
WHERE NOT EXISTS (SELECT 1 FROM "IngredienteReceita" x WHERE x."receitaId" = rc.id);

-- ---------------------------------------------------------------------------
-- Passo 4 — Reaponta as linhas de ficha: do produto zerado para a sub-receita.
-- A quantidade permanece (1,5 kg de apara continua 1,5 kg) e a unidade passa a
-- ser a do rendimento.
-- ---------------------------------------------------------------------------
UPDATE "IngredienteReceita" i
SET "produtoId" = NULL, "subReceitaId" = rc.id, "unidadeMedida" = 'KG'
FROM "_aparas_plano" p
JOIN "Receita" rc ON rc."unidadeId" = p.casa_id AND rc.nome = p.apara_nome
WHERE i.id = p.linha_id
  AND i."produtoId" = p.apara_produto_id;   -- não mexe se já foi repontada

-- ---------------------------------------------------------------------------
-- Passo 5 — Os produtos de apara não são mais usados em ficha nenhuma. Desativa
-- (não apaga): eles são cadastro legítimo de catálogo, e desativar já os tira
-- do seletor de ingrediente sem destruir histórico.
-- ---------------------------------------------------------------------------
UPDATE "Produto" p
SET ativo = false
WHERE lower(btrim(p.nome)) IN ('apara de carne', 'aparas/talos de cogumelo', 'carcaça de peixe')
  AND p.ativo   -- sem isso, reexecução reporta UPDATE nas já desativadas
  AND NOT EXISTS (SELECT 1 FROM "IngredienteReceita" i WHERE i."produtoId" = p.id);

DROP VIEW "_aparas_plano";

-- ---------------------------------------------------------------------------
-- Verificação
-- ---------------------------------------------------------------------------

-- 5a) O custo que cada ficha passou a contar. Antes era ZERO nas 5 linhas.
--     Esperado: CALDO DE CARNE com 1,5 × 74,90 = 112,35 de apara de alcatra e
--     0,3 × 58,20 = 17,46 de talos de cogumelo; CALDO DE PEIXE com 5 × 79,90
--     = 399,50 de carcaça.
SELECT un.nome AS casa, r.nome AS ficha, sr.nome AS sub_receita, i.quantidade,
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
WHERE lower(btrim(sr.nome)) IN ('apara de carne', 'aparas/talos de cogumelo', 'carcaça de peixe')
ORDER BY custo_da_linha DESC;

-- 5b) Tem que voltar VAZIO: nenhuma linha de ficha ainda apontando pros produtos
--     de apara.
SELECT p.nome, count(*) AS linhas
FROM "IngredienteReceita" i
JOIN "Produto" p ON p.id = i."produtoId"
WHERE lower(btrim(p.nome)) IN ('apara de carne', 'aparas/talos de cogumelo', 'carcaça de peixe')
GROUP BY p.nome;

-- 5c) Quantas linhas de ficha ainda custam zero no sistema inteiro.
SELECT count(*) AS linhas_ainda_zeradas
FROM "IngredienteReceita" i
JOIN "Receita" r ON r.id = i."receitaId"
WHERE i."produtoId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "PrecoAtualProduto" pa
    WHERE pa."produtoId" = i."produtoId" AND pa."unidadeId" = r."unidadeId" AND pa.preco > 0
  );
