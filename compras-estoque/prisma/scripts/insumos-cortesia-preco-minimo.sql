-- Dá preço de R$ 0,01 aos insumos que a casa não custeia (água, gelo, água de
-- cocção), pra que "de graça por decisão" pare de ser indistinguível de "faltou
-- cadastrar o preço".
--
-- Contexto: um levantamento dos insumos com PrecoAtualProduto zerado achou 37
-- combinações produto×casa, e elas eram quatro coisas diferentes misturadas —
-- insumo comprado sem preço (mostarda dijon em 26 fichas, orégano em 13),
-- preparo da casa cadastrado como se fosse insumo comprado (os "SB ...", arroz
-- arbóreo cozido), lixo da importação (um produto chamado "TOTAL", usado com
-- quantidade zero em 20 fichas) e, este caso, insumo que é de graça mesmo.
--
-- Com tudo em R$ 0,00 não havia como separar os quatro olhando o dado. R$ 0,01
-- marca explicitamente o que é intencional: qualquer zero que sobrar depois
-- disto é problema de verdade. O valor é desprezível no custo (a água aparece em
-- 105 fichas; a 0,01/LT, uma ficha que usa 0,2 LT ganha R$ 0,002) e, no caso da
-- água de torneira, é perto do custo real.
--
-- Idempotente: só mexe onde o preço está zerado, então a segunda execução não
-- faz nada. Não sobrescreve preço de verdade que venha a ser cadastrado depois.

BEGIN;

-- ---------------------------------------------------------------------------
-- Passo 1 — Quais produtos entram (confira esta lista antes de seguir).
-- Casar por nome exato, não por ILIKE '%agua%': "ÁGUA COM GÁS" e "ÁGUA DE COCO"
-- são compra de verdade e não podem cair aqui.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _cortesia ON COMMIT DROP AS
SELECT p.id, p.nome, p."unidadeMedida"
FROM "Produto" p
WHERE lower(btrim(p.nome)) IN ('água', 'agua', 'gelo', 'agua coccão', 'água cocção', 'agua cocção');

SELECT c.nome, c."unidadeMedida",
       (SELECT count(*) FROM "IngredienteReceita" i WHERE i."produtoId" = c.id) AS fichas
FROM _cortesia c ORDER BY c.nome;

-- Guarda só o que ESTE script alterou, pra o histórico do passo 4 registrar
-- exatamente isso. Sem essa separação, o histórico marcaria como ajuste nosso
-- qualquer linha que já estivesse em 0,01 por outro motivo (a importação
-- original já deixou algumas assim).
CREATE TEMP TABLE _aplicado (unidade_id text, produto_id text) ON COMMIT DROP;

-- ---------------------------------------------------------------------------
-- Passo 2 — Preço 0,01 onde já existe linha de preço zerada.
-- ---------------------------------------------------------------------------
WITH atualizadas AS (
  UPDATE "PrecoAtualProduto" pa
  SET preco = 0.01, "dataCompra" = now(), "atualizadoEm" = now()
  FROM _cortesia c
  WHERE pa."produtoId" = c.id AND pa.preco = 0
  RETURNING pa."unidadeId", pa."produtoId"
)
INSERT INTO _aplicado SELECT * FROM atualizadas;

-- ---------------------------------------------------------------------------
-- Passo 3 — Cria linha de preço nas casas onde o insumo é USADO em ficha mas
-- não tem preço cadastrado nenhum. Sem isso, o custo continua zero nessas casas
-- (o cálculo usa `preço ?? 0`) e o problema seguiria invisível justamente onde
-- ninguém olhou.
-- ---------------------------------------------------------------------------
WITH inseridas AS (
  INSERT INTO "PrecoAtualProduto" (id, "unidadeId", "produtoId", preco, "dataCompra", "atualizadoEm")
  SELECT DISTINCT gen_random_uuid()::text, r."unidadeId", c.id, 0.01, now(), now()
  FROM _cortesia c
  JOIN "IngredienteReceita" i ON i."produtoId" = c.id
  JOIN "Receita" r ON r.id = i."receitaId"
  ON CONFLICT ("unidadeId", "produtoId") DO NOTHING
  RETURNING "unidadeId", "produtoId"
)
INSERT INTO _aplicado SELECT * FROM inseridas;

-- ---------------------------------------------------------------------------
-- Passo 4 — Registra no histórico, com origem própria pra ficar claro depois
-- que não veio de compra. Mesmo padrão das correções anteriores, que já criaram
-- origens próprias (IMPORTACAO_TEKNISA_MANUAL).
-- ---------------------------------------------------------------------------
INSERT INTO "HistoricoPrecoProduto" (id, "unidadeId", "produtoId", preco, origem, "origemId", "dataCompra", "criadoEm")
SELECT gen_random_uuid()::text, a.unidade_id, a.produto_id, 0.01,
       'AJUSTE_INSUMO_CORTESIA', 'insumo que a casa não custeia', now(), now()
FROM _aplicado a;

COMMIT;

-- ---------------------------------------------------------------------------
-- Verificação
-- ---------------------------------------------------------------------------

-- 4a) Como ficou cada um, por casa.
SELECT p.nome, p."unidadeMedida", u.nome AS casa, pa.preco
FROM "PrecoAtualProduto" pa
JOIN "Produto" p ON p.id = pa."produtoId"
JOIN "Unidade" u ON u.id = pa."unidadeId"
WHERE lower(btrim(p.nome)) IN ('água', 'agua', 'gelo', 'agua coccão', 'água cocção', 'agua cocção')
ORDER BY p.nome, u.nome;

-- 4b) O que AINDA está zerado e é usado em ficha. Daqui pra frente esta lista é
--     só problema de verdade: insumo comprado sem preço, ou preparo da casa
--     cadastrado como insumo (esse não se resolve com preço — precisa virar
--     sub-receita e as fichas apontarem pra ela).
SELECT p.nome, p."unidadeMedida", u.nome AS casa,
       (SELECT count(*) FROM "IngredienteReceita" i WHERE i."produtoId" = p.id) AS fichas
FROM "PrecoAtualProduto" pa
JOIN "Produto" p ON p.id = pa."produtoId"
JOIN "Unidade" u ON u.id = pa."unidadeId"
WHERE pa.preco = 0
  AND EXISTS (SELECT 1 FROM "IngredienteReceita" i WHERE i."produtoId" = p.id)
ORDER BY fichas DESC, p.nome;
