-- Fichas de DRINK do Beira Lago — as fichas. 52 drinks.
-- GERADO por gerar-import-drinks.py; não editar à mão.
--
-- FAÇA UM BRANCH NO NEON ANTES (Branches > Create branch).
--
-- RENDIMENTO 1 UND: a ficha inteira é uma dose servida, então o custo dela já
-- é o custo por drink. Não se divide por nada.
--
-- Não cria ficha cujo nome já exista na casa — e, diferente da importação da
-- cozinha, aqui isso não deixa ninguém para trás: o 6b resolve a ficha PELO
-- NOME, então o drink que já existir recebe os ingredientes na mesma.

BEGIN;

INSERT INTO "Receita" ("id", "unidadeId", "nome", "rendimentoQtd", "rendimentoUnidade", "criadoEm", "atualizadoEm")
SELECT v.id, u.id, v.nome, 1, 'UND', now(), now()
  FROM "Unidade" u, (VALUES
    ('recdk197b14ba452e9f35b5c3', 'APEROL SPRITZ', 'APEROL SPRITZ'),
    ('recdk3a1e8824a702c59c15db', 'GIN TONICA - BOM VIVANT', 'GIN TONICA BOM VIVANT'),
    ('recdk348769a1844b72ad0e07', 'PALOMA - JOSÉ CUERVO PRATA', 'PALOMA JOSE CUERVO PRATA'),
    ('recdk2518740be1d5ec4f9f68', 'MARK TWAIN - BLOND LABEL', 'MARK TWAIN BLOND LABEL'),
    ('recdk6afcc6481cb47a6820a3', 'PISCO SOUR - CAPEL', 'PISCO SOUR CAPEL'),
    ('recdkef3060dd9dc770686410', 'BLOOD MARY', 'BLOOD MARY'),
    ('recdkf156ecc25f153fb3e9c3', 'FITZGERALD - BOM VIVANT', 'FITZGERALD BOM VIVANT'),
    ('recdkb07f87b9c81e8a854a7d', 'NEGRONI - BOM VIVANT', 'NEGRONI BOM VIVANT'),
    ('recdkc8695a49547147947db5', 'CLOVER CLUB - BOMBAY BRAMBLE', 'CLOVER CLUB BOMBAY BRAMBLE'),
    ('recdk00121f58c5471005d76b', 'CLERICOT JARRA', 'CLERICOT JARRA'),
    ('recdk5f12a300cd0406680955', 'CLERICOT TAÇA', 'CLERICOT TACA'),
    ('recdk36edfad34108f424eca2', 'PENICILIN ZERO', 'PENICILIN ZERO'),
    ('recdk3b3ca2cf9544cc8bfb98', 'PASSIONE', 'PASSIONE'),
    ('recdk26e84bdcab191f59b9e4', 'SODA ALMERIA', 'SODA ALMERIA'),
    ('recdk8185061e1673e4a44bd2', 'BOULEVARDIER', 'BOULEVARDIER'),
    ('recdk2fbbfdd811bc66955718', 'CAIPIRINHA - CRISTAL DO GOIAS', 'CAIPIRINHA CRISTAL DO GOIAS'),
    ('recdkb98c12672475a4b1bed3', 'CAIPIROSKA - KETEL ONE', 'CAIPIROSKA KETEL ONE'),
    ('recdke48f248c03783db09306', 'RUBI', 'RUBI'),
    ('recdkc63c6a604a7daf9f461f', 'FLOR DO CERRADO', 'FLOR DO CERRADO'),
    ('recdk6e26bc03cf5c67bba16e', '1870', '1870'),
    ('recdk62c8b751c13d3ab997d5', 'PASSIONE DON JULIO', 'PASSIONE DON JULIO'),
    ('recdkb73999f76a30babcf04a', 'HONEY MIRAGE', 'HONEY MIRAGE'),
    ('recdk68229b72ef3e45c8f3a9', 'jap dry', 'JAP DRY'),
    ('recdk961e79429a99c648a38f', 'GIN TONICA - TANQUERAY', 'GIN TONICA TANQUERAY'),
    ('recdk7b9858649536a7292d42', 'GIN TONICA - TANQUERAY N TEN', 'GIN TONICA TANQUERAY N TEN'),
    ('recdk1a07620baf442a0b1ce1', 'GIN TONICA - MARE', 'GIN TONICA MARE'),
    ('recdk44769a1c59134acbfd22', 'GIN TONICA - ROKU', 'GIN TONICA ROKU'),
    ('recdkfb7f8e003f17375950b1', 'GIN TONICA - NORDES', 'GIN TONICA NORDES'),
    ('recdka8994fc20f23066d4aa5', 'GIN TONICA - HENDRIX', 'GIN TONICA HENDRIX'),
    ('recdk173fd1d639fd2d61b695', 'NEGRONI - TANQUERAY', 'NEGRONI TANQUERAY'),
    ('recdkaf9ef7bf98927a8db30f', 'NEGRONI - MARE', 'NEGRONI MARE'),
    ('recdk3fb4992b84316bafa4f0', 'NEGRONI - ROKU', 'NEGRONI ROKU'),
    ('recdk7fef5cd28615664eff0f', 'NEGRONI - TANQUERAY N TEN', 'NEGRONI TANQUERAY N TEN'),
    ('recdkaa308a9e1e2d25e818ac', 'NEGRONI - HENDRIX', 'NEGRONI HENDRIX'),
    ('recdk2b2c5cc3471a153e7401', 'NEGRONI - NORDES', 'NEGRONI NORDES'),
    ('recdkc47ab4e534400a00eb73', 'PALOMA - 1800 SILVER', 'PALOMA 1800 SILVER'),
    ('recdk3875391c03ad97bf230a', 'PALOMA - DON JULIO BLANCA', 'PALOMA DON JULIO BLANCA'),
    ('recdk980af5641b931c232a47', 'MARK TWAIN - BLACK LABEL', 'MARK TWAIN BLACK LABEL'),
    ('recdk88bb380702e05fc4cea4', 'MARK TWAIN - SINGLETON', 'MARK TWAIN SINGLETON'),
    ('recdka4b1b45a0d8631dc8363', 'MARK TWAIN - GOLD LABEL', 'MARK TWAIN GOLD LABEL'),
    ('recdk272a1377594600a5b9d8', 'FITZGERALD - ROKU', 'FITZGERALD ROKU'),
    ('recdkcc0a184767383e6a77e8', 'FITZGERALD - MARE', 'FITZGERALD MARE'),
    ('recdkd1836216575c2e240ba9', 'FITZGERALD - TANQUERAY N TEN', 'FITZGERALD TANQUERAY N TEN'),
    ('recdk63f7d92c1042851e0f39', 'FITZGERALD - GORDONS', 'FITZGERALD GORDONS'),
    ('recdkea088ffe00b3915543bf', 'PISCO SOUR - BARSOL', 'PISCO SOUR BARSOL'),
    ('recdk2e07f80c9e8da5f8f57f', 'CLOVER CLUB - BOM VIVANT', 'CLOVER CLUB BOM VIVANT'),
    ('recdk2e60f980d7fded232b34', 'CAIPIRINHA - WEBER HAUS 6 ANOS', 'CAIPIRINHA WEBER HAUS 6 ANOS'),
    ('recdk8e531070460defb16da4', 'CAIPIROSKA - VODKASTOLI', 'CAIPIROSKA VODKASTOLI'),
    ('recdk66c1e0da8a12c0be98ae', 'CAIPIROSKA - KETEL ONE (2)', 'CAIPIROSKA KETEL ONE 2'),
    ('recdk43917476d384737893fa', 'the macallan manhattan', 'THE MACALLAN MANHATTAN'),
    ('recdkb7739e75e96865059e33', 'hibiki old fashioned', 'HIBIKI OLD FASHIONED'),
    ('recdk09a56609238181b09e25', 'yamazaki highball', 'YAMAZAKI HIGHBALL')
  ) AS v(id, nome, chave)
 WHERE u.nome = 'Beira Lago'
   AND NOT EXISTS (
     SELECT 1 FROM "Receita" r
      WHERE r."unidadeId" = u.id AND upper(regexp_replace(translate(btrim(r.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g')) = v.chave
   )
-- Trava de segurança: o NOT EXISTS compara nome normalizado, o banco compara
-- o nome cru. Dois nomes que só diferem por acento passariam pelo primeiro e
-- quebrariam no segundo, derrubando a carga inteira por causa de uma linha.
ON CONFLICT ("unidadeId", "nome") DO NOTHING;

COMMIT;

-- Conferência: quantos drinks existem agora na casa.
SELECT count(*) AS drinks_no_app
  FROM "Receita" r
  JOIN "Unidade" u ON u.id = r."unidadeId" AND u.nome = 'Beira Lago'
 WHERE upper(regexp_replace(translate(btrim(r.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g')) IN (

   'APEROL SPRITZ',
   'GIN TONICA BOM VIVANT',
   'PALOMA JOSE CUERVO PRATA',
   'MARK TWAIN BLOND LABEL',
   'PISCO SOUR CAPEL',
   'BLOOD MARY',
   'FITZGERALD BOM VIVANT',
   'NEGRONI BOM VIVANT',
   'CLOVER CLUB BOMBAY BRAMBLE',
   'CLERICOT JARRA',
   'CLERICOT TACA',
   'PENICILIN ZERO',
   'PASSIONE',
   'SODA ALMERIA',
   'BOULEVARDIER',
   'CAIPIRINHA CRISTAL DO GOIAS',
   'CAIPIROSKA KETEL ONE',
   'RUBI',
   'FLOR DO CERRADO',
   '1870',
   'PASSIONE DON JULIO',
   'HONEY MIRAGE',
   'JAP DRY',
   'GIN TONICA TANQUERAY',
   'GIN TONICA TANQUERAY N TEN',
   'GIN TONICA MARE',
   'GIN TONICA ROKU',
   'GIN TONICA NORDES',
   'GIN TONICA HENDRIX',
   'NEGRONI TANQUERAY',
   'NEGRONI MARE',
   'NEGRONI ROKU',
   'NEGRONI TANQUERAY N TEN',
   'NEGRONI HENDRIX',
   'NEGRONI NORDES',
   'PALOMA 1800 SILVER',
   'PALOMA DON JULIO BLANCA',
   'MARK TWAIN BLACK LABEL',
   'MARK TWAIN SINGLETON',
   'MARK TWAIN GOLD LABEL',
   'FITZGERALD ROKU',
   'FITZGERALD MARE',
   'FITZGERALD TANQUERAY N TEN',
   'FITZGERALD GORDONS',
   'PISCO SOUR BARSOL',
   'CLOVER CLUB BOM VIVANT',
   'CAIPIRINHA WEBER HAUS 6 ANOS',
   'CAIPIROSKA VODKASTOLI',
   'CAIPIROSKA KETEL ONE 2',
   'THE MACALLAN MANHATTAN',
   'HIBIKI OLD FASHIONED',
   'YAMAZAKI HIGHBALL'
 );
