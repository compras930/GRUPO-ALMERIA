-- Quais itens impedem o 20 de rodar. SÓ LÊ.
--
-- O 20 abortou: 266 itens ainda em minúscula e 16 ainda em Carnes/Pescados/
-- Massas, de 414. A trava fez o que devia — recusou a transação inteira em vez
-- de gravar metade —, mas a mensagem dela sai como ERROR numa aba do console e
-- é fácil de passar batido. Esta consulta mostra o mesmo como TABELA.
--
-- O QUE É UMA COLISÃO. `ItemVenda` tem único em (unidade, tipo, categoria,
-- nome). Dois itens que hoje vivem em categorias diferentes e que, depois da
-- mudança, cairiam na MESMA categoria com o MESMO nome e tipo, não cabem: o
-- banco recusa.
--
-- E não é bug do cadastro — quase sempre é o mesmo prato cadastrado duas vezes,
-- um pela carga do XMenu e outro pelo cadastro antigo, exatamente como os
-- produtos-fantasma do lado da compra. Por isso a consulta traz CÓDIGO, PREÇO e
-- QUANTAS VENDAS cada lado tem: é com isso que se decide qual fica.
SELECT x.nova_categoria,
       x.tipo,
       x.nome,
       count(*) AS quantos_viram_um,
       string_agg(COALESCE(x.categoria, '(nulo)'), '  <>  ' ORDER BY x.categoria) AS vindos_de,
       string_agg(COALESCE(x."codigoPdv", 'sem código'), '  <>  ' ORDER BY x.categoria) AS codigos,
       string_agg(to_char(x."precoVenda", 'FM999990.00'), '  <>  ' ORDER BY x.categoria) AS precos,
       string_agg(x.vendas::text, '  <>  ' ORDER BY x.categoria) AS linhas_de_venda
FROM (
  SELECT iv.id, iv.tipo, iv.nome, iv.categoria, iv."codigoPdv", iv."precoVenda",
         CASE
           WHEN upper(btrim(iv.categoria)) IN ('CARNES', 'PESCADOS', 'MASSAS') THEN 'PRINCIPAIS'
           ELSE upper(btrim(iv.categoria))
         END AS nova_categoria,
         (SELECT count(*) FROM "ItemVendaSemanal" s WHERE s."itemVendaId" = iv.id) AS vendas
  FROM "ItemVenda" iv
  JOIN "Unidade" u ON u.id = iv."unidadeId" AND u.nome = 'Beira Lago'
  WHERE iv.categoria IS NOT NULL
) x
GROUP BY x.nova_categoria, x.tipo, x.nome
HAVING count(*) > 1
ORDER BY x.nova_categoria, x.nome;
