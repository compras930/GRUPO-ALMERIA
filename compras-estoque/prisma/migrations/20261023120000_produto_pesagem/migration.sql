-- Pesar garrafa para contá-la.
--
-- Whisky, gin, licor e aperitivo são vendidos em DOSE: a garrafa fica meses
-- aberta e quase nunca está cheia nem vazia. Hoje se conta "mais ou menos
-- meia", e meio dedo de erro numa garrafa de R$ 290 é mais dinheiro que o mês
-- inteiro de hortifrúti. A balança resolve — ela já existe na cozinha —, mas
-- entrega GRAMA e o estoque está em garrafa.
--
-- `pesoLiquidoCheioG` NÃO é o volume nominal: 700 ml de whisky pesam ~660 g,
-- porque álcool é mais leve que água. Os 6% de diferença, num estoque de bar,
-- são dinheiro.
--
-- `pesoTaraG` é a garrafa VAZIA com tampa e rótulo — é assim que ela vai para
-- a balança, porque ninguém despeja whisky num copo para pesar.
--
-- Os dois são do PRODUTO, não da casa: a garrafa pesa o mesmo em todas.
--
-- Nulo = item que não se pesa, que é a maioria. Nada muda para eles.
ALTER TABLE "Produto" ADD COLUMN IF NOT EXISTS "pesoTaraG" DOUBLE PRECISION;
ALTER TABLE "Produto" ADD COLUMN IF NOT EXISTS "pesoLiquidoCheioG" DOUBLE PRECISION;
