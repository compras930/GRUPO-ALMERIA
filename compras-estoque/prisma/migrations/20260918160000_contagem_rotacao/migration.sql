-- Classe ABC e grupo de rodízio por produto e por despensa.
--
-- POR QUE NO BANCO, e não só na planilha: a tela de contagem precisa saber
-- quais 45 produtos são os desta semana. Sem isso ela lista os ~970 ativos e
-- quem lança procura item por item num seletor gigante — que é o jeito mais
-- rápido de a rotina morrer na segunda semana.
--
-- Mora em ParametroEstoqueProduto porque a classificação é por (unidade,
-- produto): o mesmo insumo é curva A no 104 Sul e curva C no Beira Lago, já
-- que depende do quanto cada casa gasta dele.
--
-- Nullable: produto sem classe simplesmente não entra no rodízio, e continua
-- contável pela tela de produto avulso.
ALTER TABLE "ParametroEstoqueProduto" ADD COLUMN IF NOT EXISTS "classeAbc" TEXT;
ALTER TABLE "ParametroEstoqueProduto" ADD COLUMN IF NOT EXISTS "grupoContagem" INTEGER;
