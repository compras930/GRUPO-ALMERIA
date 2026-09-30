-- De qual sistema veio o código de cada linha de compra.
--
-- As consultas de pareamento agrupam por `codigoBruto` (ver
-- prisma/scripts/pareamento-vinhos/4-exportar-nao-casados-todas-casas.sql).
-- Com Teknisa e XMenu na mesma tabela e sem esta coluna, elas somariam linhas
-- de dois espaços de código independentes como se fossem o mesmo item — e o
-- pareamento retroativo passaria a produzir decisões erradas em silêncio.
--
-- NULO É O PASSADO, não um valor a preencher. Toda linha carregada até aqui é
-- do Teknisa, mas quem consulta usa COALESCE("origemBruta", 'TEKNISA') em vez
-- de backfill: assim a coluna continua dizendo o que a carga afirmou, e não o
-- que alguém deduziu depois.
--
-- INERTE ATÉ A ROTA ESCREVER NELA. Nada lê nem grava esta coluna hoje; a
-- gravação entra junto com a leitura de CodigoCompraProduto, no mesmo commit.

ALTER TABLE "ItemNotaCompra" ADD COLUMN IF NOT EXISTS "origemBruta" TEXT;

-- Filtrar por origem dentro das consultas de pareamento, que já varrem a
-- tabela inteira por codigoBruto.
CREATE INDEX IF NOT EXISTS "ItemNotaCompra_origemBruta_codigoBruto_idx"
  ON "ItemNotaCompra" ("origemBruta", "codigoBruto");
