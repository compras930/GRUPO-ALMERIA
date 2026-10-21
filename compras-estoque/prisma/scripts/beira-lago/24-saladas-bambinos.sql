-- SALADAS vira ENTRADAS, BAMBINOS vira PRINCIPAIS.
--
-- Dois comandos: uma conferência e um UPDATE. Sem bloco DO — foi ele que
-- travou o arquivo 20 no console do Neon.
--
-- ANTIPASTI NÃO ESTÁ AQUI. Você citou os três, mas decidiu só dois, então
-- deixei antipasti como está em vez de escolher por você. Se quiser que vire
-- ENTRADAS também (é o que a palavra significa em italiano, e são R$ 6.120),
-- é só tirar o `--` das duas linhas marcadas abaixo e rodar de novo.
--
-- UMA DIFERENÇA QUE IMPORTA ENTRE OS TRÊS: SALADAS e BAMBINOS só existem no
-- cadastro antigo — o export do XMenu não os usa, então renomear aqui resolve
-- para sempre. ANTIPASTI o XMenu USA, em ITENS DO MENU >>> ANTIPASTI. Se você
-- decidir juntá-lo em ENTRADAS, o gerador de itens de venda tem que aprender
-- isso junto, senão a próxima leva traz ANTIPASTI de volta — foi assim que a
-- duplicação de TINTO/Tintos nasceu. Me avise e eu mexo no gerador no mesmo dia.

-- 1. COLISÕES. Tem que vir vazio. Se vier alguma linha, o UPDATE abaixo falha
--    (o banco recusa) e nada é gravado — me mande as linhas.
SELECT x.nova, x.tipo, x.nome, count(*) AS quantos_viram_um,
       string_agg(x.categoria, '  <>  ' ORDER BY x.categoria) AS vindos_de
FROM (
  SELECT iv.tipo, iv.nome, iv.categoria,
         CASE upper(btrim(iv.categoria))
           WHEN 'SALADAS' THEN 'ENTRADAS'
           WHEN 'BAMBINOS' THEN 'PRINCIPAIS'
           -- WHEN 'ANTIPASTI' THEN 'ENTRADAS'
           ELSE upper(btrim(iv.categoria))
         END AS nova
  FROM "ItemVenda" iv
  JOIN "Unidade" u ON u.id = iv."unidadeId" AND u.nome = 'Beira Lago'
  WHERE iv.categoria IS NOT NULL
) x
GROUP BY x.nova, x.tipo, x.nome
HAVING count(*) > 1;

-- 2. O UPDATE. Esperado: 2 categorias somem.
--    ENTRADAS   79.689 + 4.038 (Saladas)  = 83.727
--    PRINCIPAIS 281.841 + 4.745 (Bambinos) = 286.586
UPDATE "ItemVenda" iv
   SET categoria = CASE upper(btrim(iv.categoria))
         WHEN 'SALADAS' THEN 'ENTRADAS'
         WHEN 'BAMBINOS' THEN 'PRINCIPAIS'
         -- WHEN 'ANTIPASTI' THEN 'ENTRADAS'
         ELSE upper(btrim(iv.categoria))
       END
  FROM "Unidade" u
 WHERE u.id = iv."unidadeId"
   AND u.nome = 'Beira Lago'
   AND upper(btrim(iv.categoria)) IN ('SALADAS', 'BAMBINOS');
