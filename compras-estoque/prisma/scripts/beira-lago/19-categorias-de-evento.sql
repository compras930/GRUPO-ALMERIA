-- Dá nome ao que é evento. Um UPDATE, quatro linhas.
--
-- O QUE SE DESCOBRIU. "MENU", com 29,9% do faturamento, não era uma categoria
-- bagunçada: é UM ITEM só, `EVENTO - MENU`, R$ 378.772,14. Junto com
-- EVENTO - BEBIDAS, EVENTO - SERVICOS e EVENTO - VINHOS, são R$ 572.104,46 —
-- 45,2% do faturamento de outubro do Beira Lago.
--
-- POR QUE RENOMEAR RESOLVE DE VERDADE, e não é maquiagem:
--
--   - "BEBIDAS" com R$ 87 mil parece venda de bebida do salão, e é pacote de
--     bebida de evento. A bebida de verdade está em NÃO ALCOÓLICAS,
--     ALCOÓLICAS, CAFÉS e SUCOS. A barra mente sobre o que mede.
--   - "VINHOS" com R$ 27 mil parecia um terceiro balde de vinho ao lado de
--     Tintos e Brancos. É vinho de evento.
--   - Com o prefixo comum, as quatro ficam juntas na tela e dá para somar o
--     negócio de eventos com o olho, que hoje é impossível.
--
-- O QUE NÃO DÁ PARA FAZER: quebrar o evento em Carnes, Massas e Pescados. O
-- evento é faturado como pacote fechado e o XMenu não detalha prato a prato —
-- o dado não existe em lugar nenhum, não é questão de procurar melhor.
--
-- CASA PELO `codigoPdv`, NÃO PELO NOME. É a regra que este projeto aprendeu
-- caro: 34 vinhos não casaram por um sufixo de país, 169 linhas de venda
-- casaram por código e zero por nome. "EVENTO - SERVICOS" é exatamente o tipo
-- de texto que alguém acentua um dia.

BEGIN;

UPDATE "ItemVenda" iv
   SET categoria = m.para
  FROM (VALUES ('EVT-MENU',     'Eventos · Menu'),
               ('EVT-BEBIDAS',  'Eventos · Bebidas'),
               ('EVT-SERVICOS', 'Eventos · Serviços'),
               ('EVT-VINHOS',   'Eventos · Vinhos')) AS m(codigo, para),
       "Unidade" u
 WHERE u.nome = 'Beira Lago'
   AND iv."unidadeId" = u.id
   AND iv."codigoPdv" = m.codigo;

COMMIT;

-- CONFERÊNCIA: as quatro linhas, com o que venderam em outubro.
-- Esperado: Menu 378.772,14 · Bebidas 87.292,13 · Serviços 79.006,40 ·
-- Vinhos 27.033,79  =  572.104,46 (45,2% do mês).
SELECT iv.categoria,
       iv."codigoPdv" AS codigo,
       round(COALESCE(sum(COALESCE(ivs."valorVendido", ivs."quantidadeVendida" * iv."precoVenda")), 0)::numeric, 2) AS vendido_em_outubro
FROM "ItemVenda" iv
JOIN "Unidade" u ON u.id = iv."unidadeId" AND u.nome = 'Beira Lago'
LEFT JOIN "ItemVendaSemanal" ivs ON ivs."itemVendaId" = iv.id
LEFT JOIN "VendaSemanal" vs ON vs.id = ivs."vendaSemanalId"
  AND vs."periodoFim" >= DATE '2026-10-01' AND vs."periodoFim" < DATE '2026-11-01'
WHERE iv."codigoPdv" LIKE 'EVT-%'
GROUP BY 1, 2
ORDER BY vendido_em_outubro DESC;
