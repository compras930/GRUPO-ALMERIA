-- Valor vendido declarado pela origem, por linha de venda.
--
-- RODE ESTA MIGRAÇÃO ANTES DE O CÓDIGO NOVO SUBIR. O deploy do app roda só
-- `prisma generate`, nunca `prisma migrate deploy` — as migrações são
-- aplicadas à mão no console. E o Prisma, num `create`, devolve TODAS as
-- colunas do modelo: com a coluna faltando no banco, a carga de vendas
-- quebraria inteira.
--
-- É instantânea e não trava tabela: coluna nova, anulável, sem default.
ALTER TABLE "ItemVendaSemanal" ADD COLUMN IF NOT EXISTS "valorVendido" DOUBLE PRECISION;
