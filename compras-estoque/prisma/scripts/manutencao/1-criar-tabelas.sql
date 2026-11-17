-- Manutenção: chamados técnicos das casas.
--
-- RODAR NO CONSOLE DO NEON, de preferência ANTES do deploy.
-- Só cria tabelas novas — nenhuma tabela existente é alterada. Se o deploy
-- chegar antes, só as telas de Manutenção ficam fora do ar até este script
-- rodar; o resto do sistema não é afetado.
--
-- Pode rodar mais de uma vez sem problema (tudo é IF NOT EXISTS).

BEGIN;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ContatoUsuario" (
    "usuarioId" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "recebeRelatorioSemanal" BOOLEAN NOT NULL DEFAULT false,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContatoUsuario_pkey" PRIMARY KEY ("usuarioId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ColaboradorManutencao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "categorias" TEXT[],
    "interno" BOOLEAN NOT NULL DEFAULT false,
    "empresa" TEXT,
    "observacao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ColaboradorManutencao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChamadoManutencao" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    "unidadeId" TEXT NOT NULL,
    "abertoPorId" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "urgencia" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "local" TEXT,
    "localChave" TEXT,
    "abertoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triadoPorId" TEXT,
    "triadoEm" TIMESTAMP(3),
    "motivoRecusa" TEXT,
    "duplicadoDeId" TEXT,
    "colaboradorId" TEXT,
    "encaminhadoEm" TIMESTAMP(3),
    "prazoHoras" INTEGER,
    "tokenAcesso" TEXT,
    "aceitoEm" TIMESTAMP(3),
    "prazoFinal" TIMESTAMP(3),
    "concluidoEm" TIMESTAMP(3),
    "servicoExecutado" TEXT,
    "aprovadoPorId" TEXT,
    "finalizadoEm" TIMESTAMP(3),
    "reprovacoes" INTEGER NOT NULL DEFAULT 0,
    "motivoReprovacao" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChamadoManutencao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotoChamado" (
    "id" TEXT NOT NULL,
    "chamadoId" TEXT NOT NULL,
    "etapa" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "dados" BYTEA NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotoChamado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EventoChamado" (
    "id" TEXT NOT NULL,
    "chamadoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "autor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoChamado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ChamadoManutencao_numero_key" ON "ChamadoManutencao"("numero");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ChamadoManutencao_tokenAcesso_key" ON "ChamadoManutencao"("tokenAcesso");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChamadoManutencao_unidadeId_status_idx" ON "ChamadoManutencao"("unidadeId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChamadoManutencao_abertoEm_idx" ON "ChamadoManutencao"("abertoEm");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotoChamado_chamadoId_idx" ON "FotoChamado"("chamadoId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EventoChamado_chamadoId_criadoEm_idx" ON "EventoChamado"("chamadoId", "criadoEm");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContatoUsuario_usuarioId_fkey') THEN
    ALTER TABLE "ContatoUsuario" ADD CONSTRAINT "ContatoUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChamadoManutencao_unidadeId_fkey') THEN
    ALTER TABLE "ChamadoManutencao" ADD CONSTRAINT "ChamadoManutencao_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChamadoManutencao_abertoPorId_fkey') THEN
    ALTER TABLE "ChamadoManutencao" ADD CONSTRAINT "ChamadoManutencao_abertoPorId_fkey" FOREIGN KEY ("abertoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChamadoManutencao_triadoPorId_fkey') THEN
    ALTER TABLE "ChamadoManutencao" ADD CONSTRAINT "ChamadoManutencao_triadoPorId_fkey" FOREIGN KEY ("triadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChamadoManutencao_duplicadoDeId_fkey') THEN
    ALTER TABLE "ChamadoManutencao" ADD CONSTRAINT "ChamadoManutencao_duplicadoDeId_fkey" FOREIGN KEY ("duplicadoDeId") REFERENCES "ChamadoManutencao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChamadoManutencao_colaboradorId_fkey') THEN
    ALTER TABLE "ChamadoManutencao" ADD CONSTRAINT "ChamadoManutencao_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "ColaboradorManutencao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChamadoManutencao_aprovadoPorId_fkey') THEN
    ALTER TABLE "ChamadoManutencao" ADD CONSTRAINT "ChamadoManutencao_aprovadoPorId_fkey" FOREIGN KEY ("aprovadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotoChamado_chamadoId_fkey') THEN
    ALTER TABLE "FotoChamado" ADD CONSTRAINT "FotoChamado_chamadoId_fkey" FOREIGN KEY ("chamadoId") REFERENCES "ChamadoManutencao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventoChamado_chamadoId_fkey') THEN
    ALTER TABLE "EventoChamado" ADD CONSTRAINT "EventoChamado_chamadoId_fkey" FOREIGN KEY ("chamadoId") REFERENCES "ChamadoManutencao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;

-- Conferência: devem aparecer as 5 tabelas.
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('ContatoUsuario','ColaboradorManutencao','ChamadoManutencao','FotoChamado','EventoChamado')
ORDER BY table_name;
