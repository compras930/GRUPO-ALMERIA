-- O 20 gravou? SÓ LÊ.
--
-- Separa "o UPDATE não rodou" de "rodou e a tela está em cache". São dois
-- problemas diferentes com a mesma aparência, e tratá-los como um só faz
-- perder tempo no lugar errado.
SELECT count(*) FILTER (WHERE iv.categoria <> upper(iv.categoria)) AS ainda_tem_minuscula,
       count(*) FILTER (WHERE upper(btrim(iv.categoria)) IN ('CARNES', 'PESCADOS', 'MASSAS')) AS ainda_tem_carnes_pescados_massas,
       count(*) FILTER (WHERE upper(btrim(iv.categoria)) = 'PRINCIPAIS') AS em_principais,
       count(*) AS itens_com_categoria
FROM "ItemVenda" iv
JOIN "Unidade" u ON u.id = iv."unidadeId" AND u.nome = 'Beira Lago'
WHERE iv.categoria IS NOT NULL;

-- E as categorias como estão agora, para comparar com a tela.
SELECT iv.categoria, count(*) AS itens
FROM "ItemVenda" iv
JOIN "Unidade" u ON u.id = iv."unidadeId" AND u.nome = 'Beira Lago'
WHERE iv.categoria IS NOT NULL
GROUP BY 1
ORDER BY 1;
