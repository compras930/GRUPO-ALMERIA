-- Manutenção: login do Agente de Manutenção.
--
-- RODAR NO CONSOLE DO NEON **ANTES** DO MERGE/DEPLOY. Diferente do script 1,
-- este acrescenta uma coluna numa tabela que as telas de Manutenção já leem:
-- se o deploy chegar antes, as telas de Manutenção dão erro até ele rodar.
-- O resto do sistema não é afetado.
--
-- Pode rodar mais de uma vez sem problema.

BEGIN;

ALTER TABLE "ColaboradorManutencao" ADD COLUMN IF NOT EXISTS "usuarioId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "ColaboradorManutencao_usuarioId_key"
  ON "ColaboradorManutencao"("usuarioId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ColaboradorManutencao_usuarioId_fkey') THEN
    ALTER TABLE "ColaboradorManutencao" ADD CONSTRAINT "ColaboradorManutencao_usuarioId_fkey"
      FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;

-- Conferência: deve aparecer 1 linha (usuarioId).
SELECT column_name FROM information_schema.columns
WHERE table_name = 'ColaboradorManutencao' AND column_name = 'usuarioId';
