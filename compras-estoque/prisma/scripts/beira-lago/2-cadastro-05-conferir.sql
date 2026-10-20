-- PARTE 05 de 06 — as três conferências. SÓ LEEM.
-- Rode e LEIA as três respostas antes da parte 06. A segunda (passo 3) é a
-- que pode mudar o que fazer: o que aparecer lá não deve ser cadastrado.
-- Conferência vazia é a resposta boa.

-- ---------------------------------------------------------------------------
-- 2. CONFERÊNCIA: nome+unidade que JÁ existe no catálogo.
--    Tem que voltar VAZIO. Se voltar alguma coisa, a linha devia ter casado na
--    carga e não casou — aí o problema é outro (grafia invisível, caractere
--    diferente) e cadastrar de novo esconderia o problema em vez de resolver.
-- ---------------------------------------------------------------------------
SELECT c.nome, c.unidade, p.nome AS ja_cadastrado, p."unidadeMedida"
FROM "_bl_cadastro" c
JOIN "Produto" p
  ON lower(regexp_replace(btrim(p.nome), '\s+', ' ', 'g')) = lower(c.nome)
 AND p."unidadeMedida" = c.unidade;

-- ---------------------------------------------------------------------------
-- 3. O PASSO QUE DECIDE: mesmo nome, OUTRA unidade de medida.
--    O casamento exige nome E unidade (src/lib/resolucao-produto-compra.ts,
--    passo 2 — não existe queda pra nome sozinho). Então um produto já
--    cadastrado em UND que o XMenu compra em CX não casa, e cadastrar um
--    segundo produto com o mesmo nome em CX PARTE O ESTOQUE EM DOIS: metade da
--    compra num, a contagem no outro, e o consumo de ambos sai errado.
--
--    O certo nesses casos é UM dos dois:
--      a) o cadastro está na unidade errada -> corrigir o Produto; ou
--      b) são embalagens do mesmo produto -> ConversaoUnidadeCompra
--         (produtoId, unidadeCompra, fator), e NÃO cadastrar aqui.
--    Tire do passo 5 o que aparecer aqui.
-- ---------------------------------------------------------------------------
SELECT c.nome, c.unidade AS unidade_da_compra, p."unidadeMedida" AS unidade_cadastrada,
       p.id AS produto_id, c.valor
FROM "_bl_cadastro" c
JOIN "Produto" p
  ON lower(regexp_replace(btrim(p.nome), '\s+', ' ', 'g')) = lower(c.nome)
 AND p."unidadeMedida" <> c.unidade
ORDER BY c.valor DESC;

-- ---------------------------------------------------------------------------
-- 4. PARECIDOS: mesmas duas primeiras palavras de um produto que já existe.
--    Não é erro — "QUEIJO BRIE SÃO VICENTE 1KG" e "QUEIJO BRIE" podem ser a
--    mesma coisa ou não. É a lista pra olhar com olho humano antes de criar
--    mais um "BURRATA"/"Burrata" no catálogo.
-- ---------------------------------------------------------------------------
SELECT c.nome AS a_cadastrar, c.unidade, p.nome AS parecido_ja_existente,
       p."unidadeMedida", c.valor
FROM "_bl_cadastro" c
JOIN "Produto" p
  ON lower(split_part(p.nome, ' ', 1) || ' ' || split_part(p.nome, ' ', 2))
   = lower(split_part(c.nome, ' ', 1) || ' ' || split_part(c.nome, ' ', 2))
WHERE lower(regexp_replace(btrim(p.nome), '\s+', ' ', 'g')) <> lower(c.nome)
ORDER BY c.valor DESC;

