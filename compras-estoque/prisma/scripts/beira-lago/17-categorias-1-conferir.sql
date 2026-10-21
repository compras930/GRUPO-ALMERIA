-- Unificação das categorias de venda — passo 1 de 2: CONFERIR. SÓ LÊ.
--
-- O MAPA ABAIXO ESTÁ INCOMPLETO DE PROPÓSITO. Ele traz só os pares que dá para
-- ler no painel; a consulta 2 do 16-categorias-de-venda devolve a lista
-- inteira, inclusive pares que não aparecem no gráfico porque venderam pouco.
-- Acrescente as linhas que faltarem antes de gravar.
--
-- A CONVENÇÃO ESCOLHIDA aqui é a Capitalizada ("Tintos", "Entradas"), por ser
-- mais legível no painel. Se o pessoal do salão já lê os relatórios do XMenu em
-- MAIÚSCULA, troque a coluna `para` — é uma edição de texto, nada mais.
--
-- O QUE NÃO ESTÁ AQUI: "MENU", com 29,9% do faturamento. Não é duplicação e
-- não se resolve com mapa de nomes. Fica para depois do resultado da consulta 3.

-- O mapa, repetido nas duas consultas abaixo porque cada uma é independente.
-- =====================================================================
-- 1. O QUE MUDA, e quanto dinheiro anda junto.
-- =====================================================================
WITH mapa(de, para) AS (
  VALUES ('TINTO', 'Tintos'),
         ('BRANCO', 'Brancos'),
         ('ESPUMANTE', 'Espumante'),
         ('ROSÉ', 'Rosé'),
         ('ENTRADAS', 'Entradas')
)
SELECT m.de AS de,
       m.para AS vira,
       count(iv.id) AS itens,
       count(iv.id) FILTER (WHERE iv."codigoPdv" IS NOT NULL) AS com_codigo_pdv,
       round(COALESCE(sum(v.faturamento), 0)::numeric, 2) AS vendido_em_outubro
FROM mapa m
JOIN "Unidade" u ON u.nome = 'Beira Lago'
LEFT JOIN "ItemVenda" iv ON iv."unidadeId" = u.id AND btrim(iv.categoria) = m.de
LEFT JOIN LATERAL (
  SELECT sum(COALESCE(ivs."valorVendido", ivs."quantidadeVendida" * iv."precoVenda")) AS faturamento
  FROM "ItemVendaSemanal" ivs
  JOIN "VendaSemanal" vs ON vs.id = ivs."vendaSemanalId"
  WHERE ivs."itemVendaId" = iv.id
    AND vs."periodoFim" >= DATE '2026-10-01' AND vs."periodoFim" < DATE '2026-11-01'
) v ON true
GROUP BY 1, 2
ORDER BY vendido_em_outubro DESC;

-- =====================================================================
-- 2. A ARMADILHA: itens que vão COLIDIR.
--
-- `ItemVenda` tem chave única em (unidade, tipo, categoria, nome). Se o MESMO
-- vinho existir em "TINTO" e em "Tintos", renomear a categoria de um faz ele
-- bater de frente com o outro, e o UPDATE é RECUSADO pelo banco — a transação
-- inteira volta atrás e nada é unificado.
--
-- Não é hipótese remota: é o mesmo cadastro em duplicata que produziu os
-- produtos-fantasma, agora do lado da venda. E aqui é pior, porque cada cópia
-- pode ter histórico de venda próprio: unificar significa decidir qual fica e
-- mover a venda da outra, não só apagar.
--
-- TEM QUE VIR VAZIO. Se vier alguma linha, me mande antes de rodar o passo 2.
-- =====================================================================
WITH mapa(de, para) AS (
  VALUES ('TINTO', 'Tintos'),
         ('BRANCO', 'Brancos'),
         ('ESPUMANTE', 'Espumante'),
         ('ROSÉ', 'Rosé'),
         ('ENTRADAS', 'Entradas')
)
SELECT origem.nome AS item,
       origem.tipo,
       m.de AS categoria_de_origem,
       m.para AS categoria_de_destino,
       origem."codigoPdv" AS codigo_origem,
       destino."codigoPdv" AS codigo_destino,
       round(origem."precoVenda"::numeric, 2) AS preco_origem,
       round(destino."precoVenda"::numeric, 2) AS preco_destino,
       (SELECT count(*) FROM "ItemVendaSemanal" x WHERE x."itemVendaId" = origem.id) AS vendas_origem,
       (SELECT count(*) FROM "ItemVendaSemanal" x WHERE x."itemVendaId" = destino.id) AS vendas_destino
FROM mapa m
JOIN "Unidade" u ON u.nome = 'Beira Lago'
JOIN "ItemVenda" origem ON origem."unidadeId" = u.id AND btrim(origem.categoria) = m.de
JOIN "ItemVenda" destino
  ON destino."unidadeId" = u.id
 AND btrim(destino.categoria) = m.para
 AND destino.tipo = origem.tipo
 AND destino.nome = origem.nome
 AND destino.id <> origem.id
ORDER BY item;
