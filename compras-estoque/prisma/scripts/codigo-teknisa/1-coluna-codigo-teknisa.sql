-- PASSO 1 de 3 do pareamento de compra por código do Teknisa.
-- Rodar no SQL Editor do Neon (produção), de uma vez só. É idempotente.
--
-- O QUE ISTO FAZ: cria a coluna `Produto.codigoTeknisa` (com índice único) e
-- as colunas `ItemNotaCompra.codigoBruto` / `unidadeBruta`. Não escreve dado
-- nenhum — nenhum produto ganha código aqui. O pareamento em si é o passo 3,
-- linha por linha, com revisão humana.
--
-- POR QUE. Primeira carga real de preço (17/09/2026): 650 linhas de compra,
-- 265 reconhecidas (41%). As outras 385 não são produto faltando — é o mesmo
-- produto com outro nome. O código do Teknisa não muda quando o nome muda.
--
-- Depois de rodar, o `npx prisma migrate status` precisa continuar limpo — por
-- isso o registro manual em `_prisma_migrations` no fim (o Neon não roda o
-- migrate; quem aplica é este script).

-- ---------------------------------------------------------------------------
-- 1a) As colunas.
-- ---------------------------------------------------------------------------
ALTER TABLE "Produto"        ADD COLUMN IF NOT EXISTS "codigoTeknisa" TEXT;
ALTER TABLE "ItemNotaCompra" ADD COLUMN IF NOT EXISTS "codigoBruto"   TEXT;
ALTER TABLE "ItemNotaCompra" ADD COLUMN IF NOT EXISTS "unidadeBruta"  TEXT;

-- ---------------------------------------------------------------------------
-- 1b) O índice único, GLOBAL (≠ codigoPdv, que é por casa): a compra de todas
--     as casas sai do mesmo cadastro do Teknisa. NULL não colide com NULL em
--     índice único no Postgres, então o catálogo inteiro sem código convive.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "Produto_codigoTeknisa_key"
  ON "Produto" ("codigoTeknisa");

-- ---------------------------------------------------------------------------
-- 1c) Registro da migração, pro Prisma não achar que o banco está atrasado.
--     O checksum é o sha256 do arquivo
--     prisma/migrations/20260917210000_produto_codigo_teknisa/migration.sql.
-- ---------------------------------------------------------------------------
INSERT INTO "_prisma_migrations"
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT gen_random_uuid()::text,
       '4772042dfb9c8b5d5753a058ccfa746ac3e73a84f575689b03f3b685f0716c92',
       now(), '20260917210000_produto_codigo_teknisa', NULL, NULL, now(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260917210000_produto_codigo_teknisa'
);

-- ---------------------------------------------------------------------------
-- VERIFICAÇÃO. Esperado: 3 colunas novas (uma linha cada) e 1 na última.
-- ---------------------------------------------------------------------------
SELECT table_name, column_name
FROM information_schema.columns
WHERE (table_name = 'Produto'        AND column_name = 'codigoTeknisa')
   OR (table_name = 'ItemNotaCompra' AND column_name IN ('codigoBruto', 'unidadeBruta'))
ORDER BY table_name, column_name;

SELECT migration_name, applied_steps_count
FROM "_prisma_migrations"
WHERE migration_name = '20260917210000_produto_codigo_teknisa';

-- Quantos produtos já têm código. Agora: 0. Depois do passo 3: algumas centenas.
SELECT count(*) FILTER (WHERE "codigoTeknisa" IS NOT NULL) AS com_codigo,
       count(*)                                            AS total
FROM "Produto";
