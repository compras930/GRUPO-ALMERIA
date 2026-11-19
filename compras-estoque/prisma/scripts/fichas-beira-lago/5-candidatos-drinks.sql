-- Candidatos de produto para cada ingrediente de DRINK. SÓ LEITURA.
-- 73 ingredientes distintos, 52 drinks.
-- GERADO por gerar-candidatos-drinks.py
--
-- A coluna `candidatos_marca` busca pela MARCA sozinha e a
-- `candidatos_precisos` exige marca + qualificador. Quando as duas
-- trouxerem coisas diferentes, olhe: é o caso TANQUERAY / TANQUERAY TEN,
-- garrafas diferentes com preço diferente.
--
-- Escolha um produto por linha e mande a lista de volta. Linha sem
-- candidato nenhum é cadastro que falta — ou produção do bar, que não
-- se compra (ver a coluna `observacao`).

WITH ficha(chave, marca, qualificador, drinks_que_usam, observacao) AS (VALUES
  ('SUMO LIMAO', 'LIMAO', 'LIMAO', 22, 'PRODUCAO DO BAR — vira ficha, nao produto'),
  ('XAROPE SIMPLES', 'SIMPLES', 'SIMPLES', 21, 'PRODUCAO DO BAR — vira ficha, nao produto'),
  ('BITTER ANGOSTURA BITTERS', 'ANGOSTURA', 'BITTERS', 13, ''),
  ('VERMUTE CARPANO ROSSO', 'CARPANO', 'ROSSO', 10, ''),
  ('BITTER CAMPARI', 'CAMPARI', 'CAMPARI', 8, ''),
  ('ST PIERRE AGUA TONICA', 'PIERRE', 'AGUA', 7, ''),
  ('GELO APTK', 'GELO', 'APTK', 6, ''),
  ('FRUTA LIMAO TAITI', 'LIMAO', 'TAITI', 5, ''),
  ('MEIA LUA LIMAO SICILIANO', 'LIMAO', 'SICILIANO', 5, ''),
  ('CLARA DE OVO PASTEURIZADA', 'CLARA', 'OVO', 4, ''),
  ('GIN BOM VIVANT', 'BOM', 'VIVANT', 4, ''),
  ('ESPUMANTE 1913', '1913', '1913', 3, ''),
  ('FLOR DE SAL', 'FLOR', 'SAL', 3, ''),
  ('GELO YETI', 'GELO', 'YETI', 3, ''),
  ('GIN MARE', 'MARE', 'MARE', 3, ''),
  ('GIN ROKU', 'ROKU', 'ROKU', 3, ''),
  ('GIN TANQUERAY N TEN', 'TANQUERAY', 'TEN', 3, ''),
  ('PIMENTA TABASCO', 'TABASCO', 'TABASCO', 3, ''),
  ('ST PIERRE PALOMA', 'PIERRE', 'PALOMA', 3, ''),
  ('VERMUTE CARPANO DRY', 'CARPANO', 'DRY', 3, ''),
  ('VODKA KETEL ONE', 'KETEL', 'ONE', 3, ''),
  ('WHISKEY MAKERS MARK', 'MAKERS', 'MARK', 3, ''),
  ('CACHACA CRISTAL DO GOIAS', 'CRISTAL', 'GOIAS', 2, ''),
  ('FRUTA MACA', 'MACA', 'MACA', 2, ''),
  ('FRUTA MORANGO FRESCO', 'MORANGO', 'FRESCO', 2, ''),
  ('FRUTA UVA', 'UVA', 'UVA', 2, ''),
  ('GIN BOMBAY BRAMBLE', 'BOMBAY', 'BRAMBLE', 2, ''),
  ('GIN HENDRIX', 'HENDRIX', 'HENDRIX', 2, ''),
  ('GIN NORDES', 'NORDES', 'NORDES', 2, ''),
  ('GIN TANQUERAY', 'TANQUERAY', 'TANQUERAY', 2, ''),
  ('GIN TANQUERAY SEVILLA', 'TANQUERAY', 'SEVILLA', 2, ''),
  ('LEMON PEPER', 'LEMON', 'PEPER', 2, ''),
  ('LICOR PEACHTREE', 'PEACHTREE', 'PEACHTREE', 2, ''),
  ('MEIA LUA LARANJA BAHIA', 'LARANJA', 'BAHIA', 2, ''),
  ('MEIA LUA LIMAO TAITI', 'LIMAO', 'TAITI', 2, ''),
  ('MEL FERMENTADO', 'MEL', 'FERMENTADO', 2, 'PRODUCAO DO BAR — vira ficha, nao produto'),
  ('PASSIONE', 'PASSIONE', 'PASSIONE', 2, ''),
  ('TEQUILA DON JULIO BLANCA', 'DON', 'JULIO', 2, ''),
  ('WHISKY BLOND LABEL', 'BLOND', 'LABEL', 2, ''),
  ('XAROPE FRAMBOESA', 'FRAMBOESA', 'FRAMBOESA', 2, 'PRODUCAO DO BAR — vira ficha, nao produto'),
  ('XAROPE GENGIBRE', 'GENGIBRE', 'GENGIBRE', 2, 'PRODUCAO DO BAR — vira ficha, nao produto'),
  ('XAROPE MONIN FLOR DE SABUGUEIRO', 'MONIN', 'FLOR', 2, ''),
  ('AGUA COM GAS PRATA', 'AGUA', 'GAS', 1, ''),
  ('APERITIVO APEROL', 'APEROL', 'APEROL', 1, ''),
  ('BITTER ANGOSTURA ORANGE BITTERS', 'ANGOSTURA', 'ORANGE', 1, ''),
  ('BITTER PEYCHAUDS', 'PEYCHAUDS', 'PEYCHAUDS', 1, ''),
  ('CACHACA WEBER HAUS 6 ANOS', 'WEBER', 'HAUS', 1, ''),
  ('CHA LAPSANG SOUCHONG', 'LAPSANG', 'SOUCHONG', 1, ''),
  ('CLARIFICACAO DE MORANGO', 'CLARIFICACAO', 'MORANGO', 1, 'PRODUCAO DO BAR — vira ficha, nao produto'),
  ('GIN GORDONS', 'GORDONS', 'GORDONS', 1, ''),
  ('LICOR AJIWAI UMESHU', 'AJIWAI', 'UMESHU', 1, ''),
  ('LICOR DISARONNO', 'DISARONNO', 'DISARONNO', 1, ''),
  ('MOLHO INGLES', 'MOLHO', 'INGLES', 1, ''),
  ('PISCO BARSOL', 'BARSOL', 'BARSOL', 1, ''),
  ('PISCO CAPEL', 'CAPEL', 'CAPEL', 1, ''),
  ('SAKE MIYAKO HOMARE DRY', 'MIYAKO', 'HOMARE', 1, ''),
  ('SAL REFINADO', 'SAL', 'REFINADO', 1, ''),
  ('SUCO DE TOMATE SUPER BOM', 'SUCO', 'TOMATE', 1, ''),
  ('SUMO LARANJA PERA', 'LARANJA', 'PERA', 1, 'PRODUCAO DO BAR — vira ficha, nao produto'),
  ('TEQUILA 1800 SILVER', '1800', 'SILVER', 1, ''),
  ('TEQUILA JOSE CUERVO PRATA', 'JOSE', 'CUERVO', 1, ''),
  ('TEQUILA JOSE CUERVO REPOSADO', 'JOSE', 'CUERVO', 1, ''),
  ('VERMUTE CARPANO BIANCO', 'CARPANO', 'BIANCO', 1, ''),
  ('VODKASTOLI', 'VODKASTOLI', 'VODKASTOLI', 1, ''),
  ('WHISKEY BUFALLO TRACE', 'BUFALLO', 'TRACE', 1, ''),
  ('WHISKY BLACK LABEL', 'BLACK', 'LABEL', 1, ''),
  ('WHISKY GOLD LABEL', 'GOLD', 'LABEL', 1, ''),
  ('WHISKY HIBIKI', 'HIBIKI', 'HIBIKI', 1, ''),
  ('WHISKY MACALLAN 12', 'MACALLAN', 'MACALLAN', 1, ''),
  ('WHISKY SINGLETON', 'SINGLETON', 'SINGLETON', 1, ''),
  ('WHISKY YAMAZAKI', 'YAMAZAKI', 'YAMAZAKI', 1, ''),
  ('XAROPE CONCETRADO DE LARANJA', 'CONCETRADO', 'LARANJA', 1, 'PRODUCAO DO BAR — vira ficha, nao produto'),
  ('XAROPE MONIN CRANBERRY', 'MONIN', 'CRANBERRY', 1, '')
)
SELECT f.chave AS ingrediente_do_drink, f.drinks_que_usam, f.observacao,
       (SELECT string_agg(x.nome || ' [' || x.un || ']', ' | ' ORDER BY length(x.nome))
          FROM (SELECT pr.nome, pr."unidadeMedida" AS un FROM "Produto" pr
                 WHERE pr.ativo
                   AND upper(regexp_replace(translate(btrim(pr.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g')) LIKE '%' || f.marca || '%'
                 LIMIT 5) x) AS candidatos_marca,
       (SELECT string_agg(x.nome || ' [' || x.un || ']', ' | ' ORDER BY length(x.nome))
          FROM (SELECT pr.nome, pr."unidadeMedida" AS un FROM "Produto" pr
                 WHERE pr.ativo
                   AND upper(regexp_replace(translate(btrim(pr.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g')) LIKE '%' || f.marca || '%'
                   AND upper(regexp_replace(translate(btrim(pr.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g')) LIKE '%' || f.qualificador || '%'
                 LIMIT 5) x) AS candidatos_precisos
  FROM ficha f
 WHERE NOT EXISTS (
   SELECT 1 FROM "Produto" pr WHERE pr.ativo AND upper(regexp_replace(translate(btrim(pr.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g')) = f.chave
 )
 ORDER BY f.drinks_que_usam DESC, f.chave;
