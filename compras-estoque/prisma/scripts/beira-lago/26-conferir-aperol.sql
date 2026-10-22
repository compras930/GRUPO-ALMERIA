-- O fator do Aperol no Beira Lago está certo? SÓ LÊ.
--
-- POR QUE A DÚVIDA. No Wine Garden, cinco insumos aparecem em duas unidades
-- diferentes com o MESMO preço unitário — cachaça a R$ 28,00 tanto em UN quanto
-- em LT, microverdes a R$ 16,00 em GR e em UN, rabanete a R$ 6,00 em UN e em
-- KG. Preço igual significa que a unidade está só ESCRITA errada: a quantidade
-- é a mesma coisa (a garrafa, a bandeja), só mudou o rótulo. O fator de
-- conversão nesses casos é 1.
--
-- No Beira Lago nós cadastramos 1 LT = 1,3333 garrafas de Aperol, pela conta
-- de 1000ml / 750ml. Isso só está certo se a linha em LT for mesmo um LITRO.
-- Se ela for uma garrafa com o rótulo errado — como no Wine Garden —, o fator
-- infla a quantidade em 33% toda vez que uma nota chega em LT.
--
-- COMO LER: compare `preco_por_unidade` entre as linhas em LT e em UND.
--   Perto de igual  -> a linha em LT é uma GARRAFA, e o fator certo é 1.
--   LT ~33% maior   -> a linha em LT é um LITRO mesmo, e 1,3333 está certo.
SELECT p.nome AS produto,
       p."unidadeMedida" AS cadastrado_em,
       i."unidadeBruta" AS unidade_na_nota,
       count(*) AS linhas,
       round(sum(i.quantidade)::numeric, 3) AS quantidade,
       round(sum(i."valorTotal")::numeric, 2) AS valor,
       round((sum(i."valorTotal") / NULLIF(sum(i.quantidade), 0))::numeric, 2) AS preco_por_unidade
FROM "ItemNotaCompra" i
JOIN "NotaCompra" n ON n.id = i."notaCompraId"
JOIN "Unidade" u ON u.id = n."unidadeId" AND u.nome = 'Beira Lago'
JOIN "Produto" p ON p.id = i."produtoId"
WHERE upper(btrim(p.nome)) LIKE '%APEROL%'
   OR upper(btrim(p.nome)) LIKE '%CASTANHA%'
GROUP BY 1, 2, 3
ORDER BY produto, unidade_na_nota;
