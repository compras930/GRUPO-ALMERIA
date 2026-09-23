-- O catálogo INTEIRO, com o código de cada produto.
--
-- POR QUE INTEIRO, E NÃO SÓ OS SEM CÓDIGO. Na rodada de 18/09 eu exportei só
-- os produtos com codigoTeknisa nulo e usei essa lista para responder DUAS
-- perguntas diferentes: "com o que esta compra pode casar?" e "esse nome já
-- existe?". A segunda pergunta precisa do catálogo todo, e o script gerou 151
-- criações das quais 3 colidiam com produtos que estavam fora da lista — o
-- INSERT morreu no meio, em Produto_nome_unidadeMedida_key.
--
-- A lista completa responde as duas:
--   - candidato a ligação  -> qualquer produto, com código ou sem
--   - colisão de nome      -> precisa ver os que JÁ têm código também
--   - conflito de código   -> produto que já declara OUTRO código do Teknisa
--     não pode receber este; a linha seria recusada com CONFLITO_DE_CODIGO
--     (ver src/lib/resolucao-produto-compra.ts)
--
-- Exporte como CSV e guarde como `catalogo.csv`.

SELECT p.id,
       p.nome,
       p."unidadeMedida"  AS unidade,
       p."codigoTeknisa"  AS codigo,
       p.ativo
FROM "Produto" p
ORDER BY p.nome;
