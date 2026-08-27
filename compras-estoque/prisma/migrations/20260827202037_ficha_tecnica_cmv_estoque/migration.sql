-- AlterTable
ALTER TABLE "Unidade" ADD COLUMN "metaCmvBebidas" REAL;
ALTER TABLE "Unidade" ADD COLUMN "metaCmvPratos" REAL;
ALTER TABLE "Unidade" ADD COLUMN "metaCmvVinhos" REAL;

-- CreateTable
CREATE TABLE "Receita" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unidadeId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "modoPreparo" TEXT,
    "rendimentoQtd" REAL,
    "rendimentoUnidade" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "Receita_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IngredienteReceita" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receitaId" TEXT NOT NULL,
    "produtoId" TEXT,
    "subReceitaId" TEXT,
    "quantidade" REAL NOT NULL,
    "unidadeMedida" TEXT NOT NULL,
    CONSTRAINT "IngredienteReceita_receitaId_fkey" FOREIGN KEY ("receitaId") REFERENCES "Receita" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IngredienteReceita_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "IngredienteReceita_subReceitaId_fkey" FOREIGN KEY ("subReceitaId") REFERENCES "Receita" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemVenda" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unidadeId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "categoria" TEXT,
    "nome" TEXT NOT NULL,
    "precoVenda" REAL NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "receitaId" TEXT,
    "custoImportado" REAL,
    "cmvImportado" REAL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "ItemVenda_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ItemVenda_receitaId_fkey" FOREIGN KEY ("receitaId") REFERENCES "Receita" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HistoricoPrecoProduto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unidadeId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "preco" REAL NOT NULL,
    "origem" TEXT NOT NULL,
    "origemId" TEXT NOT NULL,
    "dataCompra" DATETIME NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HistoricoPrecoProduto_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HistoricoPrecoProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PrecoAtualProduto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unidadeId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "preco" REAL NOT NULL,
    "dataCompra" DATETIME NOT NULL,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "PrecoAtualProduto_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PrecoAtualProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotaCompra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unidadeId" TEXT NOT NULL,
    "arquivoNome" TEXT NOT NULL,
    "importadoPorId" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotaCompra_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "NotaCompra_importadoPorId_fkey" FOREIGN KEY ("importadoPorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemNotaCompra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "notaCompraId" TEXT NOT NULL,
    "produtoId" TEXT,
    "nomeBruto" TEXT NOT NULL,
    "precoUnitNovo" REAL NOT NULL,
    "precoUnitAnterior" REAL,
    "dataCompra" DATETIME NOT NULL,
    CONSTRAINT "ItemNotaCompra_notaCompraId_fkey" FOREIGN KEY ("notaCompraId") REFERENCES "NotaCompra" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ItemNotaCompra_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VendaSemanal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unidadeId" TEXT NOT NULL,
    "periodoInicio" DATETIME NOT NULL,
    "periodoFim" DATETIME NOT NULL,
    "importadoPorId" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VendaSemanal_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VendaSemanal_importadoPorId_fkey" FOREIGN KEY ("importadoPorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemVendaSemanal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendaSemanalId" TEXT NOT NULL,
    "itemVendaId" TEXT,
    "nomeBruto" TEXT NOT NULL,
    "quantidadeVendida" REAL NOT NULL,
    CONSTRAINT "ItemVendaSemanal_vendaSemanalId_fkey" FOREIGN KEY ("vendaSemanalId") REFERENCES "VendaSemanal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ItemVendaSemanal_itemVendaId_fkey" FOREIGN KEY ("itemVendaId") REFERENCES "ItemVenda" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ParametroEstoqueProduto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unidadeId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "estoqueMinimo" REAL,
    "estoqueIdeal" REAL,
    CONSTRAINT "ParametroEstoqueProduto_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ParametroEstoqueProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PedidoCompra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "numero" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "observacao" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "fornecedorId" TEXT,
    "solicitanteId" TEXT NOT NULL,
    "aprovadorId" TEXT,
    "aprovadoEm" DATETIME,
    "motivoRejeicao" TEXT,
    CONSTRAINT "PedidoCompra_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PedidoCompra_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PedidoCompra_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PedidoCompra_aprovadorId_fkey" FOREIGN KEY ("aprovadorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PedidoCompra" ("aprovadoEm", "aprovadorId", "atualizadoEm", "criadoEm", "fornecedorId", "id", "motivoRejeicao", "numero", "observacao", "solicitanteId", "status", "unidadeId") SELECT "aprovadoEm", "aprovadorId", "atualizadoEm", "criadoEm", "fornecedorId", "id", "motivoRejeicao", "numero", "observacao", "solicitanteId", "status", "unidadeId" FROM "PedidoCompra";
DROP TABLE "PedidoCompra";
ALTER TABLE "new_PedidoCompra" RENAME TO "PedidoCompra";
CREATE UNIQUE INDEX "PedidoCompra_numero_key" ON "PedidoCompra"("numero");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Receita_unidadeId_nome_key" ON "Receita"("unidadeId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "ItemVenda_unidadeId_tipo_nome_key" ON "ItemVenda"("unidadeId", "tipo", "nome");

-- CreateIndex
CREATE INDEX "HistoricoPrecoProduto_unidadeId_produtoId_dataCompra_idx" ON "HistoricoPrecoProduto"("unidadeId", "produtoId", "dataCompra");

-- CreateIndex
CREATE UNIQUE INDEX "PrecoAtualProduto_unidadeId_produtoId_key" ON "PrecoAtualProduto"("unidadeId", "produtoId");

-- CreateIndex
CREATE UNIQUE INDEX "ParametroEstoqueProduto_unidadeId_produtoId_key" ON "ParametroEstoqueProduto"("unidadeId", "produtoId");
