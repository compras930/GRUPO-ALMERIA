-- Copia para CodigoCompraProduto tudo o que hoje mora em Produto.codigoTeknisa
-- e em ConversaoUnidadeCompra.
--
-- Rode DEPOIS da migração 20260923170000_codigo_compra_produto.
--
-- NADA É APAGADO. As duas origens continuam de pé; o casamento vai tentar a
-- tabela nova primeiro e cair nelas depois. Se der errado,
-- `DELETE FROM "CodigoCompraProduto"` devolve o sistema ao estado de hoje sem
-- perder nada — é por isso que a cópia vem antes da troca da rota.
--
-- O OBJETIVO É EMPATE, NÃO MELHORIA. Depois desta cópia, toda linha que casa
-- hoje tem que casar igual, com o mesmo produto e o mesmo fator, e toda linha
-- recusada hoje tem que continuar recusada. Ganho nenhum é esperado aqui: o
-- ganho vem depois, quando os 107 códigos de segunda embalagem forem
-- cadastrados na tabela nova.
--
-- IDEMPOTENTE: os ids saem de hash de (origem, código, unidade), e os INSERT
-- caem em ON CONFLICT DO NOTHING. Rodar duas vezes não duplica nem sobrescreve.
--
-- Rode um passo de cada vez, conferindo entre eles.

-- ---------------------------------------------------------------------------
-- PASSO 1 — Os códigos de hoje, na unidade do próprio produto, fator 1.
--
-- `unidadeCompra` nasce igual a `Produto.unidadeMedida`, que é exatamente o
-- que a resolução de hoje exige para casar por código com fator 1 (a trava
-- UNIDADE_DIVERGENTE). Copiar assim é o que garante o empate.
-- ---------------------------------------------------------------------------
INSERT INTO "CodigoCompraProduto" (id, origem, codigo, "produtoId", "unidadeCompra", fator, observacao, "criadoEm")
SELECT 'ccp' || left(md5('TEKNISA|' || p."codigoTeknisa" || '|' || p."unidadeMedida"), 22),
       'TEKNISA',
       p."codigoTeknisa",
       p.id,
       p."unidadeMedida",
       1,
       'migrado de Produto.codigoTeknisa',
       now()
FROM "Produto" p
WHERE p."codigoTeknisa" IS NOT NULL
ON CONFLICT (origem, codigo, "unidadeCompra") DO NOTHING;

-- ---------------------------------------------------------------------------
-- PASSO 2 — As conversões de embalagem, como linhas ADICIONAIS do mesmo código.
--
-- Uma linha por (código, unidade de compra). O mesmo código do Teknisa passa a
-- ter duas linhas: uma na unidade do produto com fator 1, outra na embalagem
-- com o fator da conversão. É assim que a resolução de hoje já se comporta —
-- ela aceita as duas —, agora explícito em vez de em duas tabelas.
--
-- Este passo foi reescrito depois de um erro meu: a primeira versão fazia
-- UPDATE na linha do passo 1, trocando a unidade. Isso faria a caixa de ovos
-- casar e o ovo avulso, que casa hoje, parar de casar. INSERT, não UPDATE.
--
-- Conversão de produto SEM código não tem como vir: sem código não há chave.
-- Fica listada no passo 5.
-- ---------------------------------------------------------------------------
INSERT INTO "CodigoCompraProduto" (id, origem, codigo, "produtoId", "unidadeCompra", fator, observacao, "criadoEm")
SELECT 'ccp' || left(md5('TEKNISA|' || p."codigoTeknisa" || '|' || cu."unidadeCompra"), 22),
       'TEKNISA',
       p."codigoTeknisa",
       p.id,
       cu."unidadeCompra",
       cu.fator,
       'migrado de ConversaoUnidadeCompra',
       now()
FROM "ConversaoUnidadeCompra" cu
JOIN "Produto" p ON p.id = cu."produtoId"
WHERE cu.fator > 0
  AND p."codigoTeknisa" IS NOT NULL
  AND cu."unidadeCompra" <> p."unidadeMedida"
ON CONFLICT (origem, codigo, "unidadeCompra") DO NOTHING;

-- ---------------------------------------------------------------------------
-- PASSO 3 — CONFERIR os totais.
--
--   produtos_com_codigo = quantos produtos têm codigoTeknisa
--   linhas_fator_1      = tem que ser IGUAL a produtos_com_codigo
--   conversoes_no_app   = quantas conversões existiam (fator > 0)
--   linhas_com_fator    = <= conversoes_no_app; a diferença é conversão de
--                         produto sem código, listada no passo 5
-- ---------------------------------------------------------------------------
SELECT (SELECT count(*) FROM "Produto" WHERE "codigoTeknisa" IS NOT NULL)      AS produtos_com_codigo,
       (SELECT count(*) FROM "CodigoCompraProduto" WHERE fator = 1)            AS linhas_fator_1,
       (SELECT count(*) FROM "ConversaoUnidadeCompra" WHERE fator > 0)         AS conversoes_no_app,
       (SELECT count(*) FROM "CodigoCompraProduto" WHERE fator <> 1)           AS linhas_com_fator;

-- ---------------------------------------------------------------------------
-- PASSO 4 — Prova de que nada mudou: toda linha de compra casada HOJE por
-- código tem que ser respondida pela tabela nova com o MESMO produto.
--
-- Zero linhas é o resultado certo. Qualquer linha aqui é motivo para parar.
-- ---------------------------------------------------------------------------
SELECT i."codigoBruto", i."unidadeBruta", i."nomeBruto",
       p.nome AS produto_hoje,
       c."produtoId" AS produto_na_tabela_nova,
       CASE WHEN c.id IS NULL THEN 'tabela nova não responde este código'
            ELSE 'responde OUTRO produto' END AS problema
FROM "ItemNotaCompra" i
JOIN "Produto" p ON p.id = i."produtoId"
LEFT JOIN "CodigoCompraProduto" c
       ON c.origem = 'TEKNISA' AND c.codigo = i."codigoBruto" AND c."produtoId" = p.id
WHERE i."codigoBruto" IS NOT NULL
  AND p."codigoTeknisa" = i."codigoBruto"
  AND c.id IS NULL
LIMIT 50;

-- ---------------------------------------------------------------------------
-- PASSO 5 — Conversão que NÃO foi transportada, e por quê.
--
-- Esperado: só produto sem codigoTeknisa — a conversão dele continua valendo
-- pela tabela velha, que não foi apagada. Se aparecer outro motivo, pare:
-- conversão perdida faz preço de caixa virar preço de unidade, que é o erro
-- que ConversaoUnidadeCompra existe pra impedir.
-- ---------------------------------------------------------------------------
SELECT p.nome, p."unidadeMedida", p."codigoTeknisa",
       cu."unidadeCompra", cu.fator,
       CASE WHEN p."codigoTeknisa" IS NULL THEN 'produto sem código — parear antes'
            WHEN cu."unidadeCompra" = p."unidadeMedida" THEN 'conversão redundante (mesma unidade do produto)'
            ELSE 'INESPERADO — investigar' END AS motivo
FROM "ConversaoUnidadeCompra" cu
JOIN "Produto" p ON p.id = cu."produtoId"
WHERE cu.fator > 0
  AND NOT EXISTS (
        SELECT 1 FROM "CodigoCompraProduto" c
        WHERE c."produtoId" = cu."produtoId"
          AND c."unidadeCompra" = cu."unidadeCompra"
          AND c.fator = cu.fator)
ORDER BY p.nome;

-- ---------------------------------------------------------------------------
-- PASSO 6 — A invariante que o banco não garante sozinho: um código pertence a
-- um produto só.
--
-- A chave única é (origem, código, unidade), então nada impede duas linhas do
-- mesmo código apontando para produtos diferentes. O núcleo puro trata isso
-- como não resolvido em vez de escolher um, mas é erro de cadastro e tem que
-- aparecer.
--
-- Zero linhas é o resultado certo. Rode de novo toda vez que cadastrar códigos
-- novos.
-- ---------------------------------------------------------------------------
SELECT c.origem, c.codigo,
       count(DISTINCT c."produtoId") AS produtos,
       string_agg(DISTINCT p.nome, ' | ' ORDER BY p.nome) AS quais
FROM "CodigoCompraProduto" c
JOIN "Produto" p ON p.id = c."produtoId"
GROUP BY c.origem, c.codigo
HAVING count(DISTINCT c."produtoId") > 1;
