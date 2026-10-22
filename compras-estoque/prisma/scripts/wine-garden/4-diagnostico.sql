-- Por que 583 linhas do Wine Garden não casaram. SÓ LÊ.
--
-- O reprocessamento devolveu `casadosPorCodigo = 0` com 268 códigos distintos
-- nas linhas. Ou os produtos não têm esse código gravado, ou não foram
-- criados. Estas quatro consultas distinguem os casos — e a ordem importa,
-- porque a 1 responde se o cadastro chegou a rodar.

-- 1. O CADASTRO RODOU? Devia ter criado 285 produtos com codigoTeknisa.
SELECT count(*) AS produtos_no_catalogo,
       count("codigoTeknisa") AS com_codigo,
       count(*) FILTER (WHERE "criadoEm"::date >= CURRENT_DATE - 1) AS criados_nas_ultimas_24h
FROM "Produto";

-- 2. UNIDADE CRUA NO CADASTRO — a causa do "GA x GA".
--
-- A tabela de sinônimos do app mapeia GA->CX, BOB->UND, UN->UND, FD->CX,
-- PCT->CX, LA->CX, BD->CX, GF->UND, PC->UND, PT->CX, BBL->UND, RL->UND.
-- Produto gravado com a grafia CRUA fica indexado sob ela, enquanto a busca
-- pergunta pela canônica — e nunca se encontram.
SELECT "unidadeMedida", count(*) AS produtos
FROM "Produto"
WHERE "unidadeMedida" NOT IN ('KG', 'LT', 'UND', 'CX')
GROUP BY 1
ORDER BY produtos DESC;

-- 3. OS CÓDIGOS DAS LINHAS QUE NÃO CASARAM existem no catálogo?
--
-- Amostra de dez códigos do CSV de não reconhecidos. `achou_codigo` é o que
-- importa: zero em todos confirma que o cadastro não gravou o código.
WITH amostra(codigo, nome) AS (VALUES
  ('100000017101', 'ACEM BOVINO KG'),
  ('105015009102', 'ARROZ ARBORIO PAGANINI 1KG'),
  ('110015009112', 'HORTELA KG'),
  ('120000006158', 'GUARDANAPO 40X23 WINE CX 2000 (COMPRA)'),
  ('130005000406', 'WHISKEY JACK DANIEL TRADICIONAL 1LT GR'),
  ('900001000678', 'WG MONSARAZ ALENTEJO DOC TINTO'),
  ('105050007118', 'OLEO DE ALGODAO 14,5 LT'),
  ('320000000001', 'BURRATA UN'),
  ('110010013636', 'MICROVERDES DE RABANETE (40G)'),
  ('905066000004', 'CORONA CERO SUNBREW N LONG NECK 6X330ML (COMPRA)')
)
SELECT a.codigo,
       a.nome,
       (SELECT count(*) FROM "Produto" p WHERE p."codigoTeknisa" = a.codigo) AS achou_codigo,
       (SELECT count(*) FROM "Produto" p WHERE lower(btrim(p.nome)) = lower(btrim(a.nome))) AS achou_nome,
       (SELECT string_agg(p."unidadeMedida" || COALESCE(' cod=' || p."codigoTeknisa", ' sem código'), ' / ')
          FROM "Produto" p WHERE lower(btrim(p.nome)) = lower(btrim(a.nome))) AS como_esta
FROM amostra a
ORDER BY a.nome;

-- 4. UM PRODUTO, DOIS CÓDIGOS — a causa dos 46 CONFLITO_DE_CODIGO.
--
-- O Teknisa tem código por EMBALAGEM e por cadastro: ALECRIM é 110015009101 e
-- 110015009123, CHOPP BRAHMA 50LT é 900107000103 e 130000000001. Com um código
-- só por produto, um dos dois fica eternamente sem casar. É exatamente o que a
-- tabela CodigoCompraProduto resolve — e a migração dela ainda não rodou.
SELECT to_regclass('public."CodigoCompraProduto"') IS NOT NULL AS tabela_existe,
       (SELECT count(*) FROM "Produto" WHERE "codigoTeknisa" IS NOT NULL) AS produtos_com_um_codigo;
