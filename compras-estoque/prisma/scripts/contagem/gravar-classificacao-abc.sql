-- Grava a classe ABC e o grupo de rodízio de cada produto em
-- ParametroEstoqueProduto, pra tela de contagem saber quais são os itens da
-- semana. Trocar '104 Sul' pelo nome da casa.
--
-- É a MESMA conta da curva (curva-abc-e-blocos.sql), agora escrevendo em vez
-- de só listar — de propósito: se a planilha que vai pra cozinha e a tela que
-- recebe o lançamento saíssem de classificações calculadas em lugares
-- diferentes, uma hora divergiriam e ninguém saberia qual está certa.
--
-- Idempotente e re-executável: pode (e deve) rodar de novo quando a compra do
-- mês mudar o quadro. Item que saiu da curva A/B perde a marca no passo 1 e
-- não volta no passo 2 — senão ele ficaria no rodízio pra sempre.
--
-- ATENÇÃO à ordem: se o passo 2 falhar depois do passo 1, a casa fica sem
-- classificação nenhuma até você rodar de novo. Rode os dois juntos.

-- ---------------------------------------------------------------------------
-- 1) Limpa a classificação atual desta despensa.
-- ---------------------------------------------------------------------------
UPDATE "ParametroEstoqueProduto"
SET "classeAbc" = NULL, "grupoContagem" = NULL
WHERE "unidadeId" = (SELECT COALESCE(u."estoqueEmId", u.id) FROM "Unidade" u WHERE u.nome = '104 Sul');

-- ---------------------------------------------------------------------------
-- 2) Recalcula e grava. Curva A em 2 grupos, curva B em 4 — ver
--    src/lib/contagem-rotacao.ts, que é quem lê isto do outro lado.
-- ---------------------------------------------------------------------------
WITH alvo AS (
  SELECT COALESCE(u."estoqueEmId", u.id) AS id FROM "Unidade" u WHERE u.nome = '104 Sul'
),
consumo AS (
  SELECT i."produtoId", sum(i."valorTotal") AS valor
  FROM "ItemNotaCompra" i
  JOIN "NotaCompra" n  ON n.id = i."notaCompraId"
  JOIN "Produto" p     ON p.id = i."produtoId"
  WHERE n."unidadeId" = (SELECT id FROM alvo)
    AND i."valorTotal" IS NOT NULL
    AND p.nome !~* '(TAMPA|SACO |SACOLA|EMBALAGEM|POTE |GUARDANAPO|PAPEL TOALHA|PAPEL HIGIENICO|PANO MULTIUSO|PLASTICO FILME|BOBINA|DISCO ISOPOR|CANUDO|BB PIC|DIVISORIA|KIT GARFO|BANDEJA|GARRAFA TRANSP|ETIQUETA|PERSONALIZA)'
    AND p.nome !~* '(DETERGENTE|DESINFETANTE|ALCOOL|SANITARIA|SACTIF|SUMA |MAX DET|SECANTE|PASTILHA RATIONAL|LUVA |TOUCA|AVENTAL|VASSOURA|RODO |ESPONJA|PULVERIZADOR|HIGIENIZADOR|SABONETE|ENXAGUANTE|FIO DENTAL|CABO MADEIRA|PA PARA LIXO)'
  GROUP BY i."produtoId"
),
acumulado AS (
  SELECT "produtoId", valor,
         sum(valor) OVER (ORDER BY valor DESC, "produtoId") / NULLIF(sum(valor) OVER (), 0) AS ate_aqui
  FROM consumo
),
classificado AS (
  SELECT *, CASE WHEN ate_aqui <= 0.80 THEN 'A' WHEN ate_aqui <= 0.95 THEN 'B' ELSE 'C' END AS classe
  FROM acumulado
),
numerado AS (
  SELECT *, row_number() OVER (PARTITION BY classe ORDER BY valor DESC, "produtoId") AS pos_na_classe
  FROM classificado
)
INSERT INTO "ParametroEstoqueProduto" (id, "unidadeId", "produtoId", "classeAbc", "grupoContagem")
SELECT 'ctg' || left(md5((SELECT id FROM alvo) || n."produtoId"), 22),
       (SELECT id FROM alvo),
       n."produtoId",
       n.classe,
       CASE n.classe
         WHEN 'A' THEN ((n.pos_na_classe - 1) % 2) + 1
         WHEN 'B' THEN ((n.pos_na_classe - 1) % 4) + 1
       END
FROM numerado n
WHERE n.classe IN ('A', 'B')
ON CONFLICT ("unidadeId", "produtoId") DO UPDATE
  SET "classeAbc" = EXCLUDED."classeAbc",
      "grupoContagem" = EXCLUDED."grupoContagem";

-- ---------------------------------------------------------------------------
-- VERIFICAÇÃO. Esperado no 104 Sul: A/1 com 28, A/2 com 27, e B/1..4 com 17.
-- ---------------------------------------------------------------------------
SELECT "classeAbc" AS classe, "grupoContagem" AS grupo, count(*) AS produtos
FROM "ParametroEstoqueProduto"
WHERE "unidadeId" = (SELECT COALESCE(u."estoqueEmId", u.id) FROM "Unidade" u WHERE u.nome = '104 Sul')
  AND "classeAbc" IS NOT NULL
GROUP BY 1, 2
ORDER BY 1, 2;
