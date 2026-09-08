-- Remove o produto "TOTAL" e as linhas de ficha que o citam.
--
-- O que é: a planilha original tinha uma linha de somatório chamada "TOTAL" no
-- fim de cada ficha, e a importação do dashboard antigo a tratou como se fosse
-- um ingrediente. O resultado são 20 fichas (COSTELA BOVINA MARINADA, PETULAS DE
-- CEBOLA, BASE DE ESTROGONOFE, FAROFA DE MIGAS, TABULE...) exibindo na tela um
-- ingrediente chamado "TOTAL".
--
-- Custo: nenhum efeito. Todas as linhas estão com quantidade ZERO, e o cálculo
-- é quantidade × preço — some da tela sem mexer em CMV nenhum.
--
-- Por que não é só "apagar o produto": há uma guarda importante. O script só
-- apaga linha de ficha com quantidade zero, e só apaga o Produto se nada mais
-- apontar pra ele. Se aparecer uma linha com quantidade preenchida (ou uso em
-- pedido/estoque), essa linha fica, o Produto fica, e o passo de verificação
-- mostra o que sobrou pra revisão. Ou seja: se a premissa "é tudo lixo de
-- importação" estiver errada em algum caso, o script não destrói a evidência.
--
-- Casa por nome exato — nunca por LIKE 'TOTAL%', que pegaria qualquer produto
-- começando com essa palavra.
--
-- Seguro de rodar mais de uma vez. Sem BEGIN/COMMIT: o SQL Editor do Neon roda
-- cada comando em autocommit e não honra transação explícita entre eles.

-- ---------------------------------------------------------------------------
-- Passo 1 — O que existe hoje (confira antes de seguir).
-- Espere: 20 fichas, todas com quantidade zero, e zero uso operacional.
-- ---------------------------------------------------------------------------
SELECT
  p.id, p.nome, p."unidadeMedida", p.ativo,
  (SELECT count(*) FROM "IngredienteReceita" i WHERE i."produtoId" = p.id)                     AS linhas_de_ficha,
  (SELECT count(*) FROM "IngredienteReceita" i WHERE i."produtoId" = p.id AND i.quantidade <> 0) AS linhas_com_quantidade,
  (SELECT count(*) FROM "PrecoAtualProduto" x WHERE x."produtoId" = p.id)                      AS precos,
  (SELECT count(*) FROM "MovimentoEstoque" x WHERE x."produtoId" = p.id)
    + (SELECT count(*) FROM "ItemPedido" x WHERE x."produtoId" = p.id)
    + (SELECT count(*) FROM "ContagemEstoque" x WHERE x."produtoId" = p.id)
    + (SELECT count(*) FROM "EstoqueSaldo" x WHERE x."produtoId" = p.id)
    + (SELECT count(*) FROM "ItemNotaCompra" x WHERE x."produtoId" = p.id)                     AS uso_operacional
FROM "Produto" p
WHERE upper(btrim(p.nome)) = 'TOTAL';

-- Quais fichas serão limpas (pra registro).
SELECT un.nome AS casa, r.nome AS ficha, i.quantidade
FROM "IngredienteReceita" i
JOIN "Produto" p  ON p.id = i."produtoId"
JOIN "Receita" r  ON r.id = i."receitaId"
JOIN "Unidade" un ON un.id = r."unidadeId"
WHERE upper(btrim(p.nome)) = 'TOTAL'
ORDER BY un.nome, r.nome;

-- ---------------------------------------------------------------------------
-- Passo 2 — Apaga as linhas de ficha, SÓ as de quantidade zero.
-- ---------------------------------------------------------------------------
DELETE FROM "IngredienteReceita" i
USING "Produto" p
WHERE p.id = i."produtoId"
  AND upper(btrim(p.nome)) = 'TOTAL'
  AND i.quantidade = 0;

-- ---------------------------------------------------------------------------
-- Passo 3 — Apaga preço atual e histórico (o produto não existe de verdade, não
-- há histórico de compra que faça sentido preservar).
-- ---------------------------------------------------------------------------
DELETE FROM "PrecoAtualProduto" pa
USING "Produto" p
WHERE p.id = pa."produtoId" AND upper(btrim(p.nome)) = 'TOTAL';

DELETE FROM "HistoricoPrecoProduto" h
USING "Produto" p
WHERE p.id = h."produtoId" AND upper(btrim(p.nome)) = 'TOTAL';

-- ---------------------------------------------------------------------------
-- Passo 4 — Apaga o Produto, mas só se nada mais apontar pra ele. Se alguma
-- referência sobrou (linha de ficha com quantidade, pedido, movimento de
-- estoque...), o produto FICA e aparece na verificação abaixo.
-- ---------------------------------------------------------------------------
DELETE FROM "Produto" p
WHERE upper(btrim(p.nome)) = 'TOTAL'
  AND NOT EXISTS (SELECT 1 FROM "IngredienteReceita"      x WHERE x."produtoId" = p.id)
  AND NOT EXISTS (SELECT 1 FROM "PrecoAtualProduto"       x WHERE x."produtoId" = p.id)
  AND NOT EXISTS (SELECT 1 FROM "HistoricoPrecoProduto"   x WHERE x."produtoId" = p.id)
  AND NOT EXISTS (SELECT 1 FROM "EstoqueSaldo"            x WHERE x."produtoId" = p.id)
  AND NOT EXISTS (SELECT 1 FROM "MovimentoEstoque"        x WHERE x."produtoId" = p.id)
  AND NOT EXISTS (SELECT 1 FROM "ContagemEstoque"         x WHERE x."produtoId" = p.id)
  AND NOT EXISTS (SELECT 1 FROM "ItemPedido"              x WHERE x."produtoId" = p.id)
  AND NOT EXISTS (SELECT 1 FROM "ItemNotaCompra"          x WHERE x."produtoId" = p.id)
  AND NOT EXISTS (SELECT 1 FROM "ParametroEstoqueProduto" x WHERE x."produtoId" = p.id);

-- ---------------------------------------------------------------------------
-- Verificação — as duas consultas têm que voltar VAZIAS.
-- ---------------------------------------------------------------------------

-- 4a) Sobrou algum produto "TOTAL"? Se sim, é porque algo ainda aponta pra ele —
--     a coluna diz o quê, e aí é caso de revisar em vez de forçar.
SELECT p.id, p.nome, p."unidadeMedida",
       (SELECT count(*) FROM "IngredienteReceita" i WHERE i."produtoId" = p.id) AS linhas_de_ficha,
       (SELECT count(*) FROM "ItemPedido" x WHERE x."produtoId" = p.id)         AS itens_pedido,
       (SELECT count(*) FROM "MovimentoEstoque" x WHERE x."produtoId" = p.id)   AS movimentos
FROM "Produto" p
WHERE upper(btrim(p.nome)) = 'TOTAL';

-- 4b) Sobrou alguma linha de ficha apontando pra "TOTAL"?
SELECT un.nome AS casa, r.nome AS ficha, i.quantidade
FROM "IngredienteReceita" i
JOIN "Produto" p  ON p.id = i."produtoId"
JOIN "Receita" r  ON r.id = i."receitaId"
JOIN "Unidade" un ON un.id = r."unidadeId"
WHERE upper(btrim(p.nome)) = 'TOTAL';
