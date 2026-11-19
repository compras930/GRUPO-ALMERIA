-- As garrafas do bar aparecem nas notas de compra? SÓ LEITURA.
-- 36 garrafas sem produto no cadastro.
-- GERADO por gerar-busca-notas-bar.py
--
-- Leitura do resultado:
--   linhas_na_nota > 0 e produto_casado cheio → o produto existe com
--     outro nome; é par a fazer, não cadastro novo.
--   linhas_na_nota > 0 e produto_casado vazio → a compra entra e não
--     casa com nada: o estoque dessa garrafa nunca existiu.
--   linhas_na_nota = 0 → ou não se compra, ou a compra do bar não passa
--     pelo Teknisa.

WITH ficha(chave, marca, drinks_que_usam) AS (VALUES
  ('BITTER ANGOSTURA BITTERS', 'ANGOST', 13),
  ('ST PIERRE AGUA TONICA', 'PIERRE', 7),
  ('GIN BOM VIVANT', 'BOM', 4),
  ('ESPUMANTE 1913', '1913', 3),
  ('FLOR DE SAL', 'FLOR', 3),
  ('GIN MARE', 'MARE', 3),
  ('GIN TANQUERAY N TEN', 'TANQUE', 3),
  ('PIMENTA TABASCO', 'TABASC', 3),
  ('ST PIERRE PALOMA', 'PIERRE', 3),
  ('VERMUTE CARPANO DRY', 'CARPAN', 3),
  ('VODKA KETEL ONE', 'KETEL', 3),
  ('WHISKEY MAKERS MARK', 'MAKERS', 3),
  ('FRUTA MACA', 'MACA', 2),
  ('GIN HENDRIX', 'HENDRI', 2),
  ('GIN NORDES', 'NORDES', 2),
  ('LICOR PEACHTREE', 'PEACHT', 2),
  ('PASSIONE', 'PASSIO', 2),
  ('XAROPE MONIN FLOR DE SABUGUEIRO', 'MONIN', 2),
  ('AGUA COM GAS PRATA', 'AGUA', 1),
  ('BITTER ANGOSTURA ORANGE BITTERS', 'ANGOST', 1),
  ('BITTER PEYCHAUDS', 'PEYCHA', 1),
  ('CACHACA WEBER HAUS 6 ANOS', 'WEBER', 1),
  ('CHA LAPSANG SOUCHONG', 'LAPSAN', 1),
  ('GIN GORDONS', 'GORDON', 1),
  ('LICOR AJIWAI UMESHU', 'AJIWAI', 1),
  ('LICOR DISARONNO', 'DISARO', 1),
  ('PISCO CAPEL', 'CAPEL', 1),
  ('SAKE MIYAKO HOMARE DRY', 'MIYAKO', 1),
  ('TEQUILA 1800 SILVER', '1800', 1),
  ('VERMUTE CARPANO BIANCO', 'CARPAN', 1),
  ('VODKASTOLI', 'VODKAS', 1),
  ('WHISKEY BUFALLO TRACE', 'BUFALL', 1),
  ('WHISKY HIBIKI', 'HIBIKI', 1),
  ('WHISKY MACALLAN 12', 'MACALL', 1),
  ('WHISKY YAMAZAKI', 'YAMAZA', 1),
  ('XAROPE MONIN CRANBERRY', 'MONIN', 1)
)
SELECT f.chave AS ingrediente_do_drink, f.drinks_que_usam,
       (SELECT count(*) FROM "ItemNotaCompra" i
         WHERE upper(regexp_replace(translate(btrim(i."nomeBruto"), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g')) LIKE '%' || f.marca || '%') AS linhas_na_nota,
       (SELECT string_agg(DISTINCT i."nomeBruto", ' | ')
          FROM "ItemNotaCompra" i
         WHERE upper(regexp_replace(translate(btrim(i."nomeBruto"), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g')) LIKE '%' || f.marca || '%') AS nome_na_nota,
       (SELECT string_agg(DISTINCT pr.nome, ' | ')
          FROM "ItemNotaCompra" i JOIN "Produto" pr ON pr.id = i."produtoId"
         WHERE upper(regexp_replace(translate(btrim(i."nomeBruto"), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g')) LIKE '%' || f.marca || '%') AS produto_casado
  FROM ficha f
 ORDER BY f.drinks_que_usam DESC, f.chave;
