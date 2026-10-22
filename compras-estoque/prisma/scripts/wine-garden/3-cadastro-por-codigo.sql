-- Cadastro dos produtos do Wine Garden que não casaram.
-- GERADO por prisma/scripts/wine-garden/gerar-cadastro-wg.ts --por=codigo.
--
-- 274 produtos, R$ 133.496,67 de compra.
--
-- 11 nomes ficaram de FORA porque o produto JÁ EXISTE com outro nome
-- (o reprocessamento os devolveu como CONFLITO_DE_CODIGO). Cadastrá-los criaria
-- um segundo produto para a mesma coisa. O código deles vira código adicional
-- do produto existente — ver 5-codigos-alternativos.sql:
--   R$   2.325,28  CHOPP BRAHMA 50LT [BBL] cod 900107000103
--   R$   1.979,53  QUEIJO BRIE KG [KG] cod 320000000041
--   R$     874,71  BACON FATIADO KG [KG] cod 320000000002
--   R$     390,00  CEBOLETE KG [KG] cod 110015009106
--   R$     340,00  OVOS GRANDE BRANCO UND [UN] cod 110030000602
--   R$     316,00  RUCULA HIDROPONICA KG [KG] cod 110010013645
--   R$     196,00  ALECRIM KG [KG] cod 110015009101
--   R$      77,78  ALCATRA BOVINO KG [KG] cod 100000017103
--   R$      62,50  SALSA KG [KG] cod 110015009118
--   R$      24,00  ABACAXI KG [KG] cod 110000020602
--   R$       5,00  CEBOLINHA KG [KG] cod 110015009107
--
-- 12 produtos ficaram de FORA (R$ 2.205,94): o nome
-- está no banco mas não no export do Teknisa do período, então não há código
-- nem grupo para eles. Quase todos são compra anterior a 01/08. Ficam para uma
-- segunda rodada com o export mais largo:
--   R$     389,79  OLEO DE SOJA LT 20X900 (COMPRA) [CX]
--   R$     298,97  CREME DE LEITE 35% - NESTILLY LT 12x1 [CX]
--   R$     298,97  CREME DE LEITE 35% - NESTILLY LT 12x1 (COMPRA) [CX]
--   R$     208,35  AZEITONA PRETA EM CONSERVA S/CAROCO BD (COMPRA) [BD]
--   R$     185,00  CAFE FUNCIONARIO [UN]
--   R$     177,40  FARINHA PANKO ROMARIZ 10X1KG [FD]
--   R$     154,51  OLEO DE SOJA 6X900ML (COMPRA) [FD]
--   R$     153,05  LINGUICA CALABRESA FATIADA KG [KG]
--   R$     135,50  AZEITONA VERDE EM CONSERVA S/ CAROCO (COMPRA) [BD]
--   R$     115,50  QUEIJO MATURADO - LALA [KG]
--   R$      83,90  FEIJAO PRETO FUNCIONARIO 10X1KG (COMPRA) [FD]
--   R$       5,00  BROCOLIS JAPONES KG [KG]
--
-- CASA POR CÓDIGO. Cada produto nasce com `codigoTeknisa`, e o nome deixa de
-- importar para o casamento. Os pares "(COMPRA)" / sem sufixo — que são o MESMO
-- produto renomeado pelo fornecedor — colapsaram num produto só, com o nome que
-- mais vendeu.
--
-- A UNIDADE foi normalizada pelo app (PCT vira CX, e por aí). O comentário
-- avisa quando a nota veio com outra unidade que a cadastrada.
--
-- A CATEGORIA é o grupo do Teknisa. Repare que nem todo grupo é insumo de
-- prato: DESCARTAVEIS, LIMPEZA, UTILIDADE PUBLICA, ATIVO IMOBILIZADO,
-- EMBALAGENS e INATIVOS são dinheiro real que NÃO vira ficha nem contagem
-- semanal. Comente o bloco que não quiser cadastrar agora.
--
-- Por categoria:
--   MERCEARIA                       79  R$    29.432,93
--   BEBIDAS ALCOOLICAS              45  R$    28.032,36
--   PROTEINAS                       22  R$    16.118,61
--   DESCARTAVEIS                    15  R$    13.954,99
--   BEBIDAS ALCOOLICAS - INSUMOS    21  R$    13.071,83
--   HORTIFRUTIGRANJEIRO             48  R$     6.375,82
--   SAFO                             3  R$     5.265,26
--   BEBIDAS NAO ALCOOLICAS - INSUMOS  10  R$     4.556,27
--   UTILIDADE PUBLICA                1  R$     3.495,45
--   ATIVO IMOBILIZADO                3  R$     3.169,79
--   BEBIDAS NAO ALCOOLICAS           9  R$     2.797,66
--   INATIVOS                         6  R$     2.552,32
--   LIMPEZA                          7  R$     2.339,57
--   GRUPO 751 (NAO CLASSIFICADO)     1  R$     1.767,74
--   GRAOS FUNCIONARIO                2  R$       489,35
--   EMBALAGENS                       2  R$        76,72

BEGIN;

INSERT INTO "Produto" (id, nome, "unidadeMedida", categoria, "codigoTeknisa", ativo, "criadoEm")
SELECT gen_random_uuid()::text, v.nome, v.unidade, v.categoria, v.codigo, true, now()
FROM (VALUES
  -- MERCEARIA: 79 produtos, R$ 29.432,93
  ('OLEO DE ALGODAO 14,5 LT (COMPRA)', 'CX', 'MERCEARIA', '105050007119'),  -- R$ 4.908,39 · nota em BD
  ('ARROZ ARBORIO PAGANINI 1KG', 'UND', 'MERCEARIA', '105015009102'),  -- R$ 2.050,87 · nota em UN
  ('LEITE INTEGRAL 12X1L (COMPRA)', 'CX', 'MERCEARIA', '105060008521'),  -- R$ 1.943,96
  ('OLEO DE ALGODAO 14,5 LT', 'CX', 'MERCEARIA', '105050007118'),  -- R$ 1.453,61 · nota em BD
  ('MANTEIGA S/SAL 5KG UN (COMPRA)', 'KG', 'MERCEARIA', '105060008535'),  -- R$ 1.221,50
  ('CAPSULA TRES ESPRESSO DESCAFEINADO 10X8G', 'UND', 'MERCEARIA', '105025013504'),  -- R$ 1.152,00 · nota em UN
  ('CHOCOLATE SICAO SELECAO GOTAS 70% KG', 'KG', 'MERCEARIA', '105055011603'),  -- R$ 1.106,48
  ('ARROZ BRANCO 6X5KG (COMPRA)', 'CX', 'MERCEARIA', '105015009103'),  -- R$ 1.098,48 · nota em FD
  ('QUEIJO MUSSARELA NODINI/NOZINHO', 'KG', 'MERCEARIA', '105060008539'),  -- R$ 910,00
  ('NESTLE NESTILLY UHT NPRO 12X1L', 'CX', 'MERCEARIA', '105060008568'),  -- R$ 896,90
  ('AZEITONA PRETA EM CONSERVA SEM CAROCO KG', 'KG', 'MERCEARIA', '105035009605'),  -- R$ 742,75
  ('OLEO DE SOJA 900ML UN (COMPRA)', 'CX', 'MERCEARIA', '105050007104'),  -- R$ 725,45 · nota em FD
  ('CREME DE LEITE 1,030 LT UN (COMPRA)', 'UND', 'MERCEARIA', '105060008545'),  -- R$ 683,52 · nota em UN
  ('AZEITONA VERDE S CAROCO BLD 15KG (COMPRA)', 'CX', 'MERCEARIA', '105035009634'),  -- R$ 549,80 · nota em BD
  ('CREME DE LEITE 15% PIRACANJUBA', 'LT', 'MERCEARIA', '105060008542'),  -- R$ 527,64
  ('ARROZ BRANCO UN 5KG (COMPRA)', 'UND', 'MERCEARIA', '105015009123'),  -- R$ 501,12 · nota em UN
  ('AZEITONA VERDE EM CONSERVA SEM CAROCO KG', 'KG', 'MERCEARIA', '105035009607'),  -- R$ 461,83
  ('MOLHO DE PIMENTA TABASCO 60L UN (COMPRA)', 'UND', 'MERCEARIA', '105000052725'),  -- R$ 432,00 · nota em UN
  ('QUEIJO EMMENTAL KG', 'KG', 'MERCEARIA', '105060008541'),  -- R$ 414,13
  ('MACARRAO DIVELLA 70 ROSMARINO KG', 'KG', 'MERCEARIA', '105065020105'),  -- R$ 372,96
  ('MASSA ROLINHO PRIMAVERA', 'UND', 'MERCEARIA', '105065020161'),  -- R$ 338,10 · nota em UN
  ('QUEIJO BUFALA TIPO BURRATA 200G (COMPRA)', 'UND', 'MERCEARIA', '105060008551'),  -- R$ 313,50 · nota em UN
  ('FILET DE ANCHOVA EM CONSERVA KG', 'KG', 'MERCEARIA', '105035009615'),  -- R$ 279,80
  ('ALCAPARRONES LA PASTINA 180G (COMPRA)', 'UND', 'MERCEARIA', '105035009625'),  -- R$ 274,45 · nota em UN
  ('MASSA FILLO CONG 750 GR AROSA', 'UND', 'MERCEARIA', '105065020165'),  -- R$ 266,60 · nota em UN
  ('GEMA DE OVO LT', 'LT', 'MERCEARIA', '105035009616'),  -- R$ 254,20
  ('TOMATE PELATI 2,5KG (COMPRA)', 'CX', 'MERCEARIA', '105065020153'),  -- R$ 240,70 · nota em LA
  ('MASSA DE PASTEL KG', 'KG', 'MERCEARIA', '105065020131'),  -- R$ 236,80
  ('QUEIJO MATURADO 60D', 'KG', 'MERCEARIA', '105060008544'),  -- R$ 232,52
  ('ALCAPARRONES EM CONSERVA KG', 'KG', 'MERCEARIA', '105035009603'),  -- R$ 231,30
  ('VINAGRE DE MACA LT', 'LT', 'MERCEARIA', '105000052617'),  -- R$ 217,43
  ('MEL ABELHA BISNAGA (COMPRA)', 'CX', 'MERCEARIA', '105020006609'),  -- R$ 214,60 · nota em BG
  ('ARROZ ORIENTAL LONGO 5KG', 'KG', 'MERCEARIA', '105015009122'),  -- R$ 213,58
  ('MACARRAO GRANO DURO - FETTUCCINE Nº12 0,500GR', 'KG', 'MERCEARIA', '105065020115'),  -- R$ 201,96
  ('MACARRAO GRANO DURO - ESPAGUETE DIVELLA Nº8 - 500G', 'UND', 'MERCEARIA', '105065020114'),  -- R$ 201,96 · nota em UN
  ('VINHO BRANCO SAINT GERMAIN 750ML', 'LT', 'MERCEARIA', '105040008613'),  -- R$ 200,00
  ('CHOCOLATE SICAO BARRA/GOTAS BRANCO KG', 'KG', 'MERCEARIA', '105055011605'),  -- R$ 191,70
  ('PIMENTA DO REINO VERDE KG', 'KG', 'MERCEARIA', '105000052649'),  -- R$ 185,80
  ('AZEITONA PRETA EM CONSERVA SEM CAROCO', 'CX', 'MERCEARIA', '105035009606'),  -- R$ 178,00 · nota em BD
  ('RICOTA CORONATA', 'KG', 'MERCEARIA', '105060008536'),  -- R$ 150,28
  ('AÇUCAR REFINADO 10X1KG', 'CX', 'MERCEARIA', '105030005608'),  -- R$ 149,09 · nota em FD
  ('PIMENTA DO REINO PRETA EM GRAOS KG', 'KG', 'MERCEARIA', '105000052651'),  -- R$ 143,80
  ('COUSCUS MARROQUINO KG', 'KG', 'MERCEARIA', '105045027108'),  -- R$ 142,44
  ('VINAGRE DE ARROZ LT', 'LT', 'MERCEARIA', '105000052618'),  -- R$ 136,80
  ('MOLHO DE TOMATE SACHE 1,7KG (COMPRA)', 'UND', 'MERCEARIA', '105065020168'),  -- R$ 133,30 · nota em UN
  ('FARINHA DE MANDIOCA KG', 'KG', 'MERCEARIA', '105045027116'),  -- R$ 133,00
  ('FARINHA DE TRIGO ANACONDA PREMIUM 5X5KG (COMPRA)', 'CX', 'MERCEARIA', '105045027175'),  -- R$ 132,99 · nota em FD
  ('MOLHO DE TOMATE SACHE KG', 'KG', 'MERCEARIA', '105065020140'),  -- R$ 130,80
  ('MILHO TORRADO MOSTARDA E MEL', 'KG', 'MERCEARIA', '105065020160'),  -- R$ 126,52
  ('MOLHO SHOYU 1010 ML TRAD. CEPERA (COMPRA)', 'UND', 'MERCEARIA', '105065020172'),  -- R$ 120,00 · nota em GF
  ('ACETO BALSAMICO 500ML', 'UND', 'MERCEARIA', '105000052724'),  -- R$ 102,76 · nota em UN
  ('MACARRAO ESPAGUETE 0,500G', 'KG', 'MERCEARIA', '105065020106'),  -- R$ 102,00
  ('FOLHAS NORI ROXUMURASAKI TALAOKAYA', 'UND', 'MERCEARIA', '105000052723'),  -- R$ 101,89 · nota em UN
  ('FEIJAO PRETO UN 1KG', 'KG', 'MERCEARIA', '105015009121'),  -- R$ 83,90
  ('AÇUCAR 6X5KG (COMPRA)', 'CX', 'MERCEARIA', '105030005603'),  -- R$ 79,98 · nota em FD
  ('UNTAFORMA/DEMOLDANTE', 'UND', 'MERCEARIA', '105050007117'),  -- R$ 73,40 · nota em UN
  ('AZEITONA PRETA KG 1,8 (COMPRA)', 'CX', 'MERCEARIA', '105035009627'),  -- R$ 73,19 · nota em BD
  ('VINAGRE CASTELO DE ALCOOL 12X750ML (COMPRA)', 'CX', 'MERCEARIA', '105000052621'),  -- R$ 65,00
  ('MACARRAO BIFUM ORIENTAL', 'UND', 'MERCEARIA', '105065020162'),  -- R$ 61,56 · nota em UN
  ('COENTRO EM GRAOS KG', 'KG', 'MERCEARIA', '105000052690'),  -- R$ 47,70
  ('MAIONESE BAG KG', 'KG', 'MERCEARIA', '105065020129'),  -- R$ 45,99
  ('LEMON PEPPER KG', 'KG', 'MERCEARIA', '105000052667'),  -- R$ 41,96
  ('MELACO DE ROMA DILUIDO', 'UND', 'MERCEARIA', '105020006620'),  -- R$ 40,38 · nota em UN
  ('QUEIJO CABRA TIPO FETA', 'KG', 'MERCEARIA', '105060008547'),  -- R$ 39,93
  ('MACARRAO PARAFUSO 0,500GR', 'KG', 'MERCEARIA', '105065020127'),  -- R$ 38,40
  ('PALMITO IN CONSERVA KG', 'KG', 'MERCEARIA', '105035009620'),  -- R$ 36,99
  ('POLENTA INSTANTANEA PAGANINI 500GR', 'UND', 'MERCEARIA', '105045027161'),  -- R$ 35,08 · nota em UN
  ('MOLHO DE PIMENTA SRIRACHA CEPERA LT', 'LT', 'MERCEARIA', '105065020135'),  -- R$ 30,00
  ('EXTRATO DE TOMATE SACHE KG', 'KG', 'MERCEARIA', '105065020102'),  -- R$ 29,40
  ('SAL GROSSO FARDO C/10X1KG (COMPRA)', 'CX', 'MERCEARIA', '105000052727'),  -- R$ 28,00 · nota em FD
  ('ATUM EM LATA KG', 'KG', 'MERCEARIA', '105035009604'),  -- R$ 24,82
  ('CHIMICHURRI COM PIMENTA KG', 'KG', 'MERCEARIA', '105000052693'),  -- R$ 23,98
  ('GERGELIM BRANCO KG', 'KG', 'MERCEARIA', '105000052672'),  -- R$ 22,85
  ('ACETO/VINAGRE BALSAMICO LT', 'LT', 'MERCEARIA', '105000052717'),  -- R$ 22,00
  ('TRIGO PARA KIBE KG', 'KG', 'MERCEARIA', '105045027171'),  -- R$ 14,30
  ('GRAO DE BICO PCT 500G (COMPRA)', 'UND', 'MERCEARIA', '105015009125'),  -- R$ 13,58 · nota em PC
  ('FECULA DE BATATAS KG', 'KG', 'MERCEARIA', '105045027157'),  -- R$ 11,50
  ('LENTILHA KG', 'KG', 'MERCEARIA', '105015009118'),  -- R$ 9,49
  ('SEMENTE DE CHIA KG', 'KG', 'MERCEARIA', '105000052630'),  -- R$ 7,49
  -- BEBIDAS ALCOOLICAS: 45 produtos, R$ 28.032,36
  ('CHOPP BRAHMA 30 LT', 'UND', 'BEBIDAS ALCOOLICAS', '900107000106'),  -- R$ 2.442,53 · nota em UN
  ('CORONA EXTRA N LONG NECK 24X330ML (COMPRA)', 'CX', 'BEBIDAS ALCOOLICAS', '900107000016'),  -- R$ 2.055,65
  ('WG MONSARAZ ALENTEJO DOC TINTO', 'UND', 'BEBIDAS ALCOOLICAS', '900001000678'),  -- R$ 1.453,48 · nota em UN
  ('WG MONSARAZ DOC BRANCO', 'UND', 'BEBIDAS ALCOOLICAS', '900001000061'),  -- R$ 1.266,60 · nota em UN
  ('BAROLO PRUNOTTO WINE', 'UND', 'BEBIDAS ALCOOLICAS', '900001000733'),  -- R$ 1.259,94 · nota em UN
  ('LE PETIT RONAN BY CLIENET AOC BORDEAUX WINE', 'UND', 'BEBIDAS ALCOOLICAS', '900001000640'),  -- R$ 1.232,82 · nota em UN
  ('CERVEJA STELLA GOLD LONG NECK 24X330ML (COMPRA)', 'CX', 'BEBIDAS ALCOOLICAS', '900107000019'),  -- R$ 1.184,70
  ('HERDADE PESO SOSSEGO BRANCO WINE', 'UND', 'BEBIDAS ALCOOLICAS', '900001000150'),  -- R$ 1.122,48 · nota em GF
  ('OR ANGE JAU BRANCO', 'UND', 'BEBIDAS ALCOOLICAS', '900001001527'),  -- R$ 1.039,26 · nota em UN
  ('FINCA SAN MARTIN CRIANZA WINE', 'UND', 'BEBIDAS ALCOOLICAS', '900001000617'),  -- R$ 914,36 · nota em UN
  ('CERVEJA STELLA ARTOIS LONG NECK 24X330ML (COMPRA)', 'CX', 'BEBIDAS ALCOOLICAS', '900107000017'),  -- R$ 853,05
  ('ABBOTS E DELAUNY LANGUEDOC ROUGE TINTO WINE', 'UND', 'BEBIDAS ALCOOLICAS', '900001000886'),  -- R$ 813,17 · nota em GF
  ('POGGIO MARU PRIMITIVO DI MANDURIA WINE', 'UND', 'BEBIDAS ALCOOLICAS', '900001000727'),  -- R$ 730,40 · nota em UN
  ('WG MONSARAZ DOC ROSE', 'UND', 'BEBIDAS ALCOOLICAS', '900001000217'),  -- R$ 726,74 · nota em UN
  ('CALABUIG ROSADO', 'UND', 'BEBIDAS ALCOOLICAS', '900001000233'),  -- R$ 726,74 · nota em GF
  ('VINHO TINTO MESSIAS DOURO 750ML', 'UND', 'BEBIDAS ALCOOLICAS', '900001001320'),  -- R$ 712,80 · nota em UN
  ('HERDADE DO GAMITO WINE', 'UND', 'BEBIDAS ALCOOLICAS', '900001000628'),  -- R$ 642,42 · nota em UN
  ('THERA ROSE WINE', 'UND', 'BEBIDAS ALCOOLICAS', '900001000229'),  -- R$ 590,28 · nota em UN
  ('VERMUTE CARPANO CLASSICO ROSSO 950ML - UNIDADE', 'UND', 'BEBIDAS ALCOOLICAS', '900108000803'),  -- R$ 584,65 · nota em UN
  ('VINHO DO CERRADO TRILHA MALBEC SYRAH', 'UND', 'BEBIDAS ALCOOLICAS', '900001001318'),  -- R$ 570,00 · nota em GF
  ('GIN BEEFEATER PINK 750ML', 'UND', 'BEBIDAS ALCOOLICAS', '900108000002'),  -- R$ 564,46 · nota em UN
  ('CONDE DE VALDEMAR TEMPRANILLO TINTO WINE', 'UND', 'BEBIDAS ALCOOLICAS', '900001000882'),  -- R$ 547,80 · nota em GF
  ('CHATEAU TANUNDA MATTHEWS R. CHARDONNAY BRANCO WINE', 'UND', 'BEBIDAS ALCOOLICAS', '900001000114'),  -- R$ 488,81 · nota em GF
  ('REGUENGOS RESERVA DOS SOCIOS DOC WINE', 'UND', 'BEBIDAS ALCOOLICAS', '900001000742'),  -- R$ 483,93 · nota em UN
  ('FOPPA & AMBROSI WINEMAKERS COLLECTION MARSELAN WIN', 'UND', 'BEBIDAS ALCOOLICAS', '900001001317'),  -- R$ 479,40 · nota em GF
  ('TORDO ALVARINHO VINHO VERDE WINE', 'UND', 'BEBIDAS ALCOOLICAS', '900001000198'),  -- R$ 478,02 · nota em GF
  ('BIZANTIUM ROSSO WINE', 'UND', 'BEBIDAS ALCOOLICAS', '900001001316'),  -- R$ 450,00 · nota em GF
  ('MESSIAS EXTRA BRUT ESPUMANTE WINE', 'UND', 'BEBIDAS ALCOOLICAS', '900001000361'),  -- R$ 386,00 · nota em GF
  ('CERVEJA SPATEN LONG NECK 24X330ML (COMPRA)', 'CX', 'BEBIDAS ALCOOLICAS', '900107000001'),  -- R$ 360,95 · nota em FD
  ('CASTELO DE BORBA RESERVA WINE', 'UND', 'BEBIDAS ALCOOLICAS', '900001000559'),  -- R$ 336,15 · nota em UN
  ('OVEJA BLACK BONARDA WINE', 'UND', 'BEBIDAS ALCOOLICAS', '900001001319'),  -- R$ 323,40 · nota em GF
  ('VIDIGUEIRA PREMIUM ANTAO VAZ ALENTEJO DOC 2024WINE', 'UND', 'BEBIDAS ALCOOLICAS', '900001000126'),  -- R$ 309,36 · nota em UN
  ('GIN AMAZZONI TRADICIONAL', 'UND', 'BEBIDAS ALCOOLICAS', '900108000011'),  -- R$ 284,70 · nota em UN
  ('LICOR COINTREAU LARANJA 700ML', 'UND', 'BEBIDAS ALCOOLICAS', '900108000303'),  -- R$ 219,65 · nota em UN
  ('QUINTA DAS TECEDEIRAS PORTO TAWNY RESERVA', 'UND', 'BEBIDAS ALCOOLICAS', '900001001313'),  -- R$ 215,80 · nota em UN
  ('NEDERBURG NOBLE LATE HARVEST WINE', 'UND', 'BEBIDAS ALCOOLICAS', '900001000416'),  -- R$ 170,39 · nota em UN
  ('WG POUCA ROUPA TINTO', 'UND', 'BEBIDAS ALCOOLICAS', '900001000729'),  -- R$ 167,12 · nota em UN
  ('MARQUES DE BORBA TINTO', 'UND', 'BEBIDAS ALCOOLICAS', '900001000659'),  -- R$ 162,49 · nota em UN
  ('DOSE WHISKEY JOHNNIE WALKER BLACK LABEL 12 ANOS', 'UND', 'BEBIDAS ALCOOLICAS', '900025004510'),  -- R$ 156,29 · nota em UN
  ('DOSE LICOR 43', 'DS', 'BEBIDAS ALCOOLICAS', '900025001533'),  -- R$ 127,79
  ('ESPUMANTE ROSE VOGA PINOT GRIGIO', 'UND', 'BEBIDAS ALCOOLICAS', '900001001535'),  -- R$ 116,92 · nota em GF
  ('SKOL LT 350ML', 'CX', 'BEBIDAS ALCOOLICAS', '900107000022'),  -- R$ 103,24
  ('SKOL LT 269ML', 'CX', 'BEBIDAS ALCOOLICAS', '900107000021'),  -- R$ 100,02
  ('LICOR STOCK CREME DE CASSIS 720ML UN (COMPRA)', 'UND', 'BEBIDAS ALCOOLICAS', '900108000309'),  -- R$ 40,09 · nota em UN
  ('CACHACA SALINAS TRADICIONAL 600ML', 'UND', 'BEBIDAS ALCOOLICAS', '900108000601'),  -- R$ 37,51 · nota em UN
  -- PROTEINAS: 22 produtos, R$ 16.118,61
  ('CAMARAO INTEIRO E LIMPO - 16/20 ROSA KG', 'KG', 'PROTEINAS', '100015013105'),  -- R$ 3.537,30
  ('CAMARAO DESC. E EVISC. IQF 51\60', 'KG', 'PROTEINAS', '100015013128'),  -- R$ 1.458,00
  ('CAMARAO 51/60 LIMPO S/ COLINHA', 'KG', 'PROTEINAS', '100015013130'),  -- R$ 1.445,40
  ('RABO BOVINO - RABADA KG', 'KG', 'PROTEINAS', '100000017132'),  -- R$ 1.230,12
  ('FRANGO A PASSARINHO KG', 'KG', 'PROTEINAS', '100010010609'),  -- R$ 1.196,30
  ('SOPPRESSATA MATTOS', 'KG', 'PROTEINAS', '100005019146'),  -- R$ 1.104,48
  ('POLVO NAC 1,5/2,0 KG', 'KG', 'PROTEINAS', '100015013121'),  -- R$ 932,10
  ('COPA DEFUMADA CERATI KG', 'KG', 'PROTEINAS', '100005019147'),  -- R$ 856,38
  ('ACEM BOVINO KG', 'KG', 'PROTEINAS', '100000017101'),  -- R$ 600,20
  ('COSTELINHA PREMIUM', 'KG', 'PROTEINAS', '100000017135'),  -- R$ 511,84
  ('LINGUICA SUINA CHURRASCO KG', 'KG', 'PROTEINAS', '100005019114'),  -- R$ 491,31
  ('FILE DE SASSAMI - FUNCIONÁRIO', 'KG', 'PROTEINAS', '100010010608'),  -- R$ 479,80
  ('SOBREPALETA SUINA SEM OSSO/COPA LOMBO KG', 'KG', 'PROTEINAS', '100005019135'),  -- R$ 432,78
  ('PRIME RIB SUINO KG', 'KG', 'PROTEINAS', '100005019130'),  -- R$ 312,68
  ('OSSO SERRADO BOVINO P/ MOLHO KG', 'KG', 'PROTEINAS', '100000017126'),  -- R$ 280,82
  ('SOPPRESSTA MATTOS', 'KG', 'PROTEINAS', '100005019143'),  -- R$ 272,40
  ('ACEM BOVINO MOIDO KG', 'KG', 'PROTEINAS', '100000017102'),  -- R$ 259,00
  ('PERNIL SEM OSSO KG', 'KG', 'PROTEINAS', '100005019124'),  -- R$ 191,90
  ('SALAME CERRADO MATTOS', 'KG', 'PROTEINAS', '100005019141'),  -- R$ 175,20
  ('FRALDINHA KG', 'KG', 'PROTEINAS', '100000017121'),  -- R$ 142,68
  ('FILE MIGNON SUINO KG', 'KG', 'PROTEINAS', '100005019137'),  -- R$ 111,94
  ('PATINHO BOVINO KG', 'KG', 'PROTEINAS', '100000017139'),  -- R$ 95,98
  -- DESCARTAVEIS: 15 produtos, R$ 13.954,99
  ('GUARDANAPO 40X23 WINE CX 2000 (COMPRA)', 'CX', 'DESCARTAVEIS', '120000006158'),  -- R$ 5.453,40
  ('COPO DESCARTAVEL CP-500ML C/450UND', 'CX', 'DESCARTAVEIS', '120000006108'),  -- R$ 2.137,60
  ('PAPEL TOALHA BOBINA 6X200 CX (COMPRA)', 'CX', 'DESCARTAVEIS', '120000006150'),  -- R$ 1.836,31
  ('EMBALAGENS SACOS A VACUO 25X35 0,12 MICRA', 'UND', 'DESCARTAVEIS', '120000006159'),  -- R$ 1.260,00 · nota em PC
  ('PAPEL TOALHA BOBINA', 'UND', 'DESCARTAVEIS', '120000006149'),  -- R$ 1.049,32 · nota em UN
  ('PAPEL HIGIENICO INTERFOLHADO CLIENTE 250 FLS', 'UND', 'DESCARTAVEIS', '120000006152'),  -- R$ 667,74 · nota em UN
  ('PLASTICO FILME PVC EM BOBINA 38X8X1000M', 'UND', 'DESCARTAVEIS', '120000006104'),  -- R$ 530,44 · nota em BOB
  ('PAPEL HIGIENICO FD 48X250 FLS', 'CX', 'DESCARTAVEIS', '120000006156'),  -- R$ 333,87
  ('VELA DE ANIVERSARIO', 'UND', 'DESCARTAVEIS', '120000006145'),  -- R$ 199,00 · nota em PC
  ('PAPEL ALUMINIO 45CM65M VABENE', 'UND', 'DESCARTAVEIS', '120000006128'),  -- R$ 163,14 · nota em RL
  ('ETIQUETA DE MANIPULACAO - RT-183 60X30 C/ 500UNID', 'UND', 'DESCARTAVEIS', '120000006109'),  -- R$ 114,04 · nota em PC
  ('FOLHA PAPEL A4', 'UND', 'DESCARTAVEIS', '120000006148'),  -- R$ 69,98 · nota em UN
  ('COLHER DESCARTAVEL RESISTENTE BRANCA C/50UN', 'CX', 'DESCARTAVEIS', '120000006106'),  -- R$ 69,30
  ('COPO DESCARTAVEL 200ML 1X100UN', 'UND', 'DESCARTAVEIS', '120000006144'),  -- R$ 49,05 · nota em UN
  ('MASCARA TRIPLA COM ELASTICO', 'CX', 'DESCARTAVEIS', '120000006142'),  -- R$ 21,80
  -- BEBIDAS ALCOOLICAS - INSUMOS: 21 produtos, R$ 13.071,83
  ('APEROL GF 750ML UN (COMPRA)', 'UND', 'BEBIDAS ALCOOLICAS - INSUMOS', '130005000606'),  -- R$ 2.888,10 · nota em UN
  ('WHISKEY JACK DANIEL TRADICIONAL 1LT GR', 'UND', 'BEBIDAS ALCOOLICAS - INSUMOS', '130005000406'),  -- R$ 2.171,50 · nota em UN
  ('BON VIVANT GIN', 'LT', 'BEBIDAS ALCOOLICAS - INSUMOS', '130005000117'),  -- R$ 1.776,60
  ('LICOR ANGOSTURA BITTER AROMATIC 200ML', 'LT', 'BEBIDAS ALCOOLICAS - INSUMOS', '130005000614'),  -- R$ 828,24
  ('WHISKEY OLD PAR 12 ANOS 750ML', 'UND', 'BEBIDAS ALCOOLICAS - INSUMOS', '130005000434'),  -- R$ 696,27 · nota em UN
  ('CACHAÇA CRISTAL DE GOIAS 600ML UN (COMPRA)', 'UND', 'BEBIDAS ALCOOLICAS - INSUMOS', '130005000223'),  -- R$ 672,00 · nota em UN
  ('GIN ING BEEFEATER PINK 700ML', 'UND', 'BEBIDAS ALCOOLICAS - INSUMOS', '130005000118'),  -- R$ 645,14 · nota em UN
  ('APEROL GF 750ML', 'LT', 'BEBIDAS ALCOOLICAS - INSUMOS', '130005000617'),  -- R$ 603,04
  ('BON VIVANTE FIN 750ML (COMPRA)', 'UND', 'BEBIDAS ALCOOLICAS - INSUMOS', '130005000119'),  -- R$ 592,20 · nota em UN
  ('CACHAÇA CRISTAL DE GOIAS 600ML', 'LT', 'BEBIDAS ALCOOLICAS - INSUMOS', '130005000221'),  -- R$ 336,00
  ('ANGOSTURA BITTER 200ML UN (COMPRA)', 'UND', 'BEBIDAS ALCOOLICAS - INSUMOS', '130005000619'),  -- R$ 331,60 · nota em UN
  ('APEROL GF 750ML (COMPRA)', 'UND', 'BEBIDAS ALCOOLICAS - INSUMOS', '130005000618'),  -- R$ 322,81 · nota em UN
  ('LICOR DE PESSEGO PEACHETREE 700ML', 'UND', 'BEBIDAS ALCOOLICAS - INSUMOS', '130005000716'),  -- R$ 289,57 · nota em UN
  ('WHISKEY JOHNNIE WALKER BLACK LABEL 12 ANOS 1LT', 'UND', 'BEBIDAS ALCOOLICAS - INSUMOS', '130005000433'),  -- R$ 288,05 · nota em UN
  ('VERMOUTH CARPANO PUNT MES 750ML', 'UND', 'BEBIDAS ALCOOLICAS - INSUMOS', '130005001004'),  -- R$ 158,27 · nota em UN
  ('CONHAQUE DOMECQ 1LT', 'UND', 'BEBIDAS ALCOOLICAS - INSUMOS', '130005000503'),  -- R$ 153,83 · nota em UN
  ('LICOR 43 GF 700ML', 'LT', 'BEBIDAS ALCOOLICAS - INSUMOS', '130005000747'),  -- R$ 127,78
  ('WHISKEY JAMESON 750ML', 'UND', 'BEBIDAS ALCOOLICAS - INSUMOS', '130005000407'),  -- R$ 84,25 · nota em UN
  ('CONHAQUE DOMUS LT', 'UND', 'BEBIDAS ALCOOLICAS - INSUMOS', '130005000504'),  -- R$ 48,06 · nota em UN
  ('CACHACA VELHO BARREIRO 910ML (COMPRA)', 'UND', 'BEBIDAS ALCOOLICAS - INSUMOS', '130005000225'),  -- R$ 31,48 · nota em UN
  ('CACHACA SAGATIBA PURA CRISTALINA', 'UND', 'BEBIDAS ALCOOLICAS - INSUMOS', '130005000207'),  -- R$ 27,04 · nota em UN
  -- HORTIFRUTIGRANJEIRO: 48 produtos, R$ 6.375,82
  ('COGUMELO PORTO BELO KG', 'KG', 'HORTIFRUTIGRANJEIRO', '110020004109'),  -- R$ 994,60
  ('COGUMELO SHIMEJI PRETO KG', 'KG', 'HORTIFRUTIGRANJEIRO', '110020004106'),  -- R$ 926,10
  ('MICROVERDES DE RABANETE (40G)', 'GR', 'HORTIFRUTIGRANJEIRO', '110010013636'),  -- R$ 512,00
  ('BATATA BAROA KG', 'KG', 'HORTIFRUTIGRANJEIRO', '110005019609'),  -- R$ 497,67
  ('ACELGA CHINESA', 'UND', 'HORTIFRUTIGRANJEIRO', '110005019651'),  -- R$ 261,00 · nota em UN
  ('FLORES COMESTIVEIS KG', 'KG', 'HORTIFRUTIGRANJEIRO', '110010013601'),  -- R$ 208,00
  ('MICROVERDES DE RUCULA (40G)', 'UND', 'HORTIFRUTIGRANJEIRO', '110010013639'),  -- R$ 204,00 · nota em UN
  ('TOMATE CEREJA AMARELO KG', 'KG', 'HORTIFRUTIGRANJEIRO', '110005019639'),  -- R$ 201,60
  ('ACELGA KG', 'KG', 'HORTIFRUTIGRANJEIRO', '110010013605'),  -- R$ 198,00
  ('BROCOLIS KG', 'KG', 'HORTIFRUTIGRANJEIRO', '110010013630'),  -- R$ 184,00
  ('COGUMELO SHITAKE 200G UN (COMPRA)', 'UND', 'HORTIFRUTIGRANJEIRO', '110020004115'),  -- R$ 184,00 · nota em UN
  ('MANJERICAO UN', 'UND', 'HORTIFRUTIGRANJEIRO', '110015009126'),  -- R$ 182,50 · nota em UN
  ('COUVE FLOR KG', 'KG', 'HORTIFRUTIGRANJEIRO', '110010013619'),  -- R$ 180,50
  ('MICROVERDES DE RABANETE (40G) (COMPRA)', 'UND', 'HORTIFRUTIGRANJEIRO', '110010013647'),  -- R$ 160,00 · nota em UN
  ('TORANJA KG', 'KG', 'HORTIFRUTIGRANJEIRO', '110000020641'),  -- R$ 158,20
  ('COGUMELO SHIMEJI BRANCO KG', 'KG', 'HORTIFRUTIGRANJEIRO', '110020004107'),  -- R$ 153,00
  ('MICROVERDES DE RUCULA (40G) (COMPRA)', 'UND', 'HORTIFRUTIGRANJEIRO', '110010013649'),  -- R$ 136,00 · nota em UN
  ('ALFACE FRIZE KG', 'KG', 'HORTIFRUTIGRANJEIRO', '110010013611'),  -- R$ 129,50
  ('ALFACE FRIZE', 'UND', 'HORTIFRUTIGRANJEIRO', '110010013640'),  -- R$ 94,50 · nota em UN
  ('SHIMEJI PRETO 200G UN (COMPRA)', 'UND', 'HORTIFRUTIGRANJEIRO', '110020004116'),  -- R$ 91,36 · nota em UN
  ('HORTELA KG', 'KG', 'HORTIFRUTIGRANJEIRO', '110015009112'),  -- R$ 87,50
  ('UVA VITORIA KG', 'KG', 'HORTIFRUTIGRANJEIRO', '110000020654'),  -- R$ 63,00
  ('TOMILHO UN', 'UND', 'HORTIFRUTIGRANJEIRO', '110010013642'),  -- R$ 59,50 · nota em UN
  ('SHIMEJI BRANCO 200G (BDJ) KZ (COMPRA)', 'UND', 'HORTIFRUTIGRANJEIRO', '110020004117'),  -- R$ 52,00 · nota em UN
  ('FLOR COMESTIVEL', 'UND', 'HORTIFRUTIGRANJEIRO', '110010013644'),  -- R$ 48,00 · nota em UN
  ('BROTO FEIJAO KG', 'KG', 'HORTIFRUTIGRANJEIRO', '110005019655'),  -- R$ 36,00
  ('BATATA INGLESA KG', 'KG', 'HORTIFRUTIGRANJEIRO', '110005019612'),  -- R$ 34,66
  ('MICROVERDES DE RUCULA (40G)', 'KG', 'HORTIFRUTIGRANJEIRO', '110010013648'),  -- R$ 34,00
  ('UVA THOMPSON VERDE KG', 'KG', 'HORTIFRUTIGRANJEIRO', '110000020643'),  -- R$ 32,00
  ('SALSAO KG', 'KG', 'HORTIFRUTIGRANJEIRO', '110015009120'),  -- R$ 31,29
  ('POLPA GOIABA KG', 'KG', 'HORTIFRUTIGRANJEIRO', '110025008615'),  -- R$ 30,00
  ('MIX DE MICROVERDES 40G', 'UND', 'HORTIFRUTIGRANJEIRO', '110010013633'),  -- R$ 30,00 · nota em UN
  ('LIMAO GALEGO KG', 'KG', 'HORTIFRUTIGRANJEIRO', '110000020624'),  -- R$ 24,60
  ('AMEIXA FRESCA KG', 'KG', 'HORTIFRUTIGRANJEIRO', '110000020603'),  -- R$ 21,60
  ('BATATA BOLINHA KG', 'KG', 'HORTIFRUTIGRANJEIRO', '110005019610'),  -- R$ 19,76
  ('SALSAO UN', 'UND', 'HORTIFRUTIGRANJEIRO', '110015009130'),  -- R$ 18,00 · nota em UN
  ('FIGO IN NATURA KG', 'KG', 'HORTIFRUTIGRANJEIRO', '110000020615'),  -- R$ 16,00
  ('CHUCHU KG', 'KG', 'HORTIFRUTIGRANJEIRO', '110005019620'),  -- R$ 14,96
  ('PERA KG', 'KG', 'HORTIFRUTIGRANJEIRO', '110000020635'),  -- R$ 14,25
  ('GRAPE FRUIT', 'KG', 'HORTIFRUTIGRANJEIRO', '110000020652'),  -- R$ 12,00
  ('BROTO FEIJÃO', 'UND', 'HORTIFRUTIGRANJEIRO', '110005019653'),  -- R$ 9,00 · nota em UN
  ('RABANETE UN', 'UND', 'HORTIFRUTIGRANJEIRO', '110005019654'),  -- R$ 6,00 · nota em UN
  ('RABANETE KG', 'KG', 'HORTIFRUTIGRANJEIRO', '110005019637'),  -- R$ 6,00
  ('TANGERINA KG', 'KG', 'HORTIFRUTIGRANJEIRO', '110000020640'),  -- R$ 4,95
  ('QUIABO KG', 'KG', 'HORTIFRUTIGRANJEIRO', '110005019636'),  -- R$ 4,00
  ('MAXIXE KG', 'KG', 'HORTIFRUTIGRANJEIRO', '110005019626'),  -- R$ 3,92
  ('ALFACE ROXO UN', 'UND', 'HORTIFRUTIGRANJEIRO', '110010013643'),  -- R$ 3,60 · nota em UN
  ('ABOBORA ITALIANA KG', 'KG', 'HORTIFRUTIGRANJEIRO', '110010013650'),  -- R$ 2,70
  -- SAFO: 3 produtos, R$ 5.265,26
  ('BURRATA UN', 'UND', 'SAFO', '320000000001'),  -- R$ 2.500,00 · nota em UN
  ('SALAME ITALIANO DEFUMADO KG', 'KG', 'SAFO', '320000000036'),  -- R$ 2.211,77
  ('QUEIJO PECORINO FRACIONADO 200GR - KG (COMPRA)', 'KG', 'SAFO', '320000000073'),  -- R$ 553,49
  -- BEBIDAS NAO ALCOOLICAS - INSUMOS: 10 produtos, R$ 4.556,27
  ('XAROPE MONIN MAÇA VERDE (COMPRA)', 'UND', 'BEBIDAS NAO ALCOOLICAS - INSUMOS', '135000000052'),  -- R$ 794,10 · nota em UN
  ('XAROPE MONIN CRANBERRY 700ML UN (COMPRA)', 'UND', 'BEBIDAS NAO ALCOOLICAS - INSUMOS', '135000000051'),  -- R$ 687,42 · nota em UN
  ('XAROPE MONIN ROSA', 'UND', 'BEBIDAS NAO ALCOOLICAS - INSUMOS', '135000000049'),  -- R$ 635,76 · nota em UN
  ('XAROPE MONIN TORANJA', 'LT', 'BEBIDAS NAO ALCOOLICAS - INSUMOS', '135000000024'),  -- R$ 618,48
  ('CONCENTRADO GENGIBRE', 'LT', 'BEBIDAS NAO ALCOOLICAS - INSUMOS', '135000000047'),  -- R$ 606,40
  ('XAROPE MONIN ROSE', 'LT', 'BEBIDAS NAO ALCOOLICAS - INSUMOS', '135000000022'),  -- R$ 373,84
  ('XAROPE MONIN MARACUJA', 'LT', 'BEBIDAS NAO ALCOOLICAS - INSUMOS', '135000000018'),  -- R$ 360,90
  ('XAROPE MONIN CARAMELO 700ML UN (COMPRA)', 'UND', 'BEBIDAS NAO ALCOOLICAS - INSUMOS', '135000000053'),  -- R$ 257,88 · nota em UN
  ('GUARANA ANTARCTICA 1L', 'LT', 'BEBIDAS NAO ALCOOLICAS - INSUMOS', '135000000203'),  -- R$ 214,80
  ('GUARANA CHP ANTARTICA PET 1L PACK C/ 2 (COMPRA)', 'CX', 'BEBIDAS NAO ALCOOLICAS - INSUMOS', '135000000204'),  -- R$ 6,69
  -- UTILIDADE PUBLICA: 1 produtos, R$ 3.495,45
  ('GLP EM CILINDRO GRANEL', 'KG/M³', 'UTILIDADE PUBLICA', '125000000000'),  -- R$ 3.495,45
  -- ATIVO IMOBILIZADO: 3 produtos, R$ 3.169,79
  ('TRAVESSA OVAL PORC 24X14CM', 'UND', 'ATIVO IMOBILIZADO', '140000000006'),  -- R$ 1.462,55 · nota em UN
  ('LINHA RUSTICO PILOTTO 3 00 LARG', 'MT', 'ATIVO IMOBILIZADO', '140000000004'),  -- R$ 897,00
  ('COPO L DRINK AMER DUPLO 2910 NADIR 450ML', 'UND', 'ATIVO IMOBILIZADO', '140000000005'),  -- R$ 810,24 · nota em UN
  -- BEBIDAS NAO ALCOOLICAS: 9 produtos, R$ 2.797,66
  ('CORONA CERO LONG NECK 24X330ML (COMPRA)', 'CX', 'BEBIDAS NAO ALCOOLICAS', '905066000004'),  -- R$ 1.549,50
  ('PEPSI BLACK LATA 350ML', 'UND', 'BEBIDAS NAO ALCOOLICAS', '905005011132'),  -- R$ 329,72 · nota em UN
  ('AGUA MIN C/GAS 24x500 SAN PELEGRINO (COMPRA)', 'CX', 'BEBIDAS NAO ALCOOLICAS', '905000005159'),  -- R$ 317,34
  ('ENERGETICO RED BULL TROPICAL', 'UND', 'BEBIDAS NAO ALCOOLICAS', '905010004106'),  -- R$ 237,58 · nota em UN
  ('CAPSULA CAFE CAPPUCCINO 3CORACOES CX10 (COMPRA)', 'CX', 'BEBIDAS NAO ALCOOLICAS', '905045000045'),  -- R$ 144,00
  ('PEPSI ZERO LATA 12X350 (COMPRA)', 'CX', 'BEBIDAS NAO ALCOOLICAS', '905005011148'),  -- R$ 99,82
  ('PEPSI LATA 350ML', 'UND', 'BEBIDAS NAO ALCOOLICAS', '905005011131'),  -- R$ 60,00 · nota em UN
  ('PEPSI COLA LATA 12X350 (COMPRA)', 'CX', 'BEBIDAS NAO ALCOOLICAS', '905005011156'),  -- R$ 30,01
  ('ENERGETICO RED BULL SUGAR FREE', 'UND', 'BEBIDAS NAO ALCOOLICAS', '905005011198'),  -- R$ 29,69 · nota em UN
  -- INATIVOS: 6 produtos, R$ 2.552,32
  ('COPPA ITALIANA', 'KG', 'INATIVOS', '400000000104'),  -- R$ 1.316,00
  ('QUEIJO GOUDA KG', 'KG', 'INATIVOS', '400000000133'),  -- R$ 727,34
  ('QUEIJO CANASTRA - TRIANGULO MINEIRO KG', 'KG', 'INATIVOS', '400000000129'),  -- R$ 268,89
  ('SALSICHA HOTDOG KG', 'KG', 'INATIVOS', '400000000151'),  -- R$ 125,94
  ('CAPSULAS DE GAS N20 FPRO P/ CHANTILLY 8GR', 'UND', 'INATIVOS', '400000000171'),  -- R$ 95,20 · nota em UN
  ('ZAATAR KG', 'KG', 'INATIVOS', '400000000189'),  -- R$ 18,95
  -- LIMPEZA: 7 produtos, R$ 2.339,57
  ('AROMATIZADOR EKKOA FRAGRANCIA DREAMS BAMBOO', 'UND', 'LIMPEZA', '115000000702'),  -- R$ 1.007,44 · nota em UN
  ('DESINFETANTE AZULIM LAVANDA 5 LITROS START', 'CX', 'LIMPEZA', '115000000806'),  -- R$ 878,88 · nota em GA
  ('LUVA LATEX RANHURADA AMAR C. LONGO M 1PA VABENE', 'UND', 'LIMPEZA', '115000001612'),  -- R$ 227,50 · nota em PC
  ('LIMPADOR MULTIUSO VEJA', 'UND', 'LIMPEZA', '115000000827'),  -- R$ 143,52 · nota em UN
  ('SODA CAUSTICA 1KG', 'UND', 'LIMPEZA', '115000000823'),  -- R$ 51,68 · nota em UN
  ('LIMPA ALUMINIO ALUMIL LIMAO 500ML', 'UND', 'LIMPEZA', '115000000824'),  -- R$ 26,25 · nota em UN
  ('ESCOVA MULTIUSO', 'UND', 'LIMPEZA', '115000001910'),  -- R$ 4,30 · nota em UN
  -- GRUPO 751 (NAO CLASSIFICADO): 1 produtos, R$ 1.767,74
  ('EVENTO CHATEAU BEAUREGARD DUCASSE', 'UND', 'GRUPO 751 (NAO CLASSIFICADO)', '751000000416'),  -- R$ 1.767,74 · nota em UN
  -- GRAOS FUNCIONARIO: 2 produtos, R$ 489,35
  ('CAFE TOR MOI 3 CORACOES FORT STAND 10X500G (COMPRA', 'CX', 'GRAOS FUNCIONARIO', '610005002501'),  -- R$ 370,00
  ('FEIJAO CARIOCA FUNCIONARIO 10X1KG (COMPRA)', 'CX', 'GRAOS FUNCIONARIO', '610005002002'),  -- R$ 119,35 · nota em FD
  -- EMBALAGENS: 2 produtos, R$ 76,72
  ('POTE REDONDO TRP 500ML C/TAMPA 24UN', 'UND', 'EMBALAGENS', '121000000026'),  -- R$ 48,72 · nota em PC
  ('POTE REDONDO PP TRP KIT C/TAMPA 250ML 24UN', 'UND', 'EMBALAGENS', '121000000027')  -- R$ 28,00 · nota em PC
) AS v(nome, unidade, categoria, codigo)
-- Não duplica: nem por nome+unidade (o índice que já existe ignora caixa) nem
-- por código. Rodar duas vezes não cria nada.
WHERE NOT EXISTS (
    SELECT 1 FROM "Produto" p
    WHERE lower(btrim(p.nome)) = lower(btrim(v.nome)) AND p."unidadeMedida" = v.unidade
  )
  AND (v.codigo IS NULL OR NOT EXISTS (
    SELECT 1 FROM "Produto" p WHERE p."codigoTeknisa" = v.codigo
  ));

COMMIT;

-- CONFERÊNCIA: 274 produtos novos, por categoria.
SELECT p.categoria, count(*) AS produtos, count(p."codigoTeknisa") AS com_codigo
FROM "Produto" p
WHERE lower(btrim(p.nome)) IN ('guardanapo 40x23 wine cx 2000 (compra)', 'oleo de algodao 14,5 lt (compra)', 'camarao inteiro e limpo - 16/20 rosa kg', 'glp em cilindro granel', 'aperol gf 750ml un (compra)', 'burrata un', 'chopp brahma 30 lt', 'salame italiano defumado kg', 'whiskey jack daniel tradicional 1lt gr', 'copo descartavel cp-500ml c/450und', 'corona extra n long neck 24x330ml (compra)', 'leite integral 12x1l (compra)', 'papel toalha bobina 6x200 cx (compra)', 'bon vivant gin', 'evento chateau beauregard ducasse', 'arroz arborio paganini 1kg', 'travessa oval porc 24x14cm', 'camarao desc. e evisc. iqf 51\60', 'oleo de algodao 14,5 lt', 'wg monsaraz alentejo doc tinto', 'camarao 51/60 limpo s/ colinha', 'coppa italiana', 'corona cero long neck 24x330ml (compra)', 'wg monsaraz doc branco', 'embalagens sacos a vacuo 25x35 0,12 micra', 'barolo prunotto wine', 'le petit ronan by clienet aoc bordeaux wine', 'rabo bovino - rabada kg', 'manteiga s/sal 5kg un (compra)', 'frango a passarinho kg', 'cerveja stella gold long neck 24x330ml (compra)', 'herdade peso sossego branco wine', 'chocolate sicao selecao gotas 70% kg', 'soppressata mattos', 'arroz branco 6x5kg (compra)', 'papel toalha bobina', 'or ange jau branco', 'aromatizador ekkoa fragrancia dreams bamboo', 'cogumelo porto belo kg', 'polvo nac 1,5/2,0 kg', 'cogumelo shimeji preto kg', 'finca san martin crianza wine', 'queijo mussarela nodini/nozinho', 'linha rustico pilotto 3 00 larg', 'nestle nestilly uht npro 12x1l', 'desinfetante azulim lavanda 5 litros start', 'copa defumada cerati kg', 'cerveja stella artois long neck 24x330ml (compra)', 'licor angostura bitter aromatic 200ml', 'abbots e delauny languedoc rouge tinto wine', 'copo l drink amer duplo 2910 nadir 450ml', 'xarope monin maça verde (compra)', 'azeitona preta em conserva sem caroco kg', 'poggio maru primitivo di manduria wine', 'queijo gouda kg', 'wg monsaraz doc rose', 'calabuig rosado', 'oleo de soja 900ml un (compra)', 'capsula tres espresso descafeinado 10x8g', 'vinho tinto messias douro 750ml', 'whiskey old par 12 anos 750ml', 'xarope monin cranberry 700ml un (compra)', 'creme de leite 1,030 lt un (compra)', 'cachaça cristal de goias 600ml un (compra)', 'papel higienico interfolhado cliente 250 fls', 'gin ing beefeater pink 700ml', 'herdade do gamito wine', 'xarope monin rosa', 'xarope monin toranja', 'concentrado gengibre', 'aperol gf 750ml', 'acem bovino kg', 'bon vivante fin 750ml (compra)', 'thera rose wine', 'vermute carpano classico rosso 950ml - unidade', 'vinho do cerrado trilha malbec syrah', 'gin beefeater pink 750ml', 'queijo pecorino fracionado 200gr - kg (compra)', 'azeitona verde s caroco bld 15kg (compra)', 'conde de valdemar tempranillo tinto wine', 'plastico filme pvc em bobina 38x8x1000m', 'creme de leite 15% piracanjuba', 'microverdes de rabanete (40g)', 'costelinha premium', 'arroz branco un 5kg (compra)', 'batata baroa kg', 'linguica suina churrasco kg', 'chateau tanunda matthews r. chardonnay branco wine', 'reguengos reserva dos socios doc wine', 'file de sassami - funcionário', 'foppa & ambrosi winemakers collection marselan win', 'tordo alvarinho vinho verde wine', 'azeitona verde em conserva sem caroco kg', 'bizantium rosso wine', 'sobrepaleta suina sem osso/copa lombo kg', 'molho de pimenta tabasco 60l un (compra)', 'queijo emmental kg', 'messias extra brut espumante wine', 'xarope monin rose', 'macarrao divella 70 rosmarino kg', 'cafe tor moi 3 coracoes fort stand 10x500g (compra', 'cerveja spaten long neck 24x330ml (compra)', 'xarope monin maracuja', 'massa rolinho primavera', 'castelo de borba reserva wine', 'cachaça cristal de goias 600ml', 'papel higienico fd 48x250 fls', 'angostura bitter 200ml un (compra)', 'pepsi black lata 350ml', 'oveja black bonarda wine', 'aperol gf 750ml (compra)', 'agua min c/gas 24x500 san pelegrino (compra)', 'queijo bufala tipo burrata 200g (compra)', 'prime rib suino kg', 'vidigueira premium antao vaz alentejo doc 2024wine', 'licor de pessego peachetree 700ml', 'whiskey johnnie walker black label 12 anos 1lt', 'gin amazzoni tradicional', 'osso serrado bovino p/ molho kg', 'filet de anchova em conserva kg', 'alcaparrones la pastina 180g (compra)', 'soppressta mattos', 'queijo canastra - triangulo mineiro kg', 'massa fillo cong 750 gr arosa', 'acelga chinesa', 'acem bovino moido kg', 'xarope monin caramelo 700ml un (compra)', 'gema de ovo lt', 'tomate pelati 2,5kg (compra)', 'energetico red bull tropical', 'massa de pastel kg', 'queijo maturado 60d', 'alcaparrones em conserva kg', 'luva latex ranhurada amar c. longo m 1pa vabene', 'licor cointreau laranja 700ml', 'vinagre de maca lt', 'quinta das tecedeiras porto tawny reserva', 'guarana antarctica 1l', 'mel abelha bisnaga (compra)', 'arroz oriental longo 5kg', 'flores comestiveis kg', 'microverdes de rucula (40g)', 'macarrao grano duro - fettuccine nº12 0,500gr', 'macarrao grano duro - espaguete divella nº8 - 500g', 'tomate cereja amarelo kg', 'vinho branco saint germain 750ml', 'vela de aniversario', 'acelga kg', 'pernil sem osso kg', 'chocolate sicao barra/gotas branco kg', 'pimenta do reino verde kg', 'brocolis kg', 'cogumelo shitake 200g un (compra)', 'manjericao un', 'couve flor kg', 'azeitona preta em conserva sem caroco', 'salame cerrado mattos', 'nederburg noble late harvest wine', 'wg pouca roupa tinto', 'papel aluminio 45cm65m vabene', 'marques de borba tinto', 'microverdes de rabanete (40g) (compra)', 'vermouth carpano punt mes 750ml', 'toranja kg', 'dose whiskey johnnie walker black label 12 anos', 'conhaque domecq 1lt', 'cogumelo shimeji branco kg', 'ricota coronata', 'açucar refinado 10x1kg', 'capsula cafe cappuccino 3coracoes cx10 (compra)', 'pimenta do reino preta em graos kg', 'limpador multiuso veja', 'fraldinha kg', 'couscus marroquino kg', 'vinagre de arroz lt', 'microverdes de rucula (40g) (compra)', 'molho de tomate sache 1,7kg (compra)', 'farinha de mandioca kg', 'farinha de trigo anaconda premium 5x5kg (compra)', 'molho de tomate sache kg', 'alface frize kg', 'dose licor 43', 'licor 43 gf 700ml', 'milho torrado mostarda e mel', 'salsicha hotdog kg', 'molho shoyu 1010 ml trad. cepera (compra)', 'feijao carioca funcionario 10x1kg (compra)', 'espumante rose voga pinot grigio', 'etiqueta de manipulacao - rt-183 60x30 c/ 500unid', 'file mignon suino kg', 'skol lt 350ml', 'aceto balsamico 500ml', 'macarrao espaguete 0,500g', 'folhas nori roxumurasaki talaokaya', 'skol lt 269ml', 'pepsi zero lata 12x350 (compra)', 'patinho bovino kg', 'capsulas de gas n20 fpro p/ chantilly 8gr', 'alface frize', 'shimeji preto 200g un (compra)', 'hortela kg', 'whiskey jameson 750ml', 'feijao preto un 1kg', 'açucar 6x5kg (compra)', 'untaforma/demoldante', 'azeitona preta kg 1,8 (compra)', 'folha papel a4', 'colher descartavel resistente branca c/50un', 'vinagre castelo de alcool 12x750ml (compra)', 'uva vitoria kg', 'macarrao bifum oriental', 'pepsi lata 350ml', 'tomilho un', 'shimeji branco 200g (bdj) kz (compra)', 'soda caustica 1kg', 'copo descartavel 200ml 1x100un', 'pote redondo trp 500ml c/tampa 24un', 'conhaque domus lt', 'flor comestivel', 'coentro em graos kg', 'maionese bag kg', 'lemon pepper kg', 'melaco de roma diluido', 'licor stock creme de cassis 720ml un (compra)', 'queijo cabra tipo feta', 'macarrao parafuso 0,500gr', 'cachaca salinas tradicional 600ml', 'palmito in conserva kg', 'broto feijao kg', 'polenta instantanea paganini 500gr', 'batata inglesa kg', 'microverdes de rucula (40g)', 'uva thompson verde kg', 'cachaca velho barreiro 910ml (compra)', 'salsao kg', 'pepsi cola lata 12x350 (compra)', 'polpa goiaba kg', 'molho de pimenta sriracha cepera lt', 'mix de microverdes 40g', 'energetico red bull sugar free', 'extrato de tomate sache kg', 'sal grosso fardo c/10x1kg (compra)', 'pote redondo pp trp kit c/tampa 250ml 24un', 'cachaca sagatiba pura cristalina', 'limpa aluminio alumil limao 500ml', 'atum em lata kg', 'limao galego kg', 'chimichurri com pimenta kg', 'gergelim branco kg', 'aceto/vinagre balsamico lt', 'mascara tripla com elastico', 'ameixa fresca kg', 'batata bolinha kg', 'zaatar kg', 'salsao un', 'figo in natura kg', 'chuchu kg', 'trigo para kibe kg', 'pera kg', 'grao de bico pct 500g (compra)', 'grape fruit', 'fecula de batatas kg', 'lentilha kg', 'broto feijão', 'semente de chia kg', 'guarana chp antartica pet 1l pack c/ 2 (compra)', 'rabanete un', 'rabanete kg', 'tangerina kg', 'escova multiuso', 'quiabo kg', 'maxixe kg', 'alface roxo un', 'abobora italiana kg')
GROUP BY p.categoria
ORDER BY produtos DESC;
