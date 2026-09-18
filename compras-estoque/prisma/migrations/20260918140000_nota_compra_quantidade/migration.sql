-- Quantidade na linha da nota de compra, pra que a compra dê ENTRADA DE ESTOQUE
-- — não só atualize preço.
--
-- POR QUE. O CMV real é `estoque inicial + compras − estoque final`. Até aqui a
-- carga do Teknisa atualizava preço e não tocava em saldo: entrada de estoque
-- só existia pelo recebimento manual contra pedido, que ninguém usa. Sem a
-- coluna do meio, duas contagens seguidas não dizem se sumiu mercadoria ou se
-- compraram mais — e o piloto de contagem por curva A mediria nada.
--
-- A mesma quantidade é o que define a curva A: curva A é consumo em reais.
ALTER TABLE "ItemNotaCompra" ADD COLUMN IF NOT EXISTS "quantidade" DOUBLE PRECISION;
ALTER TABLE "ItemNotaCompra" ADD COLUMN IF NOT EXISTS "valorTotal" DOUBLE PRECISION;

-- Chave da linha na origem (coluna `chave` da base do Drive, que o Teknisa monta
-- como empresa|data|documento|produto|sequência).
--
-- É o que torna a recarga segura. Preço tem proteção natural — regravar o mesmo
-- preço não muda nada. ESTOQUE NÃO: reprocessar a mesma nota soma a mesma
-- mercadoria de novo, e o saldo infla sem ninguém ver. Com a chave, a linha já
-- carregada é reconhecida e pulada, e o workflow pode rodar quantas vezes
-- quiser sem estragar o saldo.
--
-- Nullable porque as notas já carregadas (17 e 18/09) nasceram sem chave, e
-- NULL não colide com NULL em índice único no Postgres.
ALTER TABLE "ItemNotaCompra" ADD COLUMN IF NOT EXISTS "chaveOrigem" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "ItemNotaCompra_chaveOrigem_key"
  ON "ItemNotaCompra" ("chaveOrigem");
