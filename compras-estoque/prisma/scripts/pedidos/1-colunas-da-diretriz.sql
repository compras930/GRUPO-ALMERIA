-- Colunas da diretriz de pedidos (tipo, motivo do extra, semana).
--
-- RODAR ANTES DO DEPLOY. O deploy roda só `prisma generate`, nunca
-- `prisma migrate deploy`: se o código subir sabendo de uma coluna que o banco
-- não tem, a consulta estoura com P2022 e a TELA INTEIRA cai — foi o que
-- derrubou a folha de contagem na véspera da primeira contagem, em 23/10.
--
-- É seguro rodar duas vezes: `IF NOT EXISTS` em tudo, e nenhum UPDATE que
-- mude pedido que já existe além de carimbar o padrão.
--
-- Sem bloco DO $$ ... $$: o console do Neon falha nele calado.

ALTER TABLE "PedidoCompra" ADD COLUMN IF NOT EXISTS "tipo" TEXT NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "PedidoCompra" ADD COLUMN IF NOT EXISTS "motivoExtra" TEXT;
ALTER TABLE "PedidoCompra" ADD COLUMN IF NOT EXISTS "motivoDetalhe" TEXT;
ALTER TABLE "PedidoCompra" ADD COLUMN IF NOT EXISTS "semanaRef" TEXT;

-- A semana dos pedidos ANTIGOS, calculada a partir da data de criação no fuso
-- de Brasília (UTC-3). Eles ficam todos como NORMAL: foram feitos antes da
-- diretriz existir, e marcá-los de extra inventaria um histórico de infração
-- que nunca houve.
UPDATE "PedidoCompra"
   SET "semanaRef" = to_char(
         date_trunc('week', ("criadoEm" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')),
         'YYYY-MM-DD'
       )
 WHERE "semanaRef" IS NULL;

-- Conferência: deve listar as quatro colunas, e nenhum pedido sem semana.
SELECT column_name, data_type, column_default
  FROM information_schema.columns
 WHERE table_name = 'PedidoCompra'
   AND column_name IN ('tipo', 'motivoExtra', 'motivoDetalhe', 'semanaRef')
 ORDER BY column_name;

SELECT count(*) AS pedidos, count("semanaRef") AS com_semana FROM "PedidoCompra";
