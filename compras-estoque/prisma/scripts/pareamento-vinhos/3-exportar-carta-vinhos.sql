-- A carta de vinhos do Wine Garden: o que a casa VENDE.
--
-- OPCIONAL, mas muda a qualidade da planilha. Num bar de vinho a garrafa
-- comprada é a garrafa vendida — não há ficha técnica que transforme uma coisa
-- na outra. Então, para cada vinho que a compra trouxe, existem três estados
-- possíveis, e eles pedem ações diferentes:
--
--   1. tem Produto e tem ItemVenda ligados     -> só falta o código do Teknisa
--   2. tem ItemVenda, não tem Produto          -> criar o Produto e ligar a
--      receita do vinho nele, senão o vinho vende sem custo nenhum
--   3. não tem nem um nem outro                -> vinho novo na casa
--
-- Sem esta lista o script só distingue "achei produto" de "não achei", e o
-- caso 2 — que é o mais comum numa casa cuja carta foi importada do dashboard
-- antigo — fica invisível.
--
-- Exporte como CSV e guarde como `carta.csv`.

SELECT iv.id,
       iv.nome,
       iv."codigoPdv"  AS codigo_pdv,
       iv."precoVenda" AS preco_venda,
       iv."receitaId"  AS receita_id,
       iv.ativo
FROM "ItemVenda" iv
JOIN "Unidade" u ON u.id = iv."unidadeId"
WHERE u.nome = 'Wine Garden'
  AND iv.tipo = 'VINHO'
ORDER BY iv.nome;
