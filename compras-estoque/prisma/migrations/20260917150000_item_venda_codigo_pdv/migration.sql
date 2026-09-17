-- Código do produto no PDV, pra casar venda com item de venda por identificador
-- em vez de por nome. Ver src/lib/resolucao-item-venda.ts.
--
-- Nullable de propósito: os 863 itens já cadastrados nascem sem código e
-- continuam casando por nome até alguém mapear. Nada quebra no dia da migração.
ALTER TABLE "ItemVenda" ADD COLUMN "codigoPdv" TEXT;

-- Código que veio na linha da planilha, mesmo quando não casou com item nenhum.
ALTER TABLE "ItemVendaSemanal" ADD COLUMN "codigoBruto" TEXT;

-- Único por casa, não global: cada unidade roda um PDV só e os espaços de
-- código não se comunicam (Teknisa usa 12 dígitos, o Xmenu do Beira Lago tem
-- formato próprio) — o mesmo número em duas casas é coincidência, não conflito.
--
-- Postgres trata NULL como distinto num índice único, então os itens sem
-- código não colidem entre si. É exatamente o comportamento desejado aqui, e é
-- o motivo de isto ser um índice único comum e não uma checagem na aplicação.
CREATE UNIQUE INDEX "ItemVenda_unidadeId_codigoPdv_key" ON "ItemVenda" ("unidadeId", "codigoPdv");
