-- CNPJ e nome de faturamento de cada casa.
--
-- Os dois vão na MENSAGEM DO FORNECEDOR, que é o motivo de existirem aqui: o
-- fornecedor fatura por casa, e a mensagem precisa dizer para qual.
--
-- NOME FISCAL SEPARADO DO NOME DA CASA, de propósito. No app a casa se chama
-- "Noroeste" — curto, bom para menu e seletor. Para o fornecedor ela é "Casa
-- Almeria Noroeste". Reaproveitar um nome no lugar do outro deixaria o menu
-- feio ou a mensagem ambígua; são dois públicos diferentes.
--
-- Seguro rodar duas vezes. Sem bloco DO $$ ... $$: o console do Neon falha
-- nele calado.

ALTER TABLE "Unidade" ADD COLUMN IF NOT EXISTS "cnpj" TEXT;
ALTER TABLE "Unidade" ADD COLUMN IF NOT EXISTS "nomeFiscal" TEXT;

UPDATE "Unidade" SET "cnpj" = '35.116.878/0001-71', "nomeFiscal" = 'Wine Garden'
 WHERE "nome" = 'Wine Garden';

UPDATE "Unidade" SET "cnpj" = '39.251.506/0002-90', "nomeFiscal" = 'Casa Almeria 104 Sul'
 WHERE "nome" = '104 Sul';

UPDATE "Unidade" SET "cnpj" = '39.251.506/0003-70', "nomeFiscal" = 'Casa Almeria Noroeste'
 WHERE "nome" = 'Noroeste';

UPDATE "Unidade" SET "cnpj" = '63.698.170/0001-01', "nomeFiscal" = 'Almeria Beira Lago'
 WHERE "nome" = 'Beira Lago';

-- O CPD produz e não vende, mas compra — então também fatura.
UPDATE "Unidade" SET "cnpj" = '39.251.506/0001-09', "nomeFiscal" = 'CPD'
 WHERE "nome" = 'CPD';

-- Conferência: o Matri fica sem CNPJ próprio de propósito — ele divide a
-- despensa (e a nota) com o Noroeste. Se um dia faturar separado, é só
-- preencher aqui.
SELECT "nome", "nomeFiscal", "cnpj" FROM "Unidade" WHERE "ativo" ORDER BY "nome";
