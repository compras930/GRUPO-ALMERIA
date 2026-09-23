-- Rodada de vinhos do Wine Garden — gerado de 6ede9798-pareamento-vinhos-wine-garden.xlsx
--
-- 84 produtos criados, 29 códigos gravados em produtos existentes,
-- 59 receitas de venda. 6 linha(s) recusada(s), listadas no fim.
--
-- IDEMPOTENTE: ids derivados por hash, INSERT com ON CONFLICT DO NOTHING e
-- UPDATE guardado por "só se ainda estiver nulo". Rodar duas vezes não duplica
-- nada e não toca em ficha que já existe.
--
-- Rode um passo de cada vez no editor do Neon, conferindo entre eles.

-- ---------------------------------------------------------------------------
-- PASSO 1 — Criar os 84 produtos novos.
-- ---------------------------------------------------------------------------
INSERT INTO "Produto" (id, nome, "unidadeMedida", "codigoTeknisa", ativo, "criadoEm")
VALUES
  ('pwg1ac3e83366a5f8bde71255', 'TABALI PEDREGOSO GRAN RESERVA CHARDONNAY', 'UND', '900001000109', true, now()),
  ('pwg9abe36eb978a4db163a005', 'KAIKEN ESTATE MALBEC', 'UND', '900001000630', true, now()),
  ('pwga277feeae06375a78efc07', 'CABERT PINOT GRIGIO', 'UND', '900001000015', true, now()),
  ('pwg4525d91923e42fb45c6245', 'LOUREIRO VINHO VERDE DOC BRANCO', 'UND', '900001000056', true, now()),
  ('pwg955162937e4c4ad1f0776e', 'TABALI PEDREGOSO GRAN RESERVA CABERNET SAUVIGNON', 'UND', '900001000869', true, now()),
  ('pwg0c956a24d951de8d92d223', 'VEZZI AMALTEIA BRUT ROSE', 'UND', '900001000344', true, now()),
  ('pwg8fd3680cf2f90c54c4b1fd', 'NORTON SELECT MALBEC', 'UND', '900001000703', true, now()),
  ('pwgfa0a9fa6a609ae7ce346c4', 'WG NEDERBURG ROSE', 'UND', '900001000220', true, now()),
  ('pwg822d5fdf1bc4eccb74cb8f', 'ZERO-G ZWEIGELT TINTO', 'UND', '900001000880', true, now()),
  ('pwge39525aa0508a66f187970', 'RICCITELLI THIS IS NOT ANOTHER LOVELY MALBEC', 'UND', '900001000748', true, now()),
  ('pwg68bd9a4cbe04e00834c07a', 'DOMAINE DE SAINT SER CUVEE TRADITION', 'UND', '900001000244', true, now()),
  ('pwgbc498c0945eb4e1a9b0a40', 'MONTGRAS DAY ONE GRAN RESERVA', 'UND', '900001000686', true, now()),
  ('pwg0a392fa2bc82cdea197ee3', 'ANTAWARA GRAN RESERVA', 'UND', '900001000523', true, now()),
  ('pwg3274c0ad677d6f79275c0c', 'DUE LUNE NERELLO MASCALESE NERO D''AVOLA IGT SICÍLI', 'UND', '900001000889', true, now()),
  ('pwg8acf815950ab56981ba89e', 'VINA ALBALI ROBLE TINTO', 'UND', '900001000884', true, now()),
  ('pwge94fdbe5f101e8cebed8a5', 'PACHA RESERVA CHARDONNAY', 'UND', '900001000100', true, now()),
  ('pwgca8d7341edd99aec9a0aeb', 'TABALI PEDREGOSO GRAN RESERVA PINOT NOIR TINTO WIN', 'UND', '900001000868', true, now()),
  ('pwg8d45fa67e19e1880bf1ccd', 'GARZON RESERVA TANNAT', 'UND', '900001000624', true, now()),
  ('pwg02009a1b456a4a46cb0bd0', 'AMALAYA BLANCO DE CORTE TORRONTES RIESLING', 'UND', '900001000196', true, now()),
  ('pwg0d39b126769b6cb65b2dc1', 'BASCO LOCO ALVARINHO BRANCO', 'UND', '900001000162', true, now()),
  ('pwg59981eeaa568d130bb7eba', 'ALFREDO ROCA PARCELAS ORIGINALES GLERA BRANCO', 'UND', '900001000161', true, now()),
  ('pwg21e1afeeca40132dbecb03', 'ALTA YARI MALBEC', 'UND', '900001000516', true, now()),
  ('pwgdfbd34b3be87dbb313025b', 'PIROVANO CONSTANTINO TINTO', 'UND', '900001000891', true, now()),
  ('pwgca553c4a3f7021e792f9fe', 'RIBEIRO SANTO RESERVA TINTO', 'UND', '900001000898', true, now()),
  ('pwga4a9a80d9f038085a9e86d', 'ADEGA DE MONCAO VINHO VERDE DOC', 'UND', '900001000001', true, now()),
  ('pwg79138bcec97fe64f48e5b7', 'KAIKEN INDOMITO TINTO', 'UND', '900001000879', true, now()),
  ('pwg0ac741f69a557524e8dc4d', 'CRIMSON RANCH C. SAUVIGNON CALIFORNIA TINTO', 'UND', '900001001308', true, now()),
  ('pwg0753b658ec68073feacb13', 'MARQUES DE TOMARES CRIANZA RIOJA DOC', 'UND', '900001000661', true, now()),
  ('pwg25886965ff3319010dacf7', 'WG BEAU ROCHER BRUT', 'UND', '900001000307', true, now()),
  ('pwgacc1319e8c498f2b995253', 'CASA PERINI VINTAGE BLANC DE NOIR BRUT', 'UND', '900001000311', true, now()),
  ('pwg073c32d2b5b0226a3bf806', 'HARAS DE PIRQUE ALBACLARA', 'UND', '900001000045', true, now()),
  ('pwg1cb66f14b23ec4c48caf8b', 'MARQUES DE BORBA VINHAS VELHAS DOC', 'UND', '900001000660', true, now()),
  ('pwgf6f2aa19de31a262b5cc65', 'MONTCHENOT GRAN RESERVA 10 ANOS', 'UND', '900001000679', true, now()),
  ('pwgaf8a98bfa1f99f5bc7cac5', 'LE PETIT MAYNNE PINOT NOIR TINTO', 'UND', '900001001305', true, now()),
  ('pwga3d5bdf487a16f5c0751d8', 'COLLEZIONE MONTEPULCIANO D ABRUZZO DOC TINTO', 'UND', '900001001302', true, now()),
  ('pwga7aaa5c548356baa92eb56', 'DUBORDIEU LIAISON TINTO', 'UND', '900001000873', true, now()),
  ('pwg97da0e28c06bb4e7f33c5d', 'ALBERT BICHOT COTEAUX BOURGUIGNONS TINTO', 'UND', '900001000885', true, now()),
  ('pwgb609077b6b2bb30e2d5544', 'PETIT MONTCHENOT RESERVA', 'UND', '900001000719', true, now()),
  ('pwg452aa2cabb65ba252b3597', 'CALABUGI ROSE MONASTRELL', 'UND', '900001000206', true, now()),
  ('pwge4742321efb4403e5e7c25', 'LOMBO SUINO - LONZA ROSSO MATTOS', 'KG', '100005019142', true, now()),
  ('pwg51370c5d58f644009905a9', 'CHIANTI MONTALBANO DOCG RISALTO TINTO', 'UND', '900001001301', true, now()),
  ('pwge695f1f868c89ad4acd8fa', 'CAVE GEISSE NATURE', 'UND', '900001000321', true, now()),
  ('pwg5b74749a226b0e2f814d97', 'VILLA ANTINORI BIANCO', 'UND', '900001000123', true, now()),
  ('pwga49d97cbfaa019c8b9572e', 'GARBO INQUIETO', 'UND', '900001000833', true, now()),
  ('pwg2c713d6bc23b21ae9f6c81', 'WG BELVINO GRILLO ROSE BRUT', 'UND', '900001000310', true, now()),
  ('pwgacdeb0d2ff2a93ba56a927', 'ALVORADA MALBEC', 'UND', '900001000517', true, now()),
  ('pwgc90164f9948fc68cc43da7', 'CAMIGLIANO ROSSO DI MONTALCINO', 'UND', '900001000549', true, now()),
  ('pwgb4cf7abadb24b0ebe21770', 'TRUFFLE HUNTER LEDA BIANCO DOC BRANCO', 'UND', '900001000166', true, now()),
  ('pwgdc73ab8c096406dc558be8', 'STEMMARI NERO D''AVOLA DOC SICILIA TINTO', 'UND', '900001000890', true, now()),
  ('pwg7476e31b890830680130a5', 'CAMASELLA APPASSIMENTO ROSSO TINTO', 'UND', '900001000888', true, now()),
  ('pwgadee20479fe56b7a0d7523', 'COLLEZIONE TREBBIANO IGT TOSCANA BRANCO', 'UND', '900001001599', true, now()),
  ('pwgbbf8121b6b87588fea2e18', 'VIDIGUEIRA VARIETAL ANTAO VAZ ALENTEJO DOC BRANCO', 'UND', '900001000168', true, now()),
  ('pwg74d72e7c561f99225c31dc', 'LOIOS BRANCO', 'UND', '900001001315', true, now()),
  ('pwg2e7457c2086d9164fccaeb', 'LOIOS TINTO', 'UND', '900001000647', true, now()),
  ('pwgca9d9a1dd42e3f6cae752d', 'SANTO CRISTO AMPHORA GARNACHA', 'UND', '900001000757', true, now()),
  ('pwg8ab612d42b68b0ba69d4a7', 'PIAN DELLE VIGNE ROSSO DI MONTALCINO', 'UND', '900001000722', true, now()),
  ('pwg4dc5de0a2ef3a5fada8085', 'LAPOSTOLLE APALTA', 'UND', '900001000637', true, now()),
  ('pwg7f6d1c78e2ebc1aa8c9c56', 'CALAFURIA ROSE IGT SALENTO', 'UND', '900001000208', true, now()),
  ('pwga02dfdc5c5f345fd72eedc', 'HERDADE PESO SOSSEGO TINTO', 'UND', '900001000899', true, now()),
  ('pwgc3b3ca8beafb0d37546406', 'MALACARA MALBEC', 'UND', '900001000652', true, now()),
  ('pwg09df6fd3c50e88a2b80f52', 'CROQUI CABERNET FRANC SYRAH', 'UND', '900001000596', true, now()),
  ('pwga6be90d7586b4f05d6ed6c', 'GARBO CHERRY BOMB PINOT NOIR CLARETE', 'UND', '900001001145', true, now()),
  ('pwgf1e2aa6449898133689d98', 'MONTCHENOT CHENIN BRANCO', 'UND', '900001000046', true, now()),
  ('pwg5a028c3a3c000e0b590e3f', 'SANTA CAROLINA EL PACTO A. N3 BLEND TINTO', 'UND', '900001000870', true, now()),
  ('pwg6dfd592877ffbf1ee8f954', 'CHATEAU REYNON SAUVIGNON BLANC', 'UND', '900001000029', true, now()),
  ('pwgec2594397b28b11611a4e6', 'RE MINOR TEMPRANILLO', 'UND', '900001000739', true, now()),
  ('pwg93485f598534f43711186d', 'BENEGAS ESTATE DIN TIBURCIO BLEND TINTO', 'UND', '900001000990', true, now()),
  ('pwge402709428e10434148977', 'ANSELMANN RIESLING TROCKEN BRANCO', 'UND', '900001000172', true, now()),
  ('pwg0db733707f39cfa402cb31', 'WG NEDERBURG PINOTAGE', 'UND', '900001000695', true, now()),
  ('pwgc255afc76d8c4526e7d89c', 'MARQUES DE TOMARES EXCELLENCE RIOJA DOC', 'UND', '900001000663', true, now()),
  ('pwg0ebd56cb6c723fb0bd4e94', 'BELLAVISTA CABERNET SAUVIGNON 3000ML', 'UND', '900001001310', true, now()),
  ('pwg263bd8dcb88677a10d2866', 'ALFREDO ROCA ALMA INQUIETA WHITE MALBEC BRANCO WIN', 'UND', '900001000159', true, now()),
  ('pwg6e156752ca23293d306ab5', 'CALITERRA TRIBUTO GRAN RESERVA MALBEC TINTO', 'UND', '900001000800', true, now()),
  ('pwgecfcda8aea5bbadb219579', 'JEREZ REAL TESORO FINO', 'UND', '900001000411', true, now()),
  ('pwgc51f53f0dbcd35e16e0801', 'VIDIGUEIRA PREMIUM ALENTEJO DOC TINTO', 'UND', '900001001314', true, now()),
  ('pwg62fdc9df20f4c07b8c09ac', 'VINHO TINTO SAINT GERMAIN 750ML', 'LT', '105040008616', true, now()),
  ('pwge6c7f3ae4ba96db55c3b90', 'CASA SILVA VIOGNIER RESERVA BRANCO', 'UND', '900001000173', true, now()),
  ('pwg32820d1a42f071ca0f6c3d', 'WG BEAU ROCHER BRUT ROSE', 'UND', '900001000308', true, now()),
  ('pwgd885b8b5be2f451ab4e3f8', 'LE CLOS DE REYNON', 'UND', '900001000638', true, now()),
  ('pwg798585864d7d783b3e6e4f', 'YSERN RESERVA TINTO', 'UND', '900001000893', true, now()),
  ('pwg92441d010d1b7edceebdfe', 'CHATEAU ST. THOMAS LES EMIRS WINW', 'UND', '900001000579', true, now()),
  ('pwgd9198af516f9c34b4d0fb7', 'RIBEIRO SANTO RESERVA BRANCO', 'UND', '900001000746', true, now()),
  ('pwg8bffc84dc2d6b343997591', 'JAJA DE SAUVIGNON BLANC', 'UND', '900001000047', true, now()),
  ('pwg7c2bbf66b8b6629ce5aff6', 'BRUTAL FRUIT SPRITZER RUBY APPLE', 'UND', '900100009135', true, now())
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- PASSO 2 — Gravar o código nos 29 produtos que já existiam.
--
-- Só onde o código ainda é nulo. Produto que já declara um código não é
-- sobrescrito: dois códigos para o mesmo item é decisão de gente, e a
-- conferência recusa a linha antes de chegar aqui.
-- ---------------------------------------------------------------------------
UPDATE "Produto" p SET "codigoTeknisa" = v.codigo
FROM (VALUES
  ('cmtc03t3u00mucwgtdph8t0lm', '900001000167'),
  ('cmtc03t4d00n6cwgtvaw2e9us', '900001000216'),
  ('cmtc03t4000mycwgtentzn5q8', '900001000171'),
  ('cmtc03t4500n1cwgtfhb2yuhu', '900001000032'),
  ('cmtc03t3x00mwcwgtpf7hp4v2', '900001000036'),
  ('cmtc03t4400n0cwgtbkllha09', '900001000021'),
  ('cmtc03t5t00o0cwgt435pwcue', '900001000759'),
  ('cmtc03t4q00necwgtf7b16mxi', '900001000871'),
  ('cmtc03t4n00nccwgtnuy119se', '900001001307'),
  ('cmtc03t4200mzcwgt9j6rrpph', '900001000170'),
  ('cmtc03t5100nlcwgtf0nsx1s8', '900001000876'),
  ('cmtc03t4b00n4cwgt43x56vvk', '900001000128'),
  ('cmtc03t5j00nucwgt3nf6mjpb', '900001000754'),
  ('cmtc03t4f00n7cwgt9ou7qb9o', '900001000242'),
  ('cmtc03t3w00mvcwgth63q29os', '900001000024'),
  ('cmtc03t3s00mscwgtl8bxn85p', '900001000360'),
  ('cmtc03t4c00n5cwgt82dhwq3g', '900001000070'),
  ('cmtc03t5r00nzcwgtf5rlxq4f', '900001000578'),
  ('cmtc03t4i00n9cwgtgi78xmbj', '900001000214'),
  ('cmtc03t4700n2cwgtch0inn1z', '900001000051'),
  ('cmtc03sia008pcwgtcvos228i', '400000000136'),
  ('cmtc03sad003acwgto3moai0o', '110015009103'),
  ('cmtc03ss800f4cwgtdv82fxez', '600005000500'),
  ('cmtc03t1y00lkcwgtib0b2x8j', '110025008603'),
  ('cmtc03t3400mdcwgtgk9k8d4h', '110025008611'),
  ('cmtc03su900ggcwgtqdmvrca3', '105015009101'),
  ('cmtc03sul00gocwgtifw3eukp', '105030005601'),
  ('cmtc03t0400kdcwgticr03avr', '110000020651'),
  ('cmtc03slw00b3cwgtkx5fq0ng', '105000052706')
) AS v(id, codigo)
WHERE p.id = v.id AND p."codigoTeknisa" IS NULL;

-- ---------------------------------------------------------------------------
-- PASSO 3 — Religar as linhas de compra que ficaram sem produto.
--
-- Criar o produto não faz a compra velha casar sozinha. As linhas já estão
-- em ItemNotaCompra com produtoId nulo, e a chave de idempotência impede
-- recarregar o workflow pra refazer o casamento. Sem este passo os vinhos
-- teriam ficha e custo ZERO.
--
-- Casa por codigoBruto, que é o código exato que veio na nota.
-- ---------------------------------------------------------------------------
UPDATE "ItemNotaCompra" i SET "produtoId" = p.id
FROM "Produto" p
WHERE i."produtoId" IS NULL
  AND i."codigoBruto" = p."codigoTeknisa"
  AND p."codigoTeknisa" IN ('900001000109', '900001000630', '900001000015', '900001000056', '900001000869', '900001000344', '900001000703', '900001000220', '900001000880', '900001000748', '900001000244', '900001000686', '900001000523', '900001000889', '900001000884', '900001000167', '900001000216', '900001000100', '900001000868', '900001000171', '900001000624', '900001000196', '900001000162', '900001000032', '900001000161', '900001000516', '900001000036', '900001000891', '900001000021', '900001000898', '900001000001', '900001000879', '900001000759', '900001001308', '900001000661', '900001000307', '900001000311', '900001000045', '900001000660', '900001000679', '900001001305', '900001001302', '900001000871', '900001001307', '900001000873', '900001000885', '900001000719', '900001000206', '900001000170', '100005019142', '900001001301', '900001000321', '900001000123', '900001000833', '900001000310', '900001000517', '900001000876', '900001000128', '900001000549', '900001000166', '900001000890', '900001000754', '900001000888', '900001000242', '900001001599', '900001000168', '900001001315', '900001000647', '900001000757', '900001000722', '900001000024', '900001000637', '900001000208', '900001000899', '900001000360', '900001000652', '900001000070', '900001000596', '900001001145', '900001000046', '900001000870', '900001000029', '900001000739', '900001000990', '900001000578', '900001000172', '900001000695', '900001000663', '900001001310', '900001000159', '900001000800', '900001000214', '900001000411', '900001001314', '105040008616', '900001000173', '900001000308', '900001000051', '900001000638', '900001000893', '900001000579', '900001000746', '900001000047', '900100009135', '400000000136', '110015009103', '600005000500', '110025008603', '110025008611', '105015009101', '105030005601', '110000020651', '105000052706');

-- ---------------------------------------------------------------------------
-- PASSO 4 — Preço atual e histórico, da compra MAIS RECENTE de cada produto.
--
-- Sai do próprio ItemNotaCompra religado no passo 3, não da planilha: o
-- preço tem que ser o que a nota disse, não uma média que eu calculei.
-- ---------------------------------------------------------------------------
WITH despensa AS (
  SELECT COALESCE(u."estoqueEmId", u.id) AS id FROM "Unidade" u WHERE u.nome = 'Wine Garden'
), ultima AS (
  SELECT DISTINCT ON (i."produtoId")
         i."produtoId", i."precoUnitNovo" AS preco, i."dataCompra"
  FROM "ItemNotaCompra" i
  JOIN "NotaCompra" n ON n.id = i."notaCompraId"
  JOIN despensa d ON d.id = n."unidadeId"
  JOIN "Produto" p ON p.id = i."produtoId"
  WHERE p."codigoTeknisa" IN ('900001000109', '900001000630', '900001000015', '900001000056', '900001000869', '900001000344', '900001000703', '900001000220', '900001000880', '900001000748', '900001000244', '900001000686', '900001000523', '900001000889', '900001000884', '900001000167', '900001000216', '900001000100', '900001000868', '900001000171', '900001000624', '900001000196', '900001000162', '900001000032', '900001000161', '900001000516', '900001000036', '900001000891', '900001000021', '900001000898', '900001000001', '900001000879', '900001000759', '900001001308', '900001000661', '900001000307', '900001000311', '900001000045', '900001000660', '900001000679', '900001001305', '900001001302', '900001000871', '900001001307', '900001000873', '900001000885', '900001000719', '900001000206', '900001000170', '100005019142', '900001001301', '900001000321', '900001000123', '900001000833', '900001000310', '900001000517', '900001000876', '900001000128', '900001000549', '900001000166', '900001000890', '900001000754', '900001000888', '900001000242', '900001001599', '900001000168', '900001001315', '900001000647', '900001000757', '900001000722', '900001000024', '900001000637', '900001000208', '900001000899', '900001000360', '900001000652', '900001000070', '900001000596', '900001001145', '900001000046', '900001000870', '900001000029', '900001000739', '900001000990', '900001000578', '900001000172', '900001000695', '900001000663', '900001001310', '900001000159', '900001000800', '900001000214', '900001000411', '900001001314', '105040008616', '900001000173', '900001000308', '900001000051', '900001000638', '900001000893', '900001000579', '900001000746', '900001000047', '900100009135', '400000000136', '110015009103', '600005000500', '110025008603', '110025008611', '105015009101', '105030005601', '110000020651', '105000052706')
    AND i."precoUnitNovo" > 0
  ORDER BY i."produtoId", i."dataCompra" DESC, i.id
)
INSERT INTO "PrecoAtualProduto" (id, "unidadeId", "produtoId", preco, "dataCompra", "atualizadoEm")
SELECT 'prwg' || left(md5(d.id || u."produtoId"), 21), d.id, u."produtoId", u.preco, u."dataCompra", now()
FROM ultima u CROSS JOIN despensa d
ON CONFLICT ("unidadeId", "produtoId") DO UPDATE
  SET preco = EXCLUDED.preco, "dataCompra" = EXCLUDED."dataCompra", "atualizadoEm" = now();

-- O histórico, para o relatório de variação de preço.
WITH despensa AS (
  SELECT COALESCE(u."estoqueEmId", u.id) AS id FROM "Unidade" u WHERE u.nome = 'Wine Garden'
)
INSERT INTO "HistoricoPrecoProduto" (id, "unidadeId", "produtoId", preco, origem, "origemId", "dataCompra", "criadoEm")
SELECT 'hvwg' || left(md5(pa."produtoId"), 21), pa."unidadeId", pa."produtoId", pa.preco,
       'NOTA_COMPRA', 'pareamento-vinhos-wine-garden', pa."dataCompra", now()
FROM "PrecoAtualProduto" pa JOIN despensa d ON d.id = pa."unidadeId"
JOIN "Produto" p ON p.id = pa."produtoId"
WHERE p."codigoTeknisa" IN ('900001000109', '900001000630', '900001000015', '900001000056', '900001000869', '900001000344', '900001000703', '900001000220', '900001000880', '900001000748', '900001000244', '900001000686', '900001000523', '900001000889', '900001000884', '900001000167', '900001000216', '900001000100', '900001000868', '900001000171', '900001000624', '900001000196', '900001000162', '900001000032', '900001000161', '900001000516', '900001000036', '900001000891', '900001000021', '900001000898', '900001000001', '900001000879', '900001000759', '900001001308', '900001000661', '900001000307', '900001000311', '900001000045', '900001000660', '900001000679', '900001001305', '900001001302', '900001000871', '900001001307', '900001000873', '900001000885', '900001000719', '900001000206', '900001000170', '100005019142', '900001001301', '900001000321', '900001000123', '900001000833', '900001000310', '900001000517', '900001000876', '900001000128', '900001000549', '900001000166', '900001000890', '900001000754', '900001000888', '900001000242', '900001001599', '900001000168', '900001001315', '900001000647', '900001000757', '900001000722', '900001000024', '900001000637', '900001000208', '900001000899', '900001000360', '900001000652', '900001000070', '900001000596', '900001001145', '900001000046', '900001000870', '900001000029', '900001000739', '900001000990', '900001000578', '900001000172', '900001000695', '900001000663', '900001001310', '900001000159', '900001000800', '900001000214', '900001000411', '900001001314', '105040008616', '900001000173', '900001000308', '900001000051', '900001000638', '900001000893', '900001000579', '900001000746', '900001000047', '900100009135', '400000000136', '110015009103', '600005000500', '110025008603', '110025008611', '105015009101', '105030005601', '110000020651', '105000052706')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- PASSO 5 — As 57 receitas, para 59 itens de venda.
--
-- Uma receita por (produto, quantidade), não por item de venda: "Receita"
-- tem UNIQUE (unidadeId, nome), e o mesmo vinho vendido como taça e como
-- garrafa gera dois itens de venda de nome idêntico. Sem isto, uma das duas
-- receitas some no ON CONFLICT e o ingrediente dela quebra na FK — foi o que
-- aconteceu ao rodar a primeira versão deste SQL contra o schema de verdade.
-- Quando o mesmo vinho tem dois formatos, o nome ganha o sufixo; vendas
-- idênticas dividem a mesma receita.
--
-- rendimentoQtd fica NULO de propósito: sem rendimento, explodirReceitaPura
-- trata a receita como 1 unidade e o custo é quantidade x preço — que é
-- exatamente o que se quer aqui (ver src/lib/receita.ts:78).
-- ---------------------------------------------------------------------------
WITH casa AS (SELECT id FROM "Unidade" WHERE nome = 'Wine Garden')
INSERT INTO "Receita" (id, "unidadeId", nome, "criadoEm", "atualizadoEm")
SELECT v.id, casa.id, v.nome, now(), now() FROM (VALUES
  ('rwg597cf22df4b6199cc4c791', 'Tabalí Pedregoso Gran Reserva Chardonnay'),
  ('rwg99c5fb857e45ac3a0d2ccb', 'Kaiken Estate Malbec'),
  ('rwgfa15c18fb900734f14ecaf', 'Cabert Pinot Grigio'),
  ('rwg13519c905e6dede679b2f6', 'Loureiro Vinho Verde DOC'),
  ('rwga0dd3a4d3388f69c30b654', 'Tabalí Pedregoso Gran Reserva Cabernet Sauvignon'),
  ('rwg03ecb8eca14e55175c9eed', 'Vezzi Amalteia Brut Rose'),
  ('rwga949fc80966dd41abcf6ac', 'Norton Select Malbec'),
  ('rwg9e336b7863b160b9fa401b', 'Nederburg Rosé'),
  ('rwg41bb10215c7776524d0985', 'Zero-G Zweigelt'),
  ('rwg3dfe245398d095a60b61d8', 'Riccitelli This Is Not Another Lovely Malbec'),
  ('rwg5a83aaef0b4f3a3472e063', 'Pacha Reserva Chardonnay'),
  ('rwgc599661fdb91fd6c6c2896', 'Tabali Pedregoso Gran Reserva Pinot Noir'),
  ('rwg29cb7d3e9bcd5b90c5169e', 'Garzon Reserva Tannat'),
  ('rwge9fe8283083085a7e9af9a', 'Amalaya Blanco de Corte Torrontés Riesling'),
  ('rwgbcfa7b9980484c3781ea6d', 'Basco Loco Alvarinho'),
  ('rwg4364f83f90a28f1e2cb42f', 'Alfredo Roca Parcelas Originales Glera'),
  ('rwgc1befb5226dc166b82cfbf', 'Alta Yari Malbec'),
  ('rwg1b46edc54720073059244b', 'Ribeiro Santo Reserva'),
  ('rwg08e9867f300407a87ade17', 'Adega de Monção Vinho Verde DOC'),
  ('rwgd7d2ad1d2b7160cc0b3522', 'Marqués de Tomares Crianza Rioja DOCa'),
  ('rwg8656beb82099040fc6532d', 'Beau Rocher Brut'),
  ('rwg81a348a6852a5eead8300a', 'Casa Perini Vintage Blanc de Noir Brut'),
  ('rwgec845b7e3e37931f4dd0e7', 'Haras de Pirque Albaclara'),
  ('rwg5838b7260ec1d9f7e2ba3b', 'Collezione Montepulciano d''Abruzzo DOC'),
  ('rwg3c5acbf850d99a5679cbd0', 'Dubordieu Liaison (garrafa)'),
  ('rwgffb27ba23d8f8c94c9a560', 'Dubordieu Liaison (taça)'),
  ('rwgeeaaf8c3c71e3db6ec9033', 'Albert Bichot Coteaux Bourguignons'),
  ('rwg6225e8a1e384aca17708e9', 'Calabuig Rosé Monastrell'),
  ('rwgeadd9544203c2a958fc58c', 'Chianti Montalbano DOCG Risalto'),
  ('rwgd2c61d602e17d661e5ead6', 'Cave Geisse Nature'),
  ('rwga4b40011ccf658b844acbc', 'Villa Antinori Bianco'),
  ('rwgcee13e4644db28721fef34', 'Garbo Inquieto'),
  ('rwgc8c952c718fe2f7622719f', 'Belvino Rosé Brut'),
  ('rwgd7a2e89617d306481e0697', 'Alvorada Malbec'),
  ('rwg31e93296a54d694fd9f4c9', 'Camigliano Rosso di Montalcino DOC'),
  ('rwg696a606488792e2e882592', 'Truffle Hunter Leda Bianco DOC (taça)'),
  ('rwg8665f642f72e4d204a50b0', 'Truffle Hunter Leda Bianco DOC (garrafa)'),
  ('rwg604cdeb2318bbc76ec2104', 'Stemmari Nero d''Avola DOC Sicilia'),
  ('rwgcc95f6228ca42998fea696', 'Camasella Appassimento Rosso'),
  ('rwge7ac58dacae5bf5b98d049', 'Collezione Trebbiano IGT Toscana'),
  ('rwgdfc3da5191747f604d4fb6', 'Vidigueira Premium Antão Vaz Alentejo DOC'),
  ('rwgdeb0e344b98485e9de6f10', 'Santo Cristo Amphora Garnacha'),
  ('rwga0f883e9188329bcc39d7b', 'Pian delle Vigne Rosso di Montalcino DOC'),
  ('rwgbfe48e0b49d5f8d30211ce', 'Lapostolle Apalta'),
  ('rwg011827b6a3436e8ec52c23', 'Calafuria Rosé IGT Salento'),
  ('rwgf9508b0d87a24d03bf99ec', 'Herdade do Peso Sossego'),
  ('rwg47c834805d86e585bd011f', 'Croqui Cabernet Franc - Syrah'),
  ('rwg7eff979561f2287aebfacc', 'Garbo Cherry Bomb Pinot Noir Clarete'),
  ('rwg2bf5a0aa88075feccc8038', 'Montchenot Chenin Blanc'),
  ('rwgc6f688f1f4535c51d976f7', 'Château Reynon Sauvignon Blanc'),
  ('rwg67983e7ec1e9e2dc0a8362', 'Benegas Estate Don Tiburcio Blend'),
  ('rwg4dd630fd5fc6b2c5809724', 'Anselmann Riesling Trocken'),
  ('rwga97fedf321c44d083ef17e', 'Marques de Tomares Excellence Rioja DOC'),
  ('rwgdc5448f3a74dad075a4735', 'Casa Silva Viognier Reserva'),
  ('rwg1ad177af21946e61f4252a', 'Le Clos de Reynon'),
  ('rwg94872c3fc449bcf50d6bec', 'Ysern Reserva'),
  ('rwg99a0cecbc758b3c1c15436', 'Le Jaja de Jau Sauvignon Blanc')
) AS v(id, nome) CROSS JOIN casa
ON CONFLICT DO NOTHING;

INSERT INTO "IngredienteReceita" (id, "receitaId", "produtoId", quantidade, "unidadeMedida")
VALUES
  ('iwge28d7b92dbbd6cdceb4bda', 'rwg597cf22df4b6199cc4c791', 'pwg1ac3e83366a5f8bde71255', 0.2, 'UND'),
  ('iwg5eefb547c4cca460764216', 'rwg99c5fb857e45ac3a0d2ccb', 'pwg9abe36eb978a4db163a005', 1, 'UND'),
  ('iwg856919ba84da3ccc01be61', 'rwgfa15c18fb900734f14ecaf', 'pwga277feeae06375a78efc07', 1, 'UND'),
  ('iwgee5f46f533525b62ce9b25', 'rwg13519c905e6dede679b2f6', 'pwg4525d91923e42fb45c6245', 1, 'UND'),
  ('iwgfe7090170290ce1e711027', 'rwga0dd3a4d3388f69c30b654', 'pwg955162937e4c4ad1f0776e', 0.2, 'UND'),
  ('iwg68bfafe14035bcbbd67d22', 'rwg03ecb8eca14e55175c9eed', 'pwg0c956a24d951de8d92d223', 1, 'UND'),
  ('iwg688adf40cf92033f339336', 'rwga949fc80966dd41abcf6ac', 'pwg8fd3680cf2f90c54c4b1fd', 1, 'UND'),
  ('iwg75c826747aee6193eaac1a', 'rwg9e336b7863b160b9fa401b', 'pwgfa0a9fa6a609ae7ce346c4', 0.2, 'UND'),
  ('iwg9a8fc9a3864830b5b02805', 'rwg41bb10215c7776524d0985', 'pwg822d5fdf1bc4eccb74cb8f', 0.2, 'UND'),
  ('iwgfd97a851e73bee896b6531', 'rwg3dfe245398d095a60b61d8', 'pwge39525aa0508a66f187970', 1, 'UND'),
  ('iwgc93db4d24f9912987eceaa', 'rwg5a83aaef0b4f3a3472e063', 'pwge94fdbe5f101e8cebed8a5', 1, 'UND'),
  ('iwge614cc708dd3e1cd169a2d', 'rwgc599661fdb91fd6c6c2896', 'pwgca8d7341edd99aec9a0aeb', 1, 'UND'),
  ('iwgca425906b2a4be2caf5fa7', 'rwg29cb7d3e9bcd5b90c5169e', 'pwg8d45fa67e19e1880bf1ccd', 0.2, 'UND'),
  ('iwg8a4f95d8a63424896948be', 'rwge9fe8283083085a7e9af9a', 'pwg02009a1b456a4a46cb0bd0', 1, 'UND'),
  ('iwg06bfb6d495f92a7de3d185', 'rwgbcfa7b9980484c3781ea6d', 'pwg0d39b126769b6cb65b2dc1', 1, 'UND'),
  ('iwgba6a9cb3e0d9e0e84a8ede', 'rwg4364f83f90a28f1e2cb42f', 'pwg59981eeaa568d130bb7eba', 1, 'UND'),
  ('iwg395549f9642576ee3238cf', 'rwgc1befb5226dc166b82cfbf', 'pwg21e1afeeca40132dbecb03', 1, 'UND'),
  ('iwg99236ae508c3e223177670', 'rwg1b46edc54720073059244b', 'pwgca553c4a3f7021e792f9fe', 0.2, 'UND'),
  ('iwg404e664a7b1c13ebf7cd2f', 'rwg08e9867f300407a87ade17', 'pwga4a9a80d9f038085a9e86d', 1, 'UND'),
  ('iwg3fa429fd32f1203585d8b1', 'rwgd7d2ad1d2b7160cc0b3522', 'pwg0753b658ec68073feacb13', 0.2, 'UND'),
  ('iwg6563c01e2cb298026cba57', 'rwg8656beb82099040fc6532d', 'pwg25886965ff3319010dacf7', 1, 'UND'),
  ('iwg2e5286c0d47734da0cb136', 'rwg81a348a6852a5eead8300a', 'pwgacc1319e8c498f2b995253', 1, 'UND'),
  ('iwg17324a564a5c63c1137aee', 'rwgec845b7e3e37931f4dd0e7', 'pwg073c32d2b5b0226a3bf806', 1, 'UND'),
  ('iwg09dbfef590faee202ea794', 'rwg5838b7260ec1d9f7e2ba3b', 'pwga3d5bdf487a16f5c0751d8', 1, 'UND'),
  ('iwga9e94517fa8478492edf9a', 'rwg3c5acbf850d99a5679cbd0', 'pwga7aaa5c548356baa92eb56', 1, 'UND'),
  ('iwgabffe9a2c123f79761af4b', 'rwgffb27ba23d8f8c94c9a560', 'pwga7aaa5c548356baa92eb56', 0.2, 'UND'),
  ('iwg4213abda7045174974d6f3', 'rwgeeaaf8c3c71e3db6ec9033', 'pwg97da0e28c06bb4e7f33c5d', 1, 'UND'),
  ('iwg439bed1ed40fb919e1d9e5', 'rwg6225e8a1e384aca17708e9', 'pwg452aa2cabb65ba252b3597', 1, 'UND'),
  ('iwgaeafea2ba836515e873f0d', 'rwgeadd9544203c2a958fc58c', 'pwg51370c5d58f644009905a9', 1, 'UND'),
  ('iwgb310aaab008e1f25a17bc3', 'rwgd2c61d602e17d661e5ead6', 'pwge695f1f868c89ad4acd8fa', 1, 'UND'),
  ('iwg2c868175fdbecca20bec01', 'rwga4b40011ccf658b844acbc', 'pwg5b74749a226b0e2f814d97', 1, 'UND'),
  ('iwg6c2cccb5b4c42bec4ab699', 'rwgcee13e4644db28721fef34', 'pwga49d97cbfaa019c8b9572e', 1, 'UND'),
  ('iwg06d68d5707b6433bcb748c', 'rwgc8c952c718fe2f7622719f', 'pwg2c713d6bc23b21ae9f6c81', 1, 'UND'),
  ('iwg669fa3859fb801699c623e', 'rwgd7a2e89617d306481e0697', 'pwgacdeb0d2ff2a93ba56a927', 1, 'UND'),
  ('iwg6c6cb4bc3eb93a8ae511f5', 'rwg31e93296a54d694fd9f4c9', 'pwgc90164f9948fc68cc43da7', 0.2, 'UND'),
  ('iwgb19b07a422962a42f3800c', 'rwg696a606488792e2e882592', 'pwgb4cf7abadb24b0ebe21770', 0.2, 'UND'),
  ('iwg0aea942c309ae10c12c7df', 'rwg8665f642f72e4d204a50b0', 'pwgb4cf7abadb24b0ebe21770', 1, 'UND'),
  ('iwgb3519cb54fc5d3d59bb1b7', 'rwg604cdeb2318bbc76ec2104', 'pwgdc73ab8c096406dc558be8', 1, 'UND'),
  ('iwg541cbccc1e3d85a0a8ccb7', 'rwgcc95f6228ca42998fea696', 'pwg7476e31b890830680130a5', 1, 'UND'),
  ('iwgdf1df0c591f4281bd9e8f9', 'rwge7ac58dacae5bf5b98d049', 'pwgadee20479fe56b7a0d7523', 1, 'UND'),
  ('iwgbf6e4c6979d4a0461b6ca8', 'rwgdfc3da5191747f604d4fb6', 'pwgbbf8121b6b87588fea2e18', 1, 'UND'),
  ('iwgc90f284caf0bf94c294964', 'rwgdeb0e344b98485e9de6f10', 'pwgca9d9a1dd42e3f6cae752d', 1, 'UND'),
  ('iwg94daf4daa4c803d9baec0e', 'rwga0f883e9188329bcc39d7b', 'pwg8ab612d42b68b0ba69d4a7', 1, 'UND'),
  ('iwga59de90624b642b22fa8f7', 'rwgbfe48e0b49d5f8d30211ce', 'pwg4dc5de0a2ef3a5fada8085', 1, 'UND'),
  ('iwg4c475f8888d4958977aa94', 'rwg011827b6a3436e8ec52c23', 'pwg7f6d1c78e2ebc1aa8c9c56', 1, 'UND'),
  ('iwgece3a301388c94fdbc687b', 'rwgf9508b0d87a24d03bf99ec', 'pwga02dfdc5c5f345fd72eedc', 1, 'UND'),
  ('iwg5ca46b3e6960cf397777b2', 'rwg47c834805d86e585bd011f', 'pwg09df6fd3c50e88a2b80f52', 0.2, 'UND'),
  ('iwg8cdb97fa82b392db07476b', 'rwg7eff979561f2287aebfacc', 'pwga6be90d7586b4f05d6ed6c', 0.2, 'UND'),
  ('iwgdf7c81270202763730c746', 'rwg2bf5a0aa88075feccc8038', 'pwgf1e2aa6449898133689d98', 1, 'UND'),
  ('iwg348b96825db6a174763262', 'rwgc6f688f1f4535c51d976f7', 'pwg6dfd592877ffbf1ee8f954', 1, 'UND'),
  ('iwga2ee4760ff98b8fb2aac6c', 'rwg67983e7ec1e9e2dc0a8362', 'pwg93485f598534f43711186d', 1, 'UND'),
  ('iwgab50c2f89b1d6cacf4ffbb', 'rwg4dd630fd5fc6b2c5809724', 'pwge402709428e10434148977', 1, 'UND'),
  ('iwg28deb72973ca0d0b3be005', 'rwga97fedf321c44d083ef17e', 'pwgc255afc76d8c4526e7d89c', 0.2, 'UND'),
  ('iwg305db7c748eecc020da477', 'rwgdc5448f3a74dad075a4735', 'pwge6c7f3ae4ba96db55c3b90', 1, 'UND'),
  ('iwge2403bcc38468c085a4f36', 'rwg1ad177af21946e61f4252a', 'pwgd885b8b5be2f451ab4e3f8', 1, 'UND'),
  ('iwgd5a804141ba316065d64b9', 'rwg94872c3fc449bcf50d6bec', 'pwg798585864d7d783b3e6e4f', 1, 'UND'),
  ('iwg246ef31a60dfcbb36fb527', 'rwg99a0cecbc758b3c1c15436', 'pwg8bffc84dc2d6b343997591', 1, 'UND')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- PASSO 6 — Amarrar os 59 itens de venda nas suas receitas.
--
-- Só onde ainda não há ficha. Ficha existente nunca é sobrescrita.
-- ---------------------------------------------------------------------------
UPDATE "ItemVenda" iv SET "receitaId" = v."receitaId", "atualizadoEm" = now()
FROM (VALUES
  ('cmtc043vt0ft5cwgte1y6s8o4', 'rwg597cf22df4b6199cc4c791'),
  ('cmtc043we0fu5cwgtq7eg0rc5', 'rwg99c5fb857e45ac3a0d2ccb'),
  ('cmtc043vd0fsfcwgt9pl3tu3i', 'rwgfa15c18fb900734f14ecaf'),
  ('cmtc043v20frxcwgtwq8j7aa5', 'rwg13519c905e6dede679b2f6'),
  ('cmtc043xh0fvtcwgtwvco7bce', 'rwga0dd3a4d3388f69c30b654'),
  ('cmtc043us0frhcwgt5q03z6nk', 'rwg03ecb8eca14e55175c9eed'),
  ('cmtc043wd0fu3cwgtp3tvujda', 'rwga949fc80966dd41abcf6ac'),
  ('cmtc043vz0ftfcwgtsyvfle8b', 'rwg9e336b7863b160b9fa401b'),
  ('cmtc043w80ftvcwgtidh90ak2', 'rwg41bb10215c7776524d0985'),
  ('cmtc043wx0fuxcwgt7270bb2o', 'rwg3dfe245398d095a60b61d8'),
  ('cmtc043v60fs3cwgt36cmc3p2', 'rwg5a83aaef0b4f3a3472e063'),
  ('cmtc043w60ftrcwgt8h7if9z1', 'rwgc599661fdb91fd6c6c2896'),
  ('cmtc043xn0fw3cwgtaozf10u0', 'rwg29cb7d3e9bcd5b90c5169e'),
  ('cmtc043vk0fsrcwgtp72swkgj', 'rwge9fe8283083085a7e9af9a'),
  ('cmtc043va0fsbcwgt7vy2p0aw', 'rwgbcfa7b9980484c3781ea6d'),
  ('cmtc043v80fs7cwgt3ic27jn2', 'rwg4364f83f90a28f1e2cb42f'),
  ('cmtc043wl0fuhcwgto839tw7a', 'rwgc1befb5226dc166b82cfbf'),
  ('cmtc043vv0ft9cwgtktafvpi1', 'rwg1b46edc54720073059244b'),
  ('cmtc043xj0fvxcwgtm0zn2ud7', 'rwg1b46edc54720073059244b'),
  ('cmtc043v30frzcwgtzqf14n2n', 'rwg08e9867f300407a87ade17'),
  ('cmtc043x20fv5cwgtr4v9xz9n', 'rwgd7d2ad1d2b7160cc0b3522'),
  ('cmtc043ur0frfcwgtdswmvsh2', 'rwg8656beb82099040fc6532d'),
  ('cmtc043uw0frncwgtmtardatr', 'rwg81a348a6852a5eead8300a'),
  ('cmtc043vl0fstcwgtgnkopg2e', 'rwgec845b7e3e37931f4dd0e7'),
  ('cmtc043wa0ftzcwgt6likf5tj', 'rwg5838b7260ec1d9f7e2ba3b'),
  ('cmtc043vi0fsncwgtbciqjrz8', 'rwg3c5acbf850d99a5679cbd0'),
  ('cmtc043xa0fvjcwgt1lcnv1a7', 'rwgffb27ba23d8f8c94c9a560'),
  ('cmtc043w90ftxcwgtirkowo47', 'rwgeeaaf8c3c71e3db6ec9033'),
  ('cmtc043vx0ftdcwgtjqbf50ev', 'rwg6225e8a1e384aca17708e9'),
  ('cmtc043wk0fufcwgt0x21lm3k', 'rwgeadd9544203c2a958fc58c'),
  ('cmtc043uy0frrcwgtapjgpzc9', 'rwgd2c61d602e17d661e5ead6'),
  ('cmtc043ve0fshcwgtlepw0lg8', 'rwga4b40011ccf658b844acbc'),
  ('cmtc043w70fttcwgtmfjiyx02', 'rwgcee13e4644db28721fef34'),
  ('cmtc043ut0frjcwgt6xh9sb5q', 'rwgc8c952c718fe2f7622719f'),
  ('cmtc043x30fv7cwgt571h9g8n', 'rwgd7a2e89617d306481e0697'),
  ('cmtc043xe0fvpcwgtbfxs064r', 'rwg31e93296a54d694fd9f4c9'),
  ('cmtc043xy0fwlcwgtxtg003gp', 'rwg696a606488792e2e882592'),
  ('cmtc043v70fs5cwgtz37eloij', 'rwg8665f642f72e4d204a50b0'),
  ('cmtc043wh0fubcwgt65rts1vz', 'rwg604cdeb2318bbc76ec2104'),
  ('cmtc043xq0fw9cwgts2pvkqxd', 'rwgcc95f6228ca42998fea696'),
  ('cmtc043vj0fspcwgtderszjme', 'rwge7ac58dacae5bf5b98d049'),
  ('cmtc043vr0ft3cwgti2yxfglu', 'rwgdfc3da5191747f604d4fb6'),
  ('cmtc043wf0fu7cwgtexniw68m', 'rwgdeb0e344b98485e9de6f10'),
  ('cmtc043xf0fvrcwgtutgeh4g3', 'rwga0f883e9188329bcc39d7b'),
  ('cmtc043xo0fw5cwgt624um6nu', 'rwgbfe48e0b49d5f8d30211ce'),
  ('cmtc043w20ftlcwgtdrz6fe2q', 'rwg011827b6a3436e8ec52c23'),
  ('cmtc043wn0fulcwgtt2818p6s', 'rwgf9508b0d87a24d03bf99ec'),
  ('cmtc043vc0fsdcwgtjxfqr4m2', 'rwgf9508b0d87a24d03bf99ec'),
  ('cmtc043wm0fujcwgt3c6plahi', 'rwg47c834805d86e585bd011f'),
  ('cmtc043w40ftpcwgt2ep4zdg0', 'rwg7eff979561f2287aebfacc'),
  ('cmtc043vu0ft7cwgtwahzrb2p', 'rwg2bf5a0aa88075feccc8038'),
  ('cmtc043vq0ft1cwgtgtwgvt63', 'rwgc6f688f1f4535c51d976f7'),
  ('cmtc043wr0furcwgt9v3gyf2n', 'rwg67983e7ec1e9e2dc0a8362'),
  ('cmtc043vp0fszcwgt0y4mgsk7', 'rwg4dd630fd5fc6b2c5809724'),
  ('cmtc043wp0funcwgtcdk5a4r3', 'rwga97fedf321c44d083ef17e'),
  ('cmtc043vo0fsxcwgto52bxxe3', 'rwgdc5448f3a74dad075a4735'),
  ('cmtc043x70fvdcwgtadew1yur', 'rwg1ad177af21946e61f4252a'),
  ('cmtc043xi0fvvcwgt0ut1lkf9', 'rwg94872c3fc449bcf50d6bec'),
  ('cmtc043vm0fsvcwgtr4ojgbz5', 'rwg99a0cecbc758b3c1c15436')
) AS v("itemVendaId", "receitaId")
WHERE iv.id = v."itemVendaId" AND iv."receitaId" IS NULL;

-- ---------------------------------------------------------------------------
-- VERIFICAÇÃO
-- ---------------------------------------------------------------------------
-- 1) Quanto da compra do Wine Garden passou a ser reconhecida.
SELECT count(*) AS linhas, count(i."produtoId") AS reconhecidas,
       round(100.0 * count(i."produtoId") / nullif(count(*), 0), 1) AS pct,
       round(sum(i."valorTotal") FILTER (WHERE i."produtoId" IS NOT NULL)::numeric, 2) AS valor_reconhecido
FROM "ItemNotaCompra" i
JOIN "NotaCompra" n ON n.id = i."notaCompraId"
JOIN "Unidade" u ON u.id = n."unidadeId"
WHERE u.nome = 'Wine Garden';

-- 2) O CMV de cada vinho que ganhou ficha. Esperado: nada acima de 60%,
--    nada em zero. Zero significa produto sem preço — investigar.
SELECT iv.nome, iv."precoVenda", round(ir.quantidade::numeric, 3) AS garrafas,
       round(pa.preco::numeric, 2) AS preco_garrafa,
       round((ir.quantidade * pa.preco)::numeric, 2) AS custo,
       round((100.0 * ir.quantidade * pa.preco / nullif(iv."precoVenda", 0))::numeric, 1) AS cmv_pct
FROM "ItemVenda" iv
JOIN "Receita" r ON r.id = iv."receitaId"
JOIN "IngredienteReceita" ir ON ir."receitaId" = r.id
LEFT JOIN "PrecoAtualProduto" pa ON pa."produtoId" = ir."produtoId"
  AND pa."unidadeId" = (SELECT COALESCE(u."estoqueEmId", u.id) FROM "Unidade" u WHERE u.nome = 'Wine Garden')
WHERE r.id LIKE 'rwg%'
ORDER BY cmv_pct DESC NULLS FIRST;

-- ---------------------------------------------------------------------------
-- 6 LINHA(S) FORA DESTA RODADA — precisam de decisão:
--   * LE PETIT RONAN BY CLIENET AOC BORDEAUX WINE (900001000640): Le Petit Ronan by Clinet: ligado no mesmo produto que RONAN BY CLINET (900001000754). São dois vinhos — o segundo rótulo e o principal —, e codigoTeknisa é único: um dos dois ficaria sem casar. Provavelmente é produto novo.
--   * POGGIO MARU PRIMITIVO DI MANDURIA WINE (900001000727): Poggio Marù: o produto já tem o código 900001000785. Dois códigos do Teknisa para o mesmo vinho — decidir qual é o vigente antes de sobrescrever.
--   * Marques de Borba - Vinhas Velhas DOC: a R$ 0,2 de garrafa o custo é R$ 107,86 e a venda é R$ 81 — CMV 133%. A garrafa custa R$ 539,31; nenhuma fração razoável fecha. Preço de carta ou de compra precisa ser revisto.
--   * Le Petit Ronan by Clinet AOC Bordeaux: o código 900001000640 não tem produto nesta rodada — sem produto não há custo
--   * Brunello di Montalcino Pian delle Vigne: casou por semelhança com a compra do PIAN DELLE VIGNE ROSSO DI MONTALCINO (R$ 319,55). Brunello e Rosso são vinhos diferentes da mesma vinícola, e o Brunello não foi comprado no período — ficaria com o custo do irmão barato e CMV de 22%, bonito e errado.
--   * Jerez Marqués del Real Tesoro Fino (50 ml): marcado 0,2 (150 ml) numa dose de 50 ml — a fração de 750 ml seria 0,067. A 0,2 o custo dá R$ 31,58 contra venda de R$ 22.
-- ---------------------------------------------------------------------------
