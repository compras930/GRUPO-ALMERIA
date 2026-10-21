-- Tudo em MAIÚSCULA, e Carnes/Pescados/Massas viram PRINCIPAIS.
--
-- DUAS MUDANÇAS DE NATUREZA DIFERENTE, no mesmo arquivo porque mexem no mesmo
-- campo e uma transação só evita um estado intermediário esquisito:
--
--   1. CAIXA — cosmético. Nenhum número muda; só o rótulo das barras.
--   2. PRINCIPAIS — NÃO é cosmético. Carnes, Pescados e Massas somem como
--      categorias e o dinheiro delas passa a somar em PRINCIPAIS. Em outubro
--      isso move R$ 94.560 de Carnes, R$ 74.035 de Pescados e R$ 43.765 de
--      Massas para dentro dos R$ 69.481 que PRINCIPAIS já tinha: a barra passa
--      de R$ 69 mil para cerca de R$ 282 mil, e vira a maior do salão.
--
-- É PERDA DE DETALHE, e vale dizer em voz alta: depois disto o painel não
-- responde mais "quanto a casa vendeu de carne". A curva ABC por item continua
-- respondendo item a item, e a ficha técnica continua por prato — o que se
-- perde é só o agrupamento intermediário.
--
-- O QUE NÃO FOI MEXIDO, por não ter sido pedido e por não ser óbvio: SALADAS,
-- ANTIPASTI e BAMBINOS. Salada pode ser entrada ou prato principal conforme a
-- casa, antipasti é entrada, e bambinos é menu infantil. Me diga o destino de
-- cada uma e eu incluo.

BEGIN;

-- TRAVA. `ItemVenda` tem único em (unidade, tipo, categoria, nome). Juntar
-- categorias faz itens de mesmo nome se encontrarem: se "Risoto" existir em
-- Massas E em PRINCIPAIS, o UPDATE é recusado pelo banco com uma mensagem de
-- índice que não diz qual prato é. Melhor abortar aqui, dizendo o nome.
DO $$
DECLARE conflito text;
BEGIN
  WITH alvo AS (
    SELECT iv.id, iv.tipo, iv.nome,
           CASE
             WHEN upper(btrim(iv.categoria)) IN ('CARNES', 'PESCADOS', 'MASSAS') THEN 'PRINCIPAIS'
             ELSE upper(btrim(iv.categoria))
           END AS nova
    FROM "ItemVenda" iv
    JOIN "Unidade" u ON u.id = iv."unidadeId" AND u.nome = 'Beira Lago'
    WHERE iv.categoria IS NOT NULL
  )
  SELECT string_agg(DISTINCT nome || ' (' || tipo || '/' || nova || ')', ', ')
    INTO conflito
  FROM (SELECT nova, tipo, nome FROM alvo GROUP BY nova, tipo, nome HAVING count(*) > 1) x;
  IF conflito IS NOT NULL THEN
    RAISE EXCEPTION 'Estes itens ficariam duplicados na mesma categoria: %. Me mande a lista antes de seguir.', conflito;
  END IF;
END $$;

UPDATE "ItemVenda" iv
   SET categoria = CASE
         WHEN upper(btrim(iv.categoria)) IN ('CARNES', 'PESCADOS', 'MASSAS') THEN 'PRINCIPAIS'
         ELSE upper(btrim(iv.categoria))
       END
  FROM "Unidade" u
 WHERE u.id = iv."unidadeId"
   AND u.nome = 'Beira Lago'
   AND iv.categoria IS NOT NULL
   AND iv.categoria <> CASE
         WHEN upper(btrim(iv.categoria)) IN ('CARNES', 'PESCADOS', 'MASSAS') THEN 'PRINCIPAIS'
         ELSE upper(btrim(iv.categoria))
       END;

COMMIT;

-- CONFERÊNCIA: o painel de outubro, como vai ficar.
-- PRINCIPAIS deve aparecer perto de R$ 281.841 (69.481 + 94.560 + 74.035 +
-- 43.765), e CARNES, PESCADOS e MASSAS não podem mais existir.
SELECT iv.categoria,
       count(*) AS itens,
       round(COALESCE(sum(v.faturamento), 0)::numeric, 2) AS vendido_em_outubro
FROM "ItemVenda" iv
JOIN "Unidade" u ON u.id = iv."unidadeId" AND u.nome = 'Beira Lago'
LEFT JOIN LATERAL (
  SELECT sum(COALESCE(ivs."valorVendido", ivs."quantidadeVendida" * iv."precoVenda")) AS faturamento
  FROM "ItemVendaSemanal" ivs
  JOIN "VendaSemanal" vs ON vs.id = ivs."vendaSemanalId"
  WHERE ivs."itemVendaId" = iv.id
    AND vs."periodoFim" >= DATE '2026-10-01' AND vs."periodoFim" < DATE '2026-11-01'
) v ON true
GROUP BY 1
ORDER BY vendido_em_outubro DESC;
