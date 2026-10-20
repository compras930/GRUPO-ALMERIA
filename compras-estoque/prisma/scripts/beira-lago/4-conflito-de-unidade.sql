-- Os produtos que o cadastro deixou de fora por conflito de unidade: quem usa,
-- onde, e o que custa decidir errado.
--
-- SÓ LÊ.
--
-- CONTEXTO. O catálogo de Produto é ÚNICO para o Grupo (não tem unidadeId) —
-- o que varia por casa é preço, saldo e parâmetro. Então estes produtos já são
-- usados pelas casas do Teknisa, e tanto mudar a unidade de medida quanto
-- criar um irmão em outra unidade mexe com elas, não só com o Beira Lago.
--
-- Por isso o `2-cadastro-06-gravar.sql` não decide: ele tira da lista e deixa
-- a linha voltar como "não reconhecida" na carga. Linha não reconhecida é
-- visível e cobra decisão; produto partido em dois não cobra nada de ninguém.
--
-- AS DUAS SAÍDAS:
--
--   a) São EMBALAGENS DO MESMO produto (1 LT de Aperol = 1,333 garrafas de
--      750ml). Aí é ConversaoUnidadeCompra (produtoId, unidadeCompra, fator),
--      onde `fator` = quanto da unidade DO PRODUTO cabe em UMA unidade DE
--      COMPRA. O app multiplica a quantidade por ele e DIVIDE o preço —
--      ver resolverLinhaCompraPura em src/lib/resolucao-produto-compra.ts.
--      Nada no cadastro existente muda, e as outras casas não sentem nada.
--
--   b) A unidade do CADASTRO está errada (ACELGA em LT não existe). Aí é
--      corrigir o Produto — mas só depois de olhar o passo 3 abaixo, porque
--      trocar a unidade de um produto reinterpreta, em silêncio, todo preço,
--      saldo e ficha que já existem nele.

-- ---------------------------------------------------------------------------
-- 1. Os conflitos: o que a compra manda contra o que está cadastrado.
--    Sai da tabela de trabalho, então rode depois das partes 01 a 04.
-- ---------------------------------------------------------------------------
SELECT c.nome,
       c.unidade       AS unidade_da_compra,
       c.unidade_bruta AS como_o_xmenu_escreve,
       p."unidadeMedida" AS unidade_cadastrada,
       p.id            AS produto_id,
       c.linhas, c.valor, c.ultima AS ultima_compra
FROM "_bl_cadastro" c
JOIN "Produto" p
  ON lower(regexp_replace(btrim(p.nome), '\s+', ' ', 'g')) = lower(c.nome)
 AND p."unidadeMedida" <> c.unidade
ORDER BY c.valor DESC;

-- ---------------------------------------------------------------------------
-- 2. Quem já usa esses produtos. É o que diz se dá pra mexer na unidade.
--
--    `fichas` > 0 é o sinal de parar: a quantidade na ficha está escrita NA
--    UNIDADE CADASTRADA, e o custo é quantidade x preço sem converter nada.
--    Trocar KG por UND ali muda o custo de todo prato que usa o insumo, sem
--    pedir licença e sem deixar rastro.
-- ---------------------------------------------------------------------------
SELECT p.nome, p."unidadeMedida", p.id,
       (SELECT count(*) FROM "IngredienteReceita" ir WHERE ir."produtoId" = p.id)   AS fichas,
       (SELECT count(*) FROM "PrecoAtualProduto" pa WHERE pa."produtoId" = p.id)    AS casas_com_preco,
       (SELECT count(*) FROM "EstoqueSaldo" es
         WHERE es."produtoId" = p.id AND es.quantidade <> 0)                        AS casas_com_saldo,
       (SELECT count(*) FROM "ContagemEstoque" ce WHERE ce."produtoId" = p.id)      AS contagens,
       (SELECT count(*) FROM "ItemNotaCompra" inc WHERE inc."produtoId" = p.id)     AS linhas_de_compra
FROM "Produto" p
WHERE EXISTS (
  SELECT 1 FROM "_bl_cadastro" c
  WHERE lower(regexp_replace(btrim(p.nome), '\s+', ' ', 'g')) = lower(c.nome)
    AND p."unidadeMedida" <> c.unidade
);

-- ---------------------------------------------------------------------------
-- 3. O preço que cada casa tem hoje para esses produtos, com a unidade.
--    É a conferência de sanidade da conversão: se o Aperol está a R$ 78 a
--    garrafa (UND) e a compra vem a R$ 78 o litro (LT), uma das duas está
--    errada — e o fator vai carimbar a errada como verdade.
-- ---------------------------------------------------------------------------
SELECT p.nome, p."unidadeMedida", u.nome AS casa,
       round(pa.preco::numeric, 2) AS preco_atual, pa."dataCompra"
FROM "PrecoAtualProduto" pa
JOIN "Produto" p ON p.id = pa."produtoId"
JOIN "Unidade" u ON u.id = pa."unidadeId"
WHERE EXISTS (
  SELECT 1 FROM "_bl_cadastro" c
  WHERE lower(regexp_replace(btrim(p.nome), '\s+', ' ', 'g')) = lower(c.nome)
    AND p."unidadeMedida" <> c.unidade
)
ORDER BY p.nome, u.nome;

-- ---------------------------------------------------------------------------
-- 4. A SAÍDA (a), quando for conversão. NÃO RODE sem preencher.
--
--    `fator` = quanto da unidade DO PRODUTO cabe em UMA unidade DE COMPRA.
--      produto em UND (garrafa de 750ml), compra em LT  -> 1 / 0,750 = 1,3333
--      produto em KG, compra em CX de 10kg              -> 10
--
--    A unidade de compra vai NORMALIZADA (PCT já virou CX) — é assim que o
--    app procura. Ver SINONIMO_UNIDADE.
-- ---------------------------------------------------------------------------
-- INSERT INTO "ConversaoUnidadeCompra" (id, "produtoId", "unidadeCompra", fator)
-- VALUES
--   ('conv-aperol-lt', '<produto_id do passo 1>', 'LT', 1.3333)
-- ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. A SAÍDA (b), quando a unidade do cadastro estiver errada. NÃO RODE sem
--    ter visto `fichas` = 0 e `contagens` = 0 no passo 2.
--
--    Com ficha ou contagem existindo, isto não é um UPDATE: é uma mudança de
--    significado de números que já foram usados. Aí a conversa é outra.
-- ---------------------------------------------------------------------------
-- UPDATE "Produto" SET "unidadeMedida" = '<a certa>' WHERE id = '<produto_id>';
