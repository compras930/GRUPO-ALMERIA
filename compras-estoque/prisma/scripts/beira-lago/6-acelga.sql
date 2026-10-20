-- ACELGA: corrigir a unidade de LT para KG.
--
-- O QUE A CONSULTA DA FICHA MOSTROU:
--
--   casa Wine Garden | ficha RECHEIO DUMPLING | 0,22 | LT | cadastro LT | pratos (vazio)
--
-- Uma ficha só, e é sub-receita (nenhum ItemVenda aponta pra ela direto — por
-- isso `pratos` veio vazio; o passo 1 abaixo acha quem a usa).
--
-- POR QUE A TROCA É SEGURA, e isto corrige o que eu disse antes:
--
-- O custo não lê a unidade. `custoDaLinhaPura` (src/lib/receita.ts, linha 211)
-- é `quantidade * preço`, e `IngredienteReceita.unidadeMedida` é rótulo — o
-- próprio schema diz que pode diferir da unidade canônica do produto. Então
-- trocar LT por KG no cadastro NÃO mexe em nenhum número: a quantidade
-- continua 0,22, o preço do Wine Garden continua o mesmo, o custo do dumpling
-- continua idêntico. O que muda é que as 16 linhas de compra do Beira Lago,
-- que vêm em KG, passam a casar.
--
-- E 0,22 kg de acelga num recheio de dumpling é quantidade plausível; 0,22
-- "litro" de acelga não é nada.
--
-- ⚠️ RETIRAÇÃO. O arquivo 5-resolver-conflitos.sql sugeria, no passo 4,
-- descomentar um `DELETE FROM "PrecoAtualProduto"` junto com o UPDATE. NÃO
-- FAÇA ISSO. Eu escrevi aquilo antes de saber que havia uma ficha usando o
-- produto: apagar o preço do Wine Garden faria o insumo custar zero no
-- RECHEIO DUMPLING, e aí sim o custo mudaria — pra menos, caladamente, que é
-- o pior jeito. O preço fica. Se ele estiver errado, isso é assunto à parte e
-- se resolve com uma compra nova, não com um DELETE.

-- ---------------------------------------------------------------------------
-- 1. Quem usa o RECHEIO DUMPLING, e qual preço de acelga está guardado.
--    Só pra saber o tamanho do que se está mexendo. Nada aqui bloqueia a troca.
-- ---------------------------------------------------------------------------
SELECT 'quem usa a sub-receita' AS o_que,
       r2.nome AS receita_mae,
       (SELECT string_agg(iv.nome, ', ') FROM "ItemVenda" iv WHERE iv."receitaId" = r2.id) AS pratos
FROM "IngredienteReceita" ir
JOIN "Receita" r  ON r.id  = ir."subReceitaId"
JOIN "Receita" r2 ON r2.id = ir."receitaId"
WHERE r.nome = 'RECHEIO DUMPLING';

SELECT 'preco guardado' AS o_que, u.nome AS casa,
       round(pa.preco::numeric, 2) AS preco, pa."dataCompra"
FROM "PrecoAtualProduto" pa
JOIN "Unidade" u ON u.id = pa."unidadeId"
WHERE pa."produtoId" = 'cmtc03t1q00lecwgtgtvb2bdg';

-- ---------------------------------------------------------------------------
-- 2. A TROCA. Pode rodar.
--
--    Os dois UPDATE andam juntos: o do produto é o que faz a compra casar; o
--    do ingrediente é só pra ficha não continuar exibindo "0,22 LT" de uma
--    coisa que agora é quilo. O segundo não mexe em custo nenhum — é rótulo.
-- ---------------------------------------------------------------------------
BEGIN;

UPDATE "Produto"
   SET "unidadeMedida" = 'KG'
 WHERE id = 'cmtc03t1q00lecwgtgtvb2bdg'
   AND "unidadeMedida" = 'LT';

UPDATE "IngredienteReceita"
   SET "unidadeMedida" = 'KG'
 WHERE "produtoId" = 'cmtc03t1q00lecwgtgtvb2bdg'
   AND "unidadeMedida" = 'LT';

COMMIT;

-- ---------------------------------------------------------------------------
-- 3. CONFERÊNCIA. A quantidade tem que continuar 0,22 e o preço o mesmo do
--    passo 1 — se qualquer um dos dois mudou, pare.
-- ---------------------------------------------------------------------------
SELECT p.nome, p."unidadeMedida" AS unidade_do_cadastro,
       ir.quantidade, ir."unidadeMedida" AS unidade_na_ficha,
       r.nome AS ficha,
       (SELECT round(pa.preco::numeric, 2) FROM "PrecoAtualProduto" pa
         WHERE pa."produtoId" = p.id LIMIT 1) AS preco
FROM "Produto" p
LEFT JOIN "IngredienteReceita" ir ON ir."produtoId" = p.id
LEFT JOIN "Receita" r ON r.id = ir."receitaId"
WHERE p.id = 'cmtc03t1q00lecwgtgtvb2bdg';

-- Depois disto: chame POST /api/n8n/reprocessar com { "unidade": "Beira Lago" }
-- outra vez. As 16 linhas de ACELGA entram, e naoReconhecidos vai a zero.
