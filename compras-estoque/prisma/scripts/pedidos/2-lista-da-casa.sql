-- A lista de compras da casa, e o pedido que pode sair dela.
--
-- RODAR ANTES DO DEPLOY — o deploy roda só `prisma generate`, nunca
-- `prisma migrate deploy`. Código que sabe de uma coluna que o banco não tem
-- derruba a tela inteira com P2022.
--
-- Seguro rodar duas vezes. Sem bloco DO $$ ... $$: o console do Neon falha
-- nele calado.

-- 1. O item de pedido pode existir SEM produto cadastrado.
--
-- A lista é o vocabulário de quem pede ("QUEIJO MUSSARELA FLEURY (PEÇA)"); o
-- Produto é o vocabulário da nota, que vem do Teknisa. Os dois vão se
-- encontrar, mas exigir o encontro antes do pedido existir travaria a compra
-- da casa até alguém parear 885 nomes — e a casa compra toda semana.
ALTER TABLE "ItemPedido" ALTER COLUMN "produtoId" DROP NOT NULL;
ALTER TABLE "ItemPedido" ADD COLUMN IF NOT EXISTS "nomeBruto" TEXT;
ALTER TABLE "ItemPedido" ADD COLUMN IF NOT EXISTS "unidadeBruta" TEXT;
ALTER TABLE "ItemPedido" ADD COLUMN IF NOT EXISTS "fornecedorId" TEXT;

-- Fornecedor POR ITEM: a casa manda a lista inteira e quem compra divide entre
-- Alimente, hortifrúti e bebidas. Um fornecedor por pedido obrigaria o gerente
-- a saber de quem vem cada coisa, que é o trabalho de quem compra.
ALTER TABLE "ItemPedido"
  DROP CONSTRAINT IF EXISTS "ItemPedido_fornecedorId_fkey";
ALTER TABLE "ItemPedido"
  ADD CONSTRAINT "ItemPedido_fornecedorId_fkey"
  FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. O CNPJ da casa, que vai na mensagem do fornecedor.
ALTER TABLE "Unidade" ADD COLUMN IF NOT EXISTS "cnpj" TEXT;

-- 3. A lista em si.
CREATE TABLE IF NOT EXISTS "ListaPedidoItem" (
  "id"                 TEXT PRIMARY KEY,
  "unidadeId"          TEXT    NOT NULL REFERENCES "Unidade"("id"),
  "secao"              TEXT    NOT NULL,
  "nome"               TEXT    NOT NULL,
  "unidadeCompra"      TEXT    NOT NULL,
  "ordem"              INTEGER NOT NULL DEFAULT 0,
  "ativo"              BOOLEAN NOT NULL DEFAULT true,
  "produtoId"          TEXT REFERENCES "Produto"("id"),
  "fornecedorPadraoId" TEXT REFERENCES "Fornecedor"("id"),
  "criadoEm"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Um nome por casa: é o que impede a lista de ganhar "BURRATA" duas vezes a
-- cada importação de planilha.
CREATE UNIQUE INDEX IF NOT EXISTS "ListaPedidoItem_unidadeId_nome_key"
  ON "ListaPedidoItem" ("unidadeId", "nome");

-- Conferência.
SELECT column_name, is_nullable
  FROM information_schema.columns
 WHERE table_name = 'ItemPedido'
   AND column_name IN ('produtoId', 'nomeBruto', 'unidadeBruta', 'fornecedorId')
 ORDER BY column_name;

SELECT count(*) AS itens_da_lista FROM "ListaPedidoItem";
