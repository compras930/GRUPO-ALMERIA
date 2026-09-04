-- Unifica os produtos homônimos cadastrados em unidades de medida diferentes.
--
-- Problema: 67 nomes do catálogo existem em mais de uma unidade de medida (ex.:
-- "ALECRIM" em KG, UND e LT — todos a R$ 50,00). Cada ficha aponta pra um
-- produtoId específico, então o mesmo insumo é precificado por cadastros
-- distintos. Como o importador de preço casa por nome + unidade, a planilha do
-- Teknisa atualiza só o cadastro principal: as fichas penduradas nos cadastros
-- satélites ficam com preço congelado pra sempre, sem ninguém perceber. São 226
-- linhas de ficha nessa situação.
--
-- A evidência de que é o mesmo insumo é o PREÇO: em 77 dos 83 satélites em uso a
-- faixa de preço (mínimo–máximo entre as 5 casas) coincide com a do cadastro
-- principal — "ALECRIM" custa R$ 50,00 em KG, em UND e em LT. É resíduo da
-- padronização que converteu G→KG, ML→LT e UN/UNIDADE/UNI/UNID→UND.
--
-- Essa checagem de preço é REGRA DO SCRIPT, não pressuposto: cada satélite só é
-- mesclado se o preço confirmar, e os que não confirmam saem num relatório pra
-- decisão humana em vez de serem mesclados no escuro. Sem isso o script seria
-- perigoso em qualquer outro estado do banco — no Postgres local de teste, que
-- ainda tem cadastros legados em G e ML, ele juntaria um cadastro em G com outro
-- em KG (preço ~1000x diferente) e inflaria o custo de todas as fichas
-- envolvidas. Pela mesma razão o destino prefere sempre a unidade do padrão
-- (KG/LT/UND, mais CX pra embalagem) antes de contar fichas: no banco local o
-- cadastro legado tem MAIS fichas, e sem essa preferência "água" consolidaria em
-- ML e "sal refinado" em G.
--
-- Casos que este script NÃO toca, por decisão de quem conhece a operação:
--   - "pão semi italiano": KG a R$ 7,70 e UND a R$ 0,64 (~83 g por pão). Pão
--     comprado a quilo E vendido à unidade — as duas unidades são reais.
--   - "pão rustico branco": as 3 fichas em KG usam 0,1 kg, 0,1 kg e 1 kg, que é
--     peso de verdade (fatia na caldeirada, 1 kg pra fazer migas fritas).
--     Converter pra "pães" exigiria estimar o peso do pão e estragaria dado que
--     hoje está certo.
--
-- Rode o produtos-duplicados-01-diagnostico.sql antes se quiser rever o quadro.
-- Seguro de rodar mais de uma vez. Tudo numa transação. Faça o branch de backup
-- no Neon antes.

BEGIN;

-- ---------------------------------------------------------------------------
-- Passo 1 — Escolhe o cadastro que fica em cada grupo e registra o mapa.
--
-- O critério padrão é "o mais usado em ficha": é onde está a massa das receitas
-- e o histórico de preço mais rico, então mexer nele é o maior risco. Um grupo
-- foge do padrão e está na tabela de exceção abaixo: "couve", onde o cadastro
-- com mais fichas é o UND (2) mas a unidade correta é KG (informado por quem
-- compra) — as duas fichas usam 0,04, que é 40 g de couve num caldo verde, não
-- 4% de uma couve.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "_produtos_mesclados_unidade" (
  dup_id         text PRIMARY KEY,
  dup_nome       text NOT NULL,
  dup_unidade    text NOT NULL,
  keep_id        text NOT NULL,
  keep_nome      text NOT NULL,
  keep_unidade   text NOT NULL,
  grupo          text NOT NULL,
  fichas_movidas integer NOT NULL,
  mesclado_em    timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE VIEW "_homonimos_candidatos" AS
WITH decisao_manual(grupo, unidade) AS (
  -- Unidade correta informada por quem compra, para os casos em que o preço
  -- sozinho não decide. Vence a contagem de fichas E dispensa a checagem de
  -- preço abaixo (é decisão humana, não inferência).
  --   couve   : cadastro com mais fichas é UND (2), mas as duas fichas usam
  --             0,04 — 40 g de couve num caldo verde, não 4% de uma couve.
  --   salsão  : 1 ficha em UND usando 0,06 (60 g).
  --   gengibre: 2 fichas em LT/UND usando 0,016 e 0,04 (16 g e 40 g).
  --   tahine  : 1 ficha de cada lado, empate que o desempate por histórico de
  --             preço resolveria em UND — mas o próprio nome do produto termina
  --             em "KG". Fixado pra não deixar o acaso decidir.
  VALUES ('couve', 'KG'), ('salsão', 'KG'), ('gengibre', 'KG'),
         ('tahine - pasta de gergelim kg', 'KG')
),
nao_mexer(grupo) AS (
  -- Duas unidades reais, não erro de cadastro (ver cabeçalho).
  VALUES ('pão semi italiano'), ('pão rustico branco')
),
uso AS (
  SELECT
    p.id, p.nome, p."unidadeMedida" AS unidade, p."criadoEm",
    lower(btrim(p.nome)) AS grupo,
    (SELECT count(*) FROM "IngredienteReceita" x WHERE x."produtoId" = p.id) AS fichas,
    (SELECT count(*) FROM "PrecoAtualProduto"  x WHERE x."produtoId" = p.id) AS precos,
    (SELECT min(x.preco) FROM "PrecoAtualProduto" x WHERE x."produtoId" = p.id) AS preco_min,
    (SELECT max(x.preco) FROM "PrecoAtualProduto" x WHERE x."produtoId" = p.id) AS preco_max
  FROM "Produto" p
),
grupos AS (
  SELECT u.grupo
  FROM uso u
  WHERE u.grupo NOT IN (SELECT grupo FROM nao_mexer)
  GROUP BY u.grupo
  HAVING count(DISTINCT u.unidade) > 1
),
ranqueados AS (
  SELECT
    u.*,
    (d.unidade IS NOT NULL) AS grupo_tem_decisao_manual,
    row_number() OVER (
      PARTITION BY u.grupo
      ORDER BY
        -- 1) decisão humana manda
        (d.unidade IS NOT NULL AND u.unidade = d.unidade) DESC,
        -- 2) unidade do padrão do catálogo (KG/LT/UND, mais CX pra embalagem)
        --    antes de qualquer legado (G, ML, UN, UNIDADE...). Sem isso, um
        --    catálogo onde o cadastro legado tem mais fichas consolidaria PARA
        --    a unidade errada — aconteceu no banco local de teste, onde "água"
        --    ia parar em ML e "sal refinado" em G.
        (u.unidade IN ('KG', 'LT', 'UND', 'CX')) DESC,
        u.fichas DESC, u.precos DESC, u."criadoEm" ASC, u.id ASC
    ) AS posicao
  FROM uso u
  JOIN grupos g ON g.grupo = u.grupo
  LEFT JOIN decisao_manual d ON d.grupo = u.grupo
)
SELECT
  s.id AS dup_id, s.nome AS dup_nome, s.unidade AS dup_unidade, s.fichas AS fichas_movidas,
  k.id AS keep_id, k.nome AS keep_nome, k.unidade AS keep_unidade,
  s.grupo,
  s.preco_min AS dup_preco_min, s.preco_max AS dup_preco_max,
  k.preco_min AS keep_preco_min, k.preco_max AS keep_preco_max,
  -- Evidência de que é o MESMO insumo com rótulo de unidade errado: o preço.
  -- Faixa = mínimo–máximo entre as 5 casas. Se as faixas se sobrepõem (ou ficam
  -- a até 1,5x / 0,7x de distância, que é variação normal de compra entre casa e
  -- data), é o mesmo produto e repontar não distorce custo. Sem preço em alguma
  -- ponta não há evidência CONTRA, e mesclar só pode melhorar (uma ficha pendurada
  -- em cadastro sem preço custa zero hoje).
  --
  -- É esta checagem que impede o script de juntar coisas como um cadastro em G
  -- com outro em KG, cujo preço difere ~1000x e cuja mesclagem inflaria o custo
  -- de todas as fichas envolvidas.
  (
    s.grupo_tem_decisao_manual
    OR s.preco_min IS NULL OR k.preco_min IS NULL
    OR (s.preco_min <= k.preco_max AND k.preco_min <= s.preco_max)
    OR (k.preco_max > 0 AND s.preco_min > k.preco_max AND s.preco_min / k.preco_max <= 1.5)
    OR (k.preco_min > 0 AND s.preco_max < k.preco_min AND s.preco_max / k.preco_min >= 0.7)
  ) AS preco_confirma
FROM ranqueados s
JOIN ranqueados k ON k.grupo = s.grupo AND k.posicao = 1
WHERE s.posicao > 1;

-- Só entram na mesclagem os satélites cujo preço confirma que é o mesmo insumo.
INSERT INTO "_produtos_mesclados_unidade"
  (dup_id, dup_nome, dup_unidade, keep_id, keep_nome, keep_unidade, grupo, fichas_movidas)
SELECT dup_id, dup_nome, dup_unidade, keep_id, keep_nome, keep_unidade, grupo, fichas_movidas
FROM "_homonimos_candidatos"
WHERE preco_confirma
ON CONFLICT (dup_id) DO NOTHING;

-- Os que o preço NÃO confirma ficam de fora e são listados pra revisão humana.
SELECT grupo, keep_unidade AS unidade_principal, dup_unidade AS unidade_deixada_de_fora,
       fichas_movidas AS fichas_afetadas,
       keep_preco_min, keep_preco_max, dup_preco_min, dup_preco_max
FROM "_homonimos_candidatos"
WHERE NOT preco_confirma
ORDER BY fichas_movidas DESC, grupo;

DROP VIEW "_homonimos_candidatos";

-- ---------------------------------------------------------------------------
-- Passo 2 — Verificação PRÉVIA (só relatório, não altera nada).
--
-- O cálculo de custo usa `preço ?? 0`: se uma ficha for repontada pra um produto
-- que não tem preço cadastrado NA CASA dela, o custo daquele ingrediente vira
-- zero em silêncio. O passo 4a evita isso herdando o preço do satélite quando o
-- destino não tem preço pra aquela casa; esta consulta mostra o que sobraria
-- mesmo assim — e nesses casos o custo JÁ era zero antes da mesclagem (nem o
-- satélite tinha preço), então não é regressão, mas é bom saber quais são.
-- ---------------------------------------------------------------------------
SELECT
  m.grupo, m.dup_unidade AS de, m.keep_unidade AS para,
  un.nome AS casa, r.nome AS ficha, i.quantidade
FROM "_produtos_mesclados_unidade" m
JOIN "IngredienteReceita" i ON i."produtoId" = m.dup_id
JOIN "Receita" r  ON r.id = i."receitaId"
JOIN "Unidade" un ON un.id = r."unidadeId"
WHERE NOT EXISTS (
        SELECT 1 FROM "PrecoAtualProduto" pk
        WHERE pk."produtoId" = m.keep_id AND pk."unidadeId" = r."unidadeId")
  AND NOT EXISTS (
        SELECT 1 FROM "PrecoAtualProduto" pd
        WHERE pd."produtoId" = m.dup_id  AND pd."unidadeId" = r."unidadeId")
ORDER BY m.grupo, un.nome;

-- ---------------------------------------------------------------------------
-- Passo 3 — Reponta as fichas e reescreve a unidade da linha.
--
-- A unidade da linha TEM que acompanhar: o custo é quantidade × preço por
-- unidade canônica do produto (explodirReceitaPura não converte nada), e a
-- validação de salvamento recusa linha cuja unidade não bate com a do produto.
-- Sem reescrever, essas fichas ficariam impossíveis de salvar pela tela.
-- ---------------------------------------------------------------------------
UPDATE "IngredienteReceita" i
SET "produtoId" = m.keep_id, "unidadeMedida" = m.keep_unidade
FROM "_produtos_mesclados_unidade" m
WHERE i."produtoId" = m.dup_id;

-- Histórico de preço acompanha o produto que fica (não se perde nada).
UPDATE "HistoricoPrecoProduto" t SET "produtoId" = m.keep_id
  FROM "_produtos_mesclados_unidade" m WHERE t."produtoId" = m.dup_id;

UPDATE "MovimentoEstoque" t SET "produtoId" = m.keep_id
  FROM "_produtos_mesclados_unidade" m WHERE t."produtoId" = m.dup_id;

UPDATE "ContagemEstoque" t SET "produtoId" = m.keep_id
  FROM "_produtos_mesclados_unidade" m WHERE t."produtoId" = m.dup_id;

UPDATE "ItemPedido" t SET "produtoId" = m.keep_id
  FROM "_produtos_mesclados_unidade" m WHERE t."produtoId" = m.dup_id;

UPDATE "ItemNotaCompra" t SET "produtoId" = m.keep_id
  FROM "_produtos_mesclados_unidade" m WHERE t."produtoId" = m.dup_id;

-- ---------------------------------------------------------------------------
-- Passo 4 — Tabelas com unique [unidadeId, produtoId]: repontar direto violaria
-- a constraint quando o destino já tem linha pra mesma casa.
-- ---------------------------------------------------------------------------

-- 4a) PrecoAtualProduto — o preço do DESTINO manda, sempre.
--
-- Regra diferente da mesclagem de grafia (onde vencia a dataCompra mais
-- recente), e a diferença importa: o satélite costuma ter 1 preço solto e o
-- destino tem o histórico de compra de verdade. Se o satélite pudesse vencer, um
-- preço de 1 registro sobrescreveria o do destino e mexeria no custo de TODAS as
-- fichas dele — no sal refinado seriam 310 fichas em vez das 26 que a gente quer
-- corrigir.
--
-- O único caso em que o preço do satélite é aproveitado: quando o destino não
-- tem preço nenhum pra aquela casa. Aí herdar preserva exatamente o custo de
-- hoje daquela ficha, em vez de zerar. Não é inventar preço — é o único valor
-- observado pra aquela casa.
INSERT INTO "PrecoAtualProduto" (id, "unidadeId", "produtoId", preco, "dataCompra", "atualizadoEm")
SELECT DISTINCT ON (m.keep_id, pa."unidadeId")
  gen_random_uuid()::text, pa."unidadeId", m.keep_id, pa.preco, pa."dataCompra", now()
FROM "PrecoAtualProduto" pa
JOIN "_produtos_mesclados_unidade" m ON m.dup_id = pa."produtoId"
ORDER BY m.keep_id, pa."unidadeId", pa."dataCompra" DESC
ON CONFLICT ("unidadeId", "produtoId") DO NOTHING;

DELETE FROM "PrecoAtualProduto"
WHERE "produtoId" IN (SELECT dup_id FROM "_produtos_mesclados_unidade");

-- 4b) EstoqueSaldo — soma. É quantidade física do mesmo insumo cadastrado duas
--     vezes, e o ledger (MovimentoEstoque) já foi repontado no passo 3, então a
--     soma mantém saldo e ledger coerentes.
INSERT INTO "EstoqueSaldo" (id, "unidadeId", "produtoId", quantidade, "atualizadoEm")
SELECT gen_random_uuid()::text, es."unidadeId", m.keep_id, sum(es.quantidade), now()
FROM "EstoqueSaldo" es
JOIN "_produtos_mesclados_unidade" m ON m.dup_id = es."produtoId"
GROUP BY es."unidadeId", m.keep_id
ON CONFLICT ("unidadeId", "produtoId") DO UPDATE
SET quantidade = "EstoqueSaldo".quantidade + EXCLUDED.quantidade, "atualizadoEm" = now();

DELETE FROM "EstoqueSaldo"
WHERE "produtoId" IN (SELECT dup_id FROM "_produtos_mesclados_unidade");

-- 4c) ParametroEstoqueProduto — estoque mínimo/ideal é parâmetro definido a mão;
--     o do destino manda, o do satélite só entra se o destino não tinha.
INSERT INTO "ParametroEstoqueProduto" (id, "unidadeId", "produtoId", "estoqueMinimo", "estoqueIdeal")
SELECT DISTINCT ON (m.keep_id, pe."unidadeId")
  gen_random_uuid()::text, pe."unidadeId", m.keep_id, pe."estoqueMinimo", pe."estoqueIdeal"
FROM "ParametroEstoqueProduto" pe
JOIN "_produtos_mesclados_unidade" m ON m.dup_id = pe."produtoId"
ORDER BY m.keep_id, pe."unidadeId", pe.id
ON CONFLICT ("unidadeId", "produtoId") DO NOTHING;

DELETE FROM "ParametroEstoqueProduto"
WHERE "produtoId" IN (SELECT dup_id FROM "_produtos_mesclados_unidade");

-- ---------------------------------------------------------------------------
-- Passo 5 — Nada mais aponta pra elas: apaga as linhas de Produto satélites.
-- ---------------------------------------------------------------------------
DELETE FROM "Produto" WHERE id IN (SELECT dup_id FROM "_produtos_mesclados_unidade");

COMMIT;

-- ---------------------------------------------------------------------------
-- Verificação (roda junto; resultados saem depois do COMMIT)
-- ---------------------------------------------------------------------------

-- 5a) O que foi unificado, com quantas fichas cada satélite carregava.
SELECT grupo, dup_unidade AS unidade_removida, keep_unidade AS unidade_mantida,
       fichas_movidas, keep_nome AS produto_final
FROM "_produtos_mesclados_unidade"
ORDER BY fichas_movidas DESC, grupo;

-- 5b) Tem que sobrar só o que foi decidido deixar em paz: "pão semi italiano" e
--     "pão rustico branco". Qualquer outro nome aqui é sinal de que algo não foi
--     mesclado.
SELECT lower(btrim(nome)) AS grupo, string_agg("unidadeMedida", ', ' ORDER BY "unidadeMedida") AS unidades
FROM "Produto"
GROUP BY lower(btrim(nome))
HAVING count(DISTINCT "unidadeMedida") > 1
ORDER BY 1;

-- 5c) Tem que voltar ZERO: linha de ficha cuja unidade não bate com a do produto
--     (é o que a validação de salvamento recusa).
SELECT un.nome AS casa, r.nome AS ficha, p.nome AS produto,
       i."unidadeMedida" AS na_linha, p."unidadeMedida" AS no_produto
FROM "IngredienteReceita" i
JOIN "Produto" p ON p.id = i."produtoId"
JOIN "Receita" r ON r.id = i."receitaId"
JOIN "Unidade" un ON un.id = r."unidadeId"
WHERE upper(btrim(i."unidadeMedida")) <> upper(btrim(p."unidadeMedida"))
ORDER BY un.nome, r.nome;

-- 5d) Tem que voltar ZERO: referência órfã apontando pra produto que não existe.
SELECT 'IngredienteReceita' AS tabela, count(*) AS orfaos FROM "IngredienteReceita" t
  WHERE t."produtoId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Produto" p WHERE p.id = t."produtoId")
UNION ALL SELECT 'PrecoAtualProduto', count(*) FROM "PrecoAtualProduto" t
  WHERE NOT EXISTS (SELECT 1 FROM "Produto" p WHERE p.id = t."produtoId")
UNION ALL SELECT 'HistoricoPrecoProduto', count(*) FROM "HistoricoPrecoProduto" t
  WHERE NOT EXISTS (SELECT 1 FROM "Produto" p WHERE p.id = t."produtoId")
UNION ALL SELECT 'EstoqueSaldo', count(*) FROM "EstoqueSaldo" t
  WHERE NOT EXISTS (SELECT 1 FROM "Produto" p WHERE p.id = t."produtoId")
UNION ALL SELECT 'MovimentoEstoque', count(*) FROM "MovimentoEstoque" t
  WHERE NOT EXISTS (SELECT 1 FROM "Produto" p WHERE p.id = t."produtoId")
UNION ALL SELECT 'ContagemEstoque', count(*) FROM "ContagemEstoque" t
  WHERE NOT EXISTS (SELECT 1 FROM "Produto" p WHERE p.id = t."produtoId")
UNION ALL SELECT 'ItemPedido', count(*) FROM "ItemPedido" t
  WHERE NOT EXISTS (SELECT 1 FROM "Produto" p WHERE p.id = t."produtoId")
UNION ALL SELECT 'ItemNotaCompra', count(*) FROM "ItemNotaCompra" t
  WHERE t."produtoId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Produto" p WHERE p.id = t."produtoId")
UNION ALL SELECT 'ParametroEstoqueProduto', count(*) FROM "ParametroEstoqueProduto" t
  WHERE NOT EXISTS (SELECT 1 FROM "Produto" p WHERE p.id = t."produtoId");

-- 5e) Efeito colateral esperado a revisar depois (não é erro): ficha que usava
--     duas unidades do mesmo insumo agora tem duas linhas do mesmo produtoId.
--     Somar ou apagar uma depende da ficha — entra na frente de saneamento.
SELECT r.nome AS receita, un.nome AS casa, p.nome AS produto, count(*) AS linhas_repetidas,
       string_agg(i.quantidade::text || ' ' || i."unidadeMedida", ' + ' ORDER BY i.id) AS quantidades
FROM "IngredienteReceita" i
JOIN "Receita" r  ON r.id = i."receitaId"
JOIN "Unidade" un ON un.id = r."unidadeId"
JOIN "Produto" p  ON p.id = i."produtoId"
WHERE i."produtoId" IN (SELECT keep_id FROM "_produtos_mesclados_unidade")
GROUP BY r.nome, un.nome, p.nome, i."receitaId", i."produtoId"
HAVING count(*) > 1
ORDER BY count(*) DESC, r.nome;
