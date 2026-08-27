-- CreateTable
CREATE TABLE "Unidade" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metaCmvPratos" DOUBLE PRECISION,
    "metaCmvBebidas" DOUBLE PRECISION,
    "metaCmvVinhos" DOUBLE PRECISION,

    CONSTRAINT "Unidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unidadeId" TEXT,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fornecedor" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "contato" TEXT,
    "telefone" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Produto" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT,
    "unidadeMedida" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoCompra" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "fornecedorId" TEXT,
    "solicitanteId" TEXT NOT NULL,
    "aprovadorId" TEXT,
    "aprovadoEm" TIMESTAMP(3),
    "motivoRejeicao" TEXT,

    CONSTRAINT "PedidoCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemPedido" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "precoUnitEsperado" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ItemPedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recebimento" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "recebidoPorId" TEXT NOT NULL,
    "dataRecebimento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacao" TEXT,

    CONSTRAINT "Recebimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemRecebimento" (
    "id" TEXT NOT NULL,
    "recebimentoId" TEXT NOT NULL,
    "itemPedidoId" TEXT NOT NULL,
    "quantidadeRecebida" DOUBLE PRECISION NOT NULL,
    "precoUnitRecebido" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ItemRecebimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstoqueSaldo" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstoqueSaldo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentoEstoque" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "referencia" TEXT,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentoEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContagemEstoque" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidadeSistema" DOUBLE PRECISION NOT NULL,
    "quantidadeContada" DOUBLE PRECISION NOT NULL,
    "diferenca" DOUBLE PRECISION NOT NULL,
    "contadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContagemEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receita" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "modoPreparo" TEXT,
    "rendimentoQtd" DOUBLE PRECISION,
    "rendimentoUnidade" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredienteReceita" (
    "id" TEXT NOT NULL,
    "receitaId" TEXT NOT NULL,
    "produtoId" TEXT,
    "subReceitaId" TEXT,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "unidadeMedida" TEXT NOT NULL,

    CONSTRAINT "IngredienteReceita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemVenda" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "categoria" TEXT,
    "nome" TEXT NOT NULL,
    "precoVenda" DOUBLE PRECISION NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "receitaId" TEXT,
    "custoImportado" DOUBLE PRECISION,
    "cmvImportado" DOUBLE PRECISION,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemVenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricoPrecoProduto" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "preco" DOUBLE PRECISION NOT NULL,
    "origem" TEXT NOT NULL,
    "origemId" TEXT NOT NULL,
    "dataCompra" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoPrecoProduto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecoAtualProduto" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "preco" DOUBLE PRECISION NOT NULL,
    "dataCompra" TIMESTAMP(3) NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrecoAtualProduto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaCompra" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "arquivoNome" TEXT NOT NULL,
    "importadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotaCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemNotaCompra" (
    "id" TEXT NOT NULL,
    "notaCompraId" TEXT NOT NULL,
    "produtoId" TEXT,
    "nomeBruto" TEXT NOT NULL,
    "precoUnitNovo" DOUBLE PRECISION NOT NULL,
    "precoUnitAnterior" DOUBLE PRECISION,
    "dataCompra" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemNotaCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendaSemanal" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "periodoInicio" TIMESTAMP(3) NOT NULL,
    "periodoFim" TIMESTAMP(3) NOT NULL,
    "importadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendaSemanal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemVendaSemanal" (
    "id" TEXT NOT NULL,
    "vendaSemanalId" TEXT NOT NULL,
    "itemVendaId" TEXT,
    "nomeBruto" TEXT NOT NULL,
    "quantidadeVendida" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ItemVendaSemanal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParametroEstoqueProduto" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "estoqueMinimo" DOUBLE PRECISION,
    "estoqueIdeal" DOUBLE PRECISION,

    CONSTRAINT "ParametroEstoqueProduto_pkey" PRIMARY KEY ("id")
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

-- CreateIndex
CREATE UNIQUE INDEX "Receita_unidadeId_nome_key" ON "Receita"("unidadeId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "ItemVenda_unidadeId_tipo_categoria_nome_key" ON "ItemVenda"("unidadeId", "tipo", "categoria", "nome");

-- CreateIndex
CREATE INDEX "HistoricoPrecoProduto_unidadeId_produtoId_dataCompra_idx" ON "HistoricoPrecoProduto"("unidadeId", "produtoId", "dataCompra");

-- CreateIndex
CREATE UNIQUE INDEX "PrecoAtualProduto_unidadeId_produtoId_key" ON "PrecoAtualProduto"("unidadeId", "produtoId");

-- CreateIndex
CREATE UNIQUE INDEX "ParametroEstoqueProduto_unidadeId_produtoId_key" ON "ParametroEstoqueProduto"("unidadeId", "produtoId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoCompra" ADD CONSTRAINT "PedidoCompra_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoCompra" ADD CONSTRAINT "PedidoCompra_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoCompra" ADD CONSTRAINT "PedidoCompra_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoCompra" ADD CONSTRAINT "PedidoCompra_aprovadorId_fkey" FOREIGN KEY ("aprovadorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPedido" ADD CONSTRAINT "ItemPedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPedido" ADD CONSTRAINT "ItemPedido_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recebimento" ADD CONSTRAINT "Recebimento_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoCompra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recebimento" ADD CONSTRAINT "Recebimento_recebidoPorId_fkey" FOREIGN KEY ("recebidoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemRecebimento" ADD CONSTRAINT "ItemRecebimento_recebimentoId_fkey" FOREIGN KEY ("recebimentoId") REFERENCES "Recebimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemRecebimento" ADD CONSTRAINT "ItemRecebimento_itemPedidoId_fkey" FOREIGN KEY ("itemPedidoId") REFERENCES "ItemPedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstoqueSaldo" ADD CONSTRAINT "EstoqueSaldo_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstoqueSaldo" ADD CONSTRAINT "EstoqueSaldo_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContagemEstoque" ADD CONSTRAINT "ContagemEstoque_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContagemEstoque" ADD CONSTRAINT "ContagemEstoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContagemEstoque" ADD CONSTRAINT "ContagemEstoque_contadoPorId_fkey" FOREIGN KEY ("contadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receita" ADD CONSTRAINT "Receita_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredienteReceita" ADD CONSTRAINT "IngredienteReceita_receitaId_fkey" FOREIGN KEY ("receitaId") REFERENCES "Receita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredienteReceita" ADD CONSTRAINT "IngredienteReceita_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredienteReceita" ADD CONSTRAINT "IngredienteReceita_subReceitaId_fkey" FOREIGN KEY ("subReceitaId") REFERENCES "Receita"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVenda" ADD CONSTRAINT "ItemVenda_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVenda" ADD CONSTRAINT "ItemVenda_receitaId_fkey" FOREIGN KEY ("receitaId") REFERENCES "Receita"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoPrecoProduto" ADD CONSTRAINT "HistoricoPrecoProduto_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoPrecoProduto" ADD CONSTRAINT "HistoricoPrecoProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecoAtualProduto" ADD CONSTRAINT "PrecoAtualProduto_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecoAtualProduto" ADD CONSTRAINT "PrecoAtualProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaCompra" ADD CONSTRAINT "NotaCompra_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaCompra" ADD CONSTRAINT "NotaCompra_importadoPorId_fkey" FOREIGN KEY ("importadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemNotaCompra" ADD CONSTRAINT "ItemNotaCompra_notaCompraId_fkey" FOREIGN KEY ("notaCompraId") REFERENCES "NotaCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemNotaCompra" ADD CONSTRAINT "ItemNotaCompra_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendaSemanal" ADD CONSTRAINT "VendaSemanal_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendaSemanal" ADD CONSTRAINT "VendaSemanal_importadoPorId_fkey" FOREIGN KEY ("importadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVendaSemanal" ADD CONSTRAINT "ItemVendaSemanal_vendaSemanalId_fkey" FOREIGN KEY ("vendaSemanalId") REFERENCES "VendaSemanal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVendaSemanal" ADD CONSTRAINT "ItemVendaSemanal_itemVendaId_fkey" FOREIGN KEY ("itemVendaId") REFERENCES "ItemVenda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParametroEstoqueProduto" ADD CONSTRAINT "ParametroEstoqueProduto_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParametroEstoqueProduto" ADD CONSTRAINT "ParametroEstoqueProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
