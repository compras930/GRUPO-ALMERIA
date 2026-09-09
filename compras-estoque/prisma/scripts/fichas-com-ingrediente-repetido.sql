-- SÓ LEITURA. Lista as fichas que citam o MESMO ingrediente mais de uma vez, com
-- o custo que cada linha adiciona — pra a cozinha decidir caso a caso.
--
-- É o item "57 combinações receita × ingrediente duplicadas" do briefing
-- original, agora quantificado: 57 combinações em 33 fichas.
--
-- POR QUE NÃO TEM CORREÇÃO AUTOMÁTICA. A primeira leitura óbvia — "linha
-- repetida com a mesma quantidade é duplicidade, apaga uma" — não sobrevive ao
-- dado. Exemplo real, BASE CROQUE em 104 Sul, 15 linhas e 8 ingredientes:
--
--   FONDUTA DE PARMESÃO      85 + 85     (iguais)
--   MOSTARDA DIJON           20 + 20     (iguais)
--   Manteiga sem sal          5 + 5      (iguais)
--   Presunto royal           25 + 25     (iguais)
--   PÃO DE FORMA RÚSTICO      2 + 2      (iguais)
--   QUEIJO PARMESÃO RALADO   12 + 12     (iguais)
--   QUEIJO MUÇARELA          40 + 60     (DIFERENTES)
--   QUEIJO GRUYERE RALADO    40          (uma vez só)
--
-- Se fosse a ficha importada duas vezes, o gruyere apareceria duas vezes e a
-- muçarela teria a mesma quantidade nas duas. Os ids das 15 linhas são
-- sequenciais — entraram numa única passada, ou seja, o dado de ORIGEM já vinha
-- assim. O formato tem cara de duas variantes do croque concatenadas numa ficha
-- só: uma com gruyere e 40 g de muçarela, outra com 60 g.
--
-- Nesse caso, apagar "a linha repetida" apagaria metade de uma receita legítima.
-- E não é exceção: 27 das 57 combinações têm quantidade DIFERENTE entre as
-- linhas. Por isso este arquivo é relatório, não correção.
--
-- Como ler a coluna `leitura`:
--   'quantidades iguais'     -> pode ser duplicidade (apagar uma) OU dois usos
--                               reais do mesmo ingrediente no preparo (somar).
--                               Só quem faz o prato sabe.
--   'quantidades diferentes' -> quase certamente não é duplicidade. Ou são dois
--                               momentos distintos do preparo, ou a ficha reúne
--                               duas variantes que precisam ser separadas.
--
-- A coluna `custo_total_hoje` é o que o sistema está contando somando todas as
-- linhas. Se a decisão for "apagar uma", o custo cai; se for "somar", já está
-- certo. É a coluna que diz quanto está em jogo em cada caso.

SELECT
  un.nome                                            AS casa,
  r.nome                                             AS ficha,
  COALESCE(p.nome, sr.nome)                          AS ingrediente,
  CASE WHEN i."produtoId" IS NOT NULL THEN 'INSUMO' ELSE 'SUBRECEITA' END AS tipo,
  count(*)                                           AS linhas,
  string_agg(i.quantidade::text, ' + ' ORDER BY i.quantidade) AS quantidades,
  CASE WHEN count(DISTINCT i.quantidade) = 1
       THEN 'quantidades iguais'
       ELSE 'quantidades diferentes' END             AS leitura,
  -- custo somado de todas as linhas dessa combinação, como o sistema conta hoje.
  -- Para INSUMO: quantidade × preço na casa. Para SUBRECEITA: quantidade ÷
  -- rendimento × custo do lote (só o primeiro nível; se a sub-receita tiver
  -- outras sub-receitas dentro, o número aqui é piso, não total).
  round(sum(
    CASE
      WHEN i."produtoId" IS NOT NULL THEN
        i.quantidade * COALESCE((
          SELECT pa.preco FROM "PrecoAtualProduto" pa
          WHERE pa."produtoId" = i."produtoId" AND pa."unidadeId" = r."unidadeId"
        ), 0)
      ELSE
        i.quantidade * COALESCE((
          SELECT sum(ing.quantidade * COALESCE(pa2.preco, 0))
          FROM "IngredienteReceita" ing
          LEFT JOIN "PrecoAtualProduto" pa2
                 ON pa2."produtoId" = ing."produtoId" AND pa2."unidadeId" = r."unidadeId"
          WHERE ing."receitaId" = sr.id
        ), 0) / NULLIF(COALESCE(sr."rendimentoQtd", 1), 0)
    END
  )::numeric, 2)                                     AS custo_total_hoje
FROM "IngredienteReceita" i
JOIN "Receita" r  ON r.id = i."receitaId"
JOIN "Unidade" un ON un.id = r."unidadeId"
LEFT JOIN "Produto" p  ON p.id = i."produtoId"
LEFT JOIN "Receita" sr ON sr.id = i."subReceitaId"
GROUP BY un.nome, r.nome, i."receitaId", i."produtoId", i."subReceitaId", sr.id,
         COALESCE(p.nome, sr.nome),
         CASE WHEN i."produtoId" IS NOT NULL THEN 'INSUMO' ELSE 'SUBRECEITA' END
HAVING count(*) > 1
ORDER BY custo_total_hoje DESC, un.nome, r.nome;

-- ---------------------------------------------------------------------------
-- Resumo, pra dimensionar antes de ler as 57 linhas.
-- ---------------------------------------------------------------------------
WITH repetidos AS (
  SELECT i."receitaId", i."produtoId", i."subReceitaId",
         count(*) AS vezes, count(DISTINCT i.quantidade) AS qtds_distintas
  FROM "IngredienteReceita" i
  GROUP BY 1,2,3 HAVING count(*) > 1
)
SELECT
  count(*)                                          AS combinacoes_repetidas,
  count(DISTINCT "receitaId")                       AS fichas_afetadas,
  count(*) FILTER (WHERE qtds_distintas = 1)        AS quantidades_iguais,
  count(*) FILTER (WHERE qtds_distintas > 1)        AS quantidades_diferentes,
  count(*) FILTER (WHERE "subReceitaId" IS NOT NULL) AS em_subreceita
FROM repetidos;
