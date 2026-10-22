-- Corrige o fator do Aperol, e confere TODAS as conversões de uma vez.
--
-- O QUE ESTAVA ERRADO. Cadastramos 1 LT = 1,3333 garrafas pela conta de
-- 1000ml / 750ml, supondo que a linha em LT fosse um litro. As notas dizem
-- outra coisa: as quantidades são 6, 6, 12 e 6 — isso são GARRAFAS, ninguém
-- compra 6 litros de Aperol, e o próprio nome do produto diz 750ML. O preço por
-- "LT" (R$ 52 a R$ 60) bate com o preço por garrafa no Wine Garden (R$ 48 a
-- R$ 54); fosse litro de verdade, a garrafa sairia a R$ 39-45, abaixo de
-- qualquer compra do grupo.
--
-- O ESTRAGO É NOS DOIS LADOS, porque o app aplica o fator duas vezes em
-- sentidos opostos (src/lib/nota-compra.ts):
--
--     quantidade que entra = quantidade da nota x fator
--     preço por unidade    = preço da nota / fator
--
-- Com 1,3333: entraram 40 garrafas onde havia 30, e o custo ficou R$ 44,80 em
-- vez de R$ 59,74. O estoque infla 33% e o CMV de todo drink com Aperol
-- desinfla 25% — e desinflar custo é o erro perigoso, porque faz o drink
-- parecer mais lucrativo do que é.
--
-- Rode os passos na ordem. O 1 só lê.

-- =====================================================================
-- PASSO 1 — TODAS as conversões cadastradas, com a prova ao lado.
--
-- Não só o Aperol: se uma conversão nasceu de uma conta de volume em vez de
-- olhar a nota, as outras podem ter o mesmo defeito.
--
-- COMO LER `preco_por_unidade_na_nota`: é o que o fornecedor cobrou por cada
-- unidade ESCRITA na nota. Se ele for parecido com o preço de uma embalagem
-- inteira, o fator certo é 1 — a unidade está só mal escrita.
-- =====================================================================
SELECT p.nome AS produto,
       p."unidadeMedida" AS cadastrado_em,
       c."unidadeCompra" AS unidade_na_nota,
       c.fator AS fator_hoje,
       count(i.id) AS linhas_de_nota,
       round(sum(i.quantidade)::numeric, 3) AS quantidade_crua,
       round((sum(i."valorTotal") / NULLIF(sum(i.quantidade), 0))::numeric, 2) AS preco_por_unidade_na_nota,
       round(max(pa.preco)::numeric, 2) AS preco_gravado_no_app
FROM "ConversaoUnidadeCompra" c
JOIN "Produto" p ON p.id = c."produtoId"
LEFT JOIN "ItemNotaCompra" i ON i."produtoId" = p.id
  AND upper(btrim(COALESCE(i."unidadeBruta", ''))) = upper(btrim(c."unidadeCompra"))
LEFT JOIN "PrecoAtualProduto" pa ON pa."produtoId" = p.id
GROUP BY 1, 2, 3, 4
ORDER BY produto;

-- =====================================================================
-- PASSO 2 — O CONSERTO. Três coisas, e as três são necessárias.
-- =====================================================================

-- 2a. O FATOR, para as próximas cargas. Sem isto, a nota da semana que vem
--     repete o erro.
UPDATE "ConversaoUnidadeCompra" c
   SET fator = 1
  FROM "Produto" p
 WHERE p.id = c."produtoId"
   AND upper(btrim(p.nome)) LIKE '%APEROL%'
   AND c.fator <> 1;

-- 2b. O PREÇO, que é o que mexe no CMV. Recalculado da ÚLTIMA nota, sem fator:
--     valor dividido pela quantidade como ela veio escrita.
UPDATE "PrecoAtualProduto" pa
   SET preco = v.preco_real,
       "dataCompra" = v.data
  FROM (
    SELECT DISTINCT ON (i."produtoId")
           i."produtoId",
           i."valorTotal" / NULLIF(i.quantidade, 0) AS preco_real,
           i."dataCompra" AS data
    FROM "ItemNotaCompra" i
    JOIN "Produto" p ON p.id = i."produtoId"
    WHERE upper(btrim(p.nome)) LIKE '%APEROL%'
      AND i.quantidade > 0
    ORDER BY i."produtoId", i."dataCompra" DESC
  ) v
 WHERE pa."produtoId" = v."produtoId";

-- 2c. O SALDO, tirando as garrafas que nunca existiram: para cada linha, a
--     diferença entre o que entrou (qtd x 1,3333) e o que deveria ter entrado
--     (qtd). São 30 x 0,3333 = 10 garrafas de estoque fantasma.
--
--     A contagem de segunda-feira sobrescreve o saldo de qualquer jeito, então
--     isto só importa até lá — mas até lá a lista de compra usa este número.
UPDATE "EstoqueSaldo" s
   SET quantidade = s.quantidade - v.excesso
  FROM (
    SELECT i."produtoId", n."unidadeId", sum(i.quantidade * (1.3333 - 1)) AS excesso
    FROM "ItemNotaCompra" i
    JOIN "NotaCompra" n ON n.id = i."notaCompraId"
    JOIN "Produto" p ON p.id = i."produtoId"
    WHERE upper(btrim(p.nome)) LIKE '%APEROL%'
      AND upper(btrim(COALESCE(i."unidadeBruta", ''))) = 'LT'
    GROUP BY 1, 2
  ) v
 WHERE s."produtoId" = v."produtoId" AND s."unidadeId" = v."unidadeId";

-- =====================================================================
-- PASSO 3 — CONFERÊNCIA. `fator` tem que ser 1 e `preco` perto de R$ 59,87.
-- =====================================================================
SELECT p.nome, c.fator, round(pa.preco::numeric, 2) AS preco,
       round(s.quantidade::numeric, 2) AS saldo
FROM "Produto" p
LEFT JOIN "ConversaoUnidadeCompra" c ON c."produtoId" = p.id
LEFT JOIN "PrecoAtualProduto" pa ON pa."produtoId" = p.id
LEFT JOIN "EstoqueSaldo" s ON s."produtoId" = p.id
WHERE upper(btrim(p.nome)) LIKE '%APEROL%';
