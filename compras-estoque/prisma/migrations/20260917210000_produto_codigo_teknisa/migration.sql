-- Código do produto no Teknisa (12 dígitos, ex. 100000017104), pra casar linha
-- de compra com Produto por identificador em vez de por nome.
-- Ver src/lib/resolucao-produto-compra.ts.
--
-- POR QUE. Na primeira carga real de preço via n8n (17/09/2026), das 650
-- linhas de compra das duas casas só 265 reconheceram o produto — 41%. O resto
-- é o mesmo produto com outro nome ("ALCATRA BOVINA BOMBOM (COMPRA)" contra
-- "ALCATRA BOVINO KG"). O código não muda quando alguém reescreve o nome.
--
-- Nullable de propósito: todo o catálogo nasce sem código e continua casando
-- por nome até alguém parear. Nada quebra no dia da migração.
ALTER TABLE "Produto" ADD COLUMN "codigoTeknisa" TEXT;

-- Único GLOBAL, ao contrário do codigoPdv (que é por casa): a compra das casas
-- do Grupo sai toda do mesmo Teknisa, com um cadastro de produto só. O mesmo
-- código em duas linhas é o mesmo produto.
--
-- Postgres trata NULL como distinto num índice único, então os produtos sem
-- código não colidem entre si.
CREATE UNIQUE INDEX "Produto_codigoTeknisa_key" ON "Produto" ("codigoTeknisa");

-- Código e unidade que vieram na linha da nota, mesmo quando ela não casou com
-- produto nenhum. É o que transforma `naoReconhecidos` numa lista pareável
-- depois: sem isso sobra só o nome — que é justamente a parte que não serve —
-- e a unidade é o que distingue "preço da caixa" de "preço do quilo".
ALTER TABLE "ItemNotaCompra" ADD COLUMN "codigoBruto" TEXT;
ALTER TABLE "ItemNotaCompra" ADD COLUMN "unidadeBruta" TEXT;
