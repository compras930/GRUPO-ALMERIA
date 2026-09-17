-- Distingue "casa" de "unidade física".
--
-- Noroeste e Matri são duas casas — cardápio próprio, caixa próprio, venda
-- medida em separado — mas uma unidade física só: mesma cozinha, mesma
-- despensa, mesma nota de compra, mesma contagem. As outras três (104 Sul,
-- Wine Garden, Beira Lago) são unidades físicas de verdade.
--
-- Ver src/lib/unidade-fisica.ts pra a regra de o que segue a despensa e o que
-- segue a casa.
--
-- Nullable: todas as casas nascem com estoque próprio, que é o comportamento
-- de hoje. Nada muda até alguém apontar uma casa pra outra — o que é o script
-- prisma/scripts/noroeste-matri-unificar.sql, aplicado à parte.
ALTER TABLE "Unidade" ADD COLUMN "estoqueEmId" TEXT;

ALTER TABLE "Unidade"
  ADD CONSTRAINT "Unidade_estoqueEmId_fkey"
  FOREIGN KEY ("estoqueEmId") REFERENCES "Unidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Unidade_estoqueEmId_idx" ON "Unidade" ("estoqueEmId");
