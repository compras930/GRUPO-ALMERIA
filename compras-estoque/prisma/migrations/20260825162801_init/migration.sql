-- CreateTable
CREATE TABLE "Unidade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unidadeId" TEXT,
    CONSTRAINT "Usuario_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Fornecedor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "contato" TEXT,
    "telefone" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Produto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "categoria" TEXT,
    "unidadeMedida" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PedidoCompra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "numero" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "observacao" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "solicitanteId" TEXT NOT NULL,
    "aprovadorId" TEXT,
    "aprovadoEm" DATETIME,
    "motivoRejeicao" TEXT,
    CONSTRAINT "PedidoCompra_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PedidoCompra_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PedidoCompra_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PedidoCompra_aprovadorId_fkey" FOREIGN KEY ("aprovadorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemPedido" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pedidoId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidade" REAL NOT NULL,
    "precoUnitEsperado" REAL NOT NULL,
    CONSTRAINT "ItemPedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoCompra" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ItemPedido_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Recebimento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pedidoId" TEXT NOT NULL,
    "recebidoPorId" TEXT NOT NULL,
    "dataRecebimento" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacao" TEXT,
    CONSTRAINT "Recebimento_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoCompra" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Recebimento_recebidoPorId_fkey" FOREIGN KEY ("recebidoPorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemRecebimento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recebimentoId" TEXT NOT NULL,
    "itemPedidoId" TEXT NOT NULL,
    "quantidadeRecebida" REAL NOT NULL,
    "precoUnitRecebido" REAL NOT NULL,
    CONSTRAINT "ItemRecebimento_recebimentoId_fkey" FOREIGN KEY ("recebimentoId") REFERENCES "Recebimento" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ItemRecebimento_itemPedidoId_fkey" FOREIGN KEY ("itemPedidoId") REFERENCES "ItemPedido" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EstoqueSaldo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unidadeId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidade" REAL NOT NULL DEFAULT 0,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "EstoqueSaldo_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EstoqueSaldo_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MovimentoEstoque" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unidadeId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "quantidade" REAL NOT NULL,
    "referencia" TEXT,
    "observacao" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MovimentoEstoque_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovimentoEstoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContagemEstoque" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unidadeId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidadeSistema" REAL NOT NULL,
    "quantidadeContada" REAL NOT NULL,
    "diferenca" REAL NOT NULL,
    "contadoPorId" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContagemEstoque_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContagemEstoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContagemEstoque_contadoPorId_fkey" FOREIGN KEY ("contadoPorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Unidade_nome_key" ON "Unidade"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Produto_nome_unidadeMedida_key" ON "Produto"("nome", "unidadeMedida");

-- CreateIndex
CREATE UNIQUE INDEX "PedidoCompra_numero_key" ON "PedidoCompra"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "EstoqueSaldo_unidadeId_produtoId_key" ON "EstoqueSaldo"("unidadeId", "produtoId");
