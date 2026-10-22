-- As linhas sem produto do Wine Garden guardaram o CÓDIGO? SÓ LÊ.
--
-- POR QUE ISTO DECIDE TUDO. O export do Teknisa que você mandou tem código de
-- 12 dígitos em TODAS as 2.036 linhas, e o app casa por código antes de tentar
-- o nome (src/lib/resolucao-produto-compra.ts, passo 1): com código batendo, o
-- nome pode estar diferente à vontade.
--
-- Então:
--   - Se `com_codigo` for ~679, basta cadastrar os produtos COM `codigoTeknisa`
--     e reprocessar. O nome deixa de importar, e os 13 casos de "(COMPRA)" que
--     teriam virado produto duplicado colapsam sozinhos no mesmo produto —
--     porque o export prova que são o mesmo código.
--   - Se for 0, a carga não mandou código, e aí o casamento continua por nome:
--     o cadastro tem que gravar o nome EXATO, e cada grafia vira um produto.
--
-- A segunda consulta mostra se algum código guardado aponta para dois nomes
-- diferentes — é o caso "(COMPRA)", e com código ele deixa de ser problema.
SELECT count(*) AS linhas_sem_produto,
       count(*) FILTER (WHERE i."codigoBruto" IS NOT NULL AND btrim(i."codigoBruto") <> '') AS com_codigo,
       count(DISTINCT i."codigoBruto") FILTER (WHERE i."codigoBruto" IS NOT NULL) AS codigos_distintos,
       count(DISTINCT i."nomeBruto") AS nomes_distintos
FROM "ItemNotaCompra" i
JOIN "NotaCompra" n ON n.id = i."notaCompraId"
JOIN "Unidade" u ON u.id = n."unidadeId" AND u.nome = 'Wine Garden'
WHERE i."produtoId" IS NULL;

-- Um código, dois nomes: é o par "(COMPRA)" / sem sufixo. Com cadastro por
-- código eles viram UM produto; por nome, virariam dois, com o estoque
-- dividido entre eles.
SELECT i."codigoBruto" AS codigo,
       count(DISTINCT i."nomeBruto") AS nomes,
       string_agg(DISTINCT i."nomeBruto", '  |  ') AS quais
FROM "ItemNotaCompra" i
JOIN "NotaCompra" n ON n.id = i."notaCompraId"
JOIN "Unidade" u ON u.id = n."unidadeId" AND u.nome = 'Wine Garden'
WHERE i."produtoId" IS NULL AND i."codigoBruto" IS NOT NULL
GROUP BY 1
HAVING count(DISTINCT i."nomeBruto") > 1
ORDER BY nomes DESC
LIMIT 20;
