-- Diagnóstico: QUE CATEGORIAS existem, quanto cada uma pesa, e quantos itens
-- ela coloca na folha de contagem hoje.
--
-- Só leitura. Serve para ajustar a lista de src/lib/escopo-contagem.ts com o
-- vocabulário real das quatro casas, em vez de adivinhar nome de categoria.
--
-- Sem bloco DO $$ ... $$: o console do Neon falha nele calado.

-- 1. Todas as categorias da compra dos últimos 3 meses, por casa, com o valor
--    e quantos produtos daquela categoria estão hoje na curva A ou B.
SELECT u.nome                                       AS casa,
       coalesce(nullif(trim(p.categoria), ''), '(sem categoria)') AS categoria,
       count(DISTINCT p.id)                         AS produtos,
       round(sum(coalesce(i."valorTotal", i.quantidade * i."precoUnitNovo"))::numeric, 2) AS comprado,
       count(DISTINCT p.id) FILTER (WHERE pe."classeAbc" IN ('A', 'B')) AS na_folha_hoje
  FROM "ItemNotaCompra" i
  JOIN "NotaCompra" n ON n.id = i."notaCompraId"
  JOIN "Unidade"    u ON u.id = n."unidadeId"
  JOIN "Produto"    p ON p.id = i."produtoId"
  LEFT JOIN "ParametroEstoqueProduto" pe
         ON pe."produtoId" = p.id AND pe."unidadeId" = n."unidadeId"
 WHERE i."dataCompra" >= date_trunc('month', now()) - interval '2 months'
 GROUP BY 1, 2
 ORDER BY 1, comprado DESC;

-- 2. O que está na folha HOJE e NÃO é insumo pela régua nova — a lista que a
--    aplicação da curva vai tirar. Confira antes de aplicar.
SELECT u.nome AS casa,
       coalesce(nullif(trim(p.categoria), ''), '(sem categoria)') AS categoria,
       p.nome AS produto,
       pe."classeAbc"
  FROM "ParametroEstoqueProduto" pe
  JOIN "Produto" p ON p.id = pe."produtoId"
  JOIN "Unidade" u ON u.id = pe."unidadeId"
 WHERE pe."classeAbc" IN ('A', 'B')
   -- `translate` em vez de unaccent: a extensão unaccent pode não estar
   -- instalada no banco, e a consulta falharia por isso e não pelo dado.
   AND upper(translate(coalesce(p.categoria, ''), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')) IN (
       'ATIVO IMOBILIZADO', 'ATIVO IMOBILIZADO CONSUMO', 'IMOBILIZADO',
       'MOVEIS E UTENSILIOS', 'ENXOVAL', 'EQUIPAMENTOS',
       'TAXAS', 'TAXA', 'SERVICOS', 'SERVICO', 'MANUTENCAO',
       'UTILIDADE PUBLICA', 'ALUGUEL', 'MARKETING',
       'MATERIAL DE ESCRITORIO', 'UNIFORME'
   )
 ORDER BY 1, 2, 3;
