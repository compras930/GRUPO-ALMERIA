-- Unificação das categorias de venda — passo 2 de 2: GRAVAR.
--
-- Conferido no passo 1: 72 itens em cinco categorias MAIÚSCULAS, R$ 101.439,10
-- de venda em outubro, e ZERO colisões. Todos os 72 têm `codigoPdv`, ou seja, a
-- convenção maiúscula veio inteira da carga do XMenu — nenhum item do cadastro
-- antigo usa maiúscula, e nenhum item do XMenu usa Capitalizada. As duas
-- convenções são as duas origens, exatamente.
--
-- FICA A CAPITALIZADA, que é a do cadastro antigo e a mais legível no painel.
--
-- ISTO SOZINHO NÃO RESOLVE PARA SEMPRE. A maiúscula veio do campo `grupo` do
-- export, pelo gerador prisma/scripts/beira-lago/gerar-itens-venda.ts. Se o
-- gerador não normalizar, a próxima leva de itens novos traz MAIÚSCULA de volta
-- e a duplicação renasce. O gerador foi corrigido no mesmo commit que este
-- arquivo; se você cadastrar item por outro caminho, normalize lá também.
--
-- RODAR DUAS VEZES É SEGURO: depois da primeira não existe mais categoria
-- maiúscula para casar, e os UPDATEs não encontram linha.

BEGIN;

CREATE TEMP TABLE _mapa(de text, para text) ON COMMIT DROP;
INSERT INTO _mapa VALUES
  ('TINTO', 'Tintos'),
  ('BRANCO', 'Brancos'),
  ('ESPUMANTE', 'Espumante'),
  ('ROSÉ', 'Rosé'),
  ('ENTRADAS', 'Entradas');

-- TRAVA. O passo 1 disse que não há colisão, mas entre aquela consulta e esta
-- transação pode ter entrado carga nova. Se colidir, o UPDATE seria recusado
-- pelo banco de qualquer jeito, com uma mensagem de violação de índice que não
-- diz qual item é. Melhor abortar aqui, dizendo o nome.
DO $$
DECLARE conflito text;
BEGIN
  SELECT string_agg(DISTINCT origem.nome, ', ') INTO conflito
  FROM _mapa m
  JOIN "Unidade" u ON u.nome = 'Beira Lago'
  JOIN "ItemVenda" origem ON origem."unidadeId" = u.id AND btrim(origem.categoria) = m.de
  JOIN "ItemVenda" destino
    ON destino."unidadeId" = u.id
   AND btrim(destino.categoria) = m.para
   AND destino.tipo = origem.tipo
   AND destino.nome = origem.nome
   AND destino.id <> origem.id;
  IF conflito IS NOT NULL THEN
    RAISE EXCEPTION 'Estes itens existem nas duas categorias e colidiriam: %. Rode o 17-categorias-1 e me mande o resultado.', conflito;
  END IF;
END $$;

UPDATE "ItemVenda" iv
   SET categoria = m.para
  FROM _mapa m, "Unidade" u
 WHERE u.nome = 'Beira Lago'
   AND iv."unidadeId" = u.id
   AND btrim(iv.categoria) = m.de;

COMMIT;

-- =====================================================================
-- CONFERÊNCIA. As categorias maiúsculas não podem mais existir, e as
-- Capitalizadas têm que ter engordado exatamente o que elas tinham.
--
-- Esperado depois de rodar:
--   Tintos    = 41.697,03 + 28.780,23 = 70.477,26
--   Brancos   = 30.755,00 + 14.147,00 = 44.902,00
--   Entradas  = 26.231,07 + 53.458,00 = 79.689,07
--   Espumante =  2.219,00 +  1.795,00 =  4.014,00
--   Rosé      =    537,00 +  1.650,00 =  2.187,00
-- =====================================================================
SELECT COALESCE(iv.categoria, '(nulo)') AS categoria,
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
WHERE upper(btrim(iv.categoria)) IN ('TINTO', 'TINTOS', 'BRANCO', 'BRANCOS', 'ESPUMANTE', 'ESPUMANTES', 'ROSÉ', 'ROSE', 'ENTRADA', 'ENTRADAS')
GROUP BY 1
ORDER BY vendido_em_outubro DESC;
