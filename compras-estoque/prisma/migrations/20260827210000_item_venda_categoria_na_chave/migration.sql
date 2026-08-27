-- DropIndex
DROP INDEX "ItemVenda_unidadeId_tipo_nome_key";

-- CreateIndex
CREATE UNIQUE INDEX "ItemVenda_unidadeId_tipo_categoria_nome_key" ON "ItemVenda"("unidadeId", "tipo", "categoria", "nome");

