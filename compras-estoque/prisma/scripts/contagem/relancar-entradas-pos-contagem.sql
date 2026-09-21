-- Relança as entradas de mercadoria que chegaram DEPOIS da contagem física.
--
-- POR QUE ISTO EXISTE. A contagem SOBRESCREVE o saldo (estoque.ts, registrarContagemEmLote)
-- e a entrada de nota SOMA. As duas são carimbadas com a hora em que rodam, não com a
-- data do fato: MovimentoEstoque.criadoEm e ContagemEstoque.criadoEm são default(now()).
-- A data real da nota fica em ItemNotaCompra.dataCompra, e a data real da contagem
-- fica na cabeça de quem contou.
--
-- Consequência: carregar as compras e depois lançar a contagem (que é a ordem certa,
-- porque a contagem é a verdade) apaga as entradas de mercadoria que chegou entre o dia
-- da contagem física e o dia do lançamento. Este script devolve essas entradas.
--
-- 21/09/2026: contagem inicial do 104 Sul, contada em 18/09 (sexta) e lançada em 21/09
-- (segunda). Seis produtos tinham nota de 21/09 — mercadoria que o estoquista não viu.
--
-- IDEMPOTENTE. O id do movimento é derivado do produtoId, então rodar duas vezes cai no
-- ON CONFLICT DO NOTHING, o RETURNING não devolve linha nenhuma e o UPDATE não soma de
-- novo. É a única forma segura: somar saldo não é uma operação que se possa repetir.
--
-- RODAR DEPOIS DE LANÇAR A CONTAGEM, nunca antes — antes, a contagem apagaria isto também.

-- ---------------------------------------------------------------------------
-- 1) CONFERIR ANTES. Deve listar exatamente os produtos com nota posterior à
--    data da contagem. Se vier algo inesperado, pare aqui.
-- ---------------------------------------------------------------------------
SELECT p.nome,
       p."unidadeMedida" AS un,
       round(sum(i.quantidade)::numeric, 3) AS qtd,
       max(i."dataCompra")::date AS nota
FROM "ItemNotaCompra" i
JOIN "NotaCompra" n ON n.id = i."notaCompraId"
JOIN "Unidade" u ON u.id = n."unidadeId"
JOIN "Produto" p ON p.id = i."produtoId"
WHERE n."criadoEm" >= now() - interval '12 hours'
  AND u.nome = '104 Sul'
  AND i."dataCompra" > DATE '2026-09-18'
  AND i.quantidade IS NOT NULL
GROUP BY p.nome, p."unidadeMedida"
ORDER BY p.nome;

-- ---------------------------------------------------------------------------
-- 2) RELANÇAR. Um comando só: o movimento e o saldo andam juntos ou não andam.
--
-- Identifica o produto por produtoId, nunca por nome — existem nomes duplicados
-- no cadastro (ALFACE / Alface lisa, e vários pares que só diferem no caixa das
-- letras), e casar por nome somaria no saldo errado.
--
-- Tipo AJUSTE_MANUAL, não ENTRADA_NOTA: o ENTRADA_NOTA dessa mercadoria já existe,
-- gravado pela carga. O que se perdeu foi o efeito no saldo, não o registro. E
-- AJUSTE_MANUAL já conta como entrada no relatório de consumo (consumo.ts,
-- TIPOS_DE_ENTRADA), que é o que importa para o CMV do próximo período.
-- ---------------------------------------------------------------------------
WITH pos_contagem AS (
  SELECT i."produtoId", n."unidadeId", sum(i.quantidade) AS qtd
  FROM "ItemNotaCompra" i
  JOIN "NotaCompra" n ON n.id = i."notaCompraId"
  JOIN "Unidade" u ON u.id = n."unidadeId"
  WHERE n."criadoEm" >= now() - interval '12 hours'
    AND u.nome = '104 Sul'
    AND i."dataCompra" > DATE '2026-09-18'
    AND i."produtoId" IS NOT NULL
    AND i.quantidade IS NOT NULL
  GROUP BY i."produtoId", n."unidadeId"
),
nova AS (
  INSERT INTO "MovimentoEstoque" (id, "unidadeId", "produtoId", tipo, quantidade, observacao)
  SELECT 'reentr2109' || left(md5("produtoId"), 22),
         "unidadeId", "produtoId", 'AJUSTE_MANUAL', qtd,
         'Entrada posterior a 18/09 relancada apos a contagem inicial'
  FROM pos_contagem
  ON CONFLICT (id) DO NOTHING
  RETURNING "unidadeId", "produtoId", quantidade
)
UPDATE "EstoqueSaldo" s
SET quantidade = s.quantidade + nova.quantidade, "atualizadoEm" = now()
FROM nova
WHERE s."unidadeId" = nova."unidadeId" AND s."produtoId" = nova."produtoId";

-- ---------------------------------------------------------------------------
-- 3) VERIFICAR. Esperado: uma linha por produto do passo 1, com o saldo já somado.
-- ---------------------------------------------------------------------------
SELECT p.nome,
       m.quantidade AS relancado,
       s.quantidade AS saldo_agora
FROM "MovimentoEstoque" m
JOIN "Produto" p ON p.id = m."produtoId"
JOIN "EstoqueSaldo" s ON s."produtoId" = m."produtoId" AND s."unidadeId" = m."unidadeId"
WHERE m.observacao = 'Entrada posterior a 18/09 relancada apos a contagem inicial'
ORDER BY p.nome;
