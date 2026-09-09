-- Cadastra o preço de insumos que estavam em R$ 0,00 e são compra de verdade,
-- com os valores informados pelo setor de compras.
--
-- Contexto: o levantamento dos insumos zerados separou 19 produtos em quatro
-- grupos. Estes três são o grupo "compra de verdade, só falta preço" — as
-- quantidades nas fichas já estão corretas e em KG (0,001 a 0,13), então o preço
-- entra direto, sem precisar corrigir nada antes:
--
--   MOSTARDA DIJON  R$  70,42/KG   (16 linhas de ficha, 104 Sul e Noroeste)
--   OREGANO         R$ 133,33/KG   ( 2 linhas, 104 Sul e Noroeste)
--   TAHINE          R$  51,05/KG   ( 2 linhas, Wine Garden)
--
-- A mostarda é a que mais pesa: 16 fichas contando esse ingrediente como zero.
--
-- Três decisões de escopo, e o motivo de cada uma:
--
-- 1) Só grava nas casas onde o insumo é USADO em ficha. Preço é por casa e vem
--    de compra real; espalhar o mesmo valor pelas 5 casas inventaria dado pra
--    casas que talvez comprem por outro preço (ou não comprem).
-- 2) NUNCA sobrescreve preço positivo já cadastrado. Se alguma casa já tem preço
--    de verdade, ele veio de nota e manda — o script só preenche zero e ausência.
-- 3) Registra no histórico com origem própria (AJUSTE_PRECO_INFORMADO), pra
--    depois dar pra distinguir isso de preço vindo de nota de compra.
--
-- Idempotente: na segunda execução não há mais zero nem ausência pra preencher,
-- então nada acontece. Sem BEGIN/COMMIT — o editor do Neon roda cada comando em
-- autocommit e não honra transação explícita entre eles.

-- ---------------------------------------------------------------------------
-- Passo 1 — Confira o que casou antes de aplicar. Espere exatamente 3 linhas,
-- todas em KG. Se algum produto não aparecer, o nome no banco é diferente do
-- esperado e o passo 2 ignoraria ele em silêncio.
-- ---------------------------------------------------------------------------
WITH informado(nome_chave, unidade, preco) AS (
  VALUES ('mostarda dijon',                'KG',  70.42),
         ('oregano',                       'KG', 133.33),
         ('tahine - pasta de gergelim kg', 'KG',  51.05)
)
SELECT
  inf.nome_chave                                                            AS procurado,
  p.nome                                                                    AS encontrado,
  p."unidadeMedida",
  inf.preco                                                                 AS preco_a_gravar,
  (SELECT count(*) FROM "IngredienteReceita" i WHERE i."produtoId" = p.id)  AS linhas_de_ficha,
  (SELECT string_agg(DISTINCT un.nome, ', ')
     FROM "IngredienteReceita" i
     JOIN "Receita" r  ON r.id = i."receitaId"
     JOIN "Unidade" un ON un.id = r."unidadeId"
    WHERE i."produtoId" = p.id)                                             AS casas_que_usam,
  (SELECT count(*) FROM "PrecoAtualProduto" pa
    WHERE pa."produtoId" = p.id AND pa.preco > 0)                           AS casas_com_preco_ja
FROM informado inf
LEFT JOIN "Produto" p
       ON lower(btrim(p.nome)) = inf.nome_chave
      AND p."unidadeMedida" = inf.unidade
ORDER BY 1;

-- ---------------------------------------------------------------------------
-- Passo 2 — Aplica. Um comando, encadeado por CTE (atualiza o que está zerado,
-- cria onde falta, registra no histórico só o que mexeu).
-- ---------------------------------------------------------------------------
WITH informado(nome_chave, unidade, preco) AS (
  VALUES ('mostarda dijon',                'KG',  70.42),
         ('oregano',                       'KG', 133.33),
         ('tahine - pasta de gergelim kg', 'KG',  51.05)
),
alvo AS (
  SELECT p.id AS produto_id, inf.preco
  FROM informado inf
  JOIN "Produto" p
    ON lower(btrim(p.nome)) = inf.nome_chave
   AND p."unidadeMedida" = inf.unidade
),
-- casas onde o insumo aparece em ficha: são as que precisam do preço
casa_alvo AS (
  SELECT DISTINCT a.produto_id, a.preco, r."unidadeId" AS unidade_id
  FROM alvo a
  JOIN "IngredienteReceita" i ON i."produtoId" = a.produto_id
  JOIN "Receita" r            ON r.id = i."receitaId"
),
atualizadas AS (
  UPDATE "PrecoAtualProduto" pa
  SET preco = c.preco, "dataCompra" = now(), "atualizadoEm" = now()
  FROM casa_alvo c
  WHERE pa."produtoId" = c.produto_id
    AND pa."unidadeId" = c.unidade_id
    AND pa.preco = 0          -- só zero; preço positivo existente manda
  RETURNING pa."unidadeId", pa."produtoId", pa.preco
),
inseridas AS (
  INSERT INTO "PrecoAtualProduto" (id, "unidadeId", "produtoId", preco, "dataCompra", "atualizadoEm")
  SELECT gen_random_uuid()::text, c.unidade_id, c.produto_id, c.preco, now(), now()
  FROM casa_alvo c
  ON CONFLICT ("unidadeId", "produtoId") DO NOTHING
  RETURNING "unidadeId", "produtoId", preco
),
aplicadas AS (
  SELECT * FROM atualizadas
  UNION ALL
  SELECT * FROM inseridas
)
INSERT INTO "HistoricoPrecoProduto" (id, "unidadeId", "produtoId", preco, origem, "origemId", "dataCompra", "criadoEm")
SELECT gen_random_uuid()::text, a."unidadeId", a."produtoId", a.preco,
       'AJUSTE_PRECO_INFORMADO', 'preco informado pelo setor de compras', now(), now()
FROM aplicadas a;

-- ---------------------------------------------------------------------------
-- Verificação
-- ---------------------------------------------------------------------------

-- 2a) Preço por casa dos três insumos.
SELECT p.nome, p."unidadeMedida", un.nome AS casa, pa.preco
FROM "PrecoAtualProduto" pa
JOIN "Produto" p  ON p.id = pa."produtoId"
JOIN "Unidade" un ON un.id = pa."unidadeId"
WHERE lower(btrim(p.nome)) IN ('mostarda dijon', 'oregano', 'tahine - pasta de gergelim kg')
ORDER BY p.nome, un.nome;

-- 2b) Efeito no custo: quanto cada ficha que usa esses insumos passou a contar.
--     Antes era zero em todas.
SELECT un.nome AS casa, r.nome AS ficha, p.nome AS insumo,
       i.quantidade, round(pa.preco::numeric, 2) AS preco,
       round((i.quantidade * pa.preco)::numeric, 2) AS custo_da_linha
FROM "IngredienteReceita" i
JOIN "Produto" p  ON p.id = i."produtoId"
JOIN "Receita" r  ON r.id = i."receitaId"
JOIN "Unidade" un ON un.id = r."unidadeId"
JOIN "PrecoAtualProduto" pa ON pa."produtoId" = p.id AND pa."unidadeId" = r."unidadeId"
WHERE lower(btrim(p.nome)) IN ('mostarda dijon', 'oregano', 'tahine - pasta de gergelim kg')
ORDER BY custo_da_linha DESC;

-- 2c) Quantas linhas de ficha ainda custam zero (era 67 antes deste script e do
--     produto-total-lixo-importacao.sql).
SELECT count(*) AS linhas_de_ficha_ainda_zeradas
FROM "IngredienteReceita" i
JOIN "Produto" p ON p.id = i."produtoId"
JOIN "Receita" r ON r.id = i."receitaId"
WHERE NOT EXISTS (
  SELECT 1 FROM "PrecoAtualProduto" pa
  WHERE pa."produtoId" = p.id AND pa."unidadeId" = r."unidadeId" AND pa.preco > 0
);
