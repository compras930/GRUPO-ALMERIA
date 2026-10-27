-- Até que dia a compra chegou, e quando ela foi carregada.
--
-- Duas perguntas que parecem uma só e não são:
--
--   dataCompra  — o dia que está ESCRITO na nota. É o que o painel mostra.
--   criadoEm    — o dia em que a carga rodou e gravou a linha no banco.
--
-- Nota de 24/10 carregada ontem tem dataCompra 24/10 e criadoEm 26/10. Se o
-- painel para no dia 17, só há dois mundos possíveis:
--
--   A) a carga de ontem rodou e NÃO trouxe nada depois do 17
--      -> o arquivo termina no 17, ou o Teknisa ainda não lançou as notas.
--         Não é problema do app, e nada aqui conserta.
--
--   B) a carga de ontem não rodou, ou rodou e recusou tudo
--      -> aí não existe nenhuma linha com criadoEm de ontem.
--
-- A consulta 2 é a que decide entre as duas. Só LÊ.

-- =====================================================================
-- 1. OS ÚLTIMOS DIAS DE COMPRA de cada casa. Onde a série para.
-- =====================================================================
SELECT u.nome AS casa,
       max(i."dataCompra")::date AS ultimo_dia_de_nota,
       count(*) AS linhas_em_outubro,
       round(sum(i."valorTotal")::numeric, 2) AS valor_em_outubro
FROM "ItemNotaCompra" i
JOIN "NotaCompra" n ON n.id = i."notaCompraId"
JOIN "Unidade" u ON u.id = n."unidadeId"
WHERE i."dataCompra" >= DATE '2026-10-01' AND i."dataCompra" < DATE '2026-11-01'
GROUP BY u.nome
ORDER BY casa;

-- =====================================================================
-- 2. QUANDO CADA CARGA RODOU, e o que ela trouxe.
--
-- É esta que separa o mundo A do mundo B. Se não houver linha com
-- `rodou_em` = 26/10, a carga de ontem não chegou ao banco.
--
-- `dia_mais_novo_que_trouxe` é a prova do mundo A: a carga rodou ontem e o
-- dia mais novo que ela trouxe foi 17/10.
-- =====================================================================
SELECT n."criadoEm"::date AS rodou_em,
       u.nome AS casa,
       count(DISTINCT n.id) AS notas,
       count(i.id) AS linhas,
       min(i."dataCompra")::date AS dia_mais_velho_que_trouxe,
       max(i."dataCompra")::date AS dia_mais_novo_que_trouxe,
       round(sum(i."valorTotal")::numeric, 2) AS valor
FROM "NotaCompra" n
JOIN "Unidade" u ON u.id = n."unidadeId"
LEFT JOIN "ItemNotaCompra" i ON i."notaCompraId" = n.id
WHERE n."criadoEm" >= now() - interval '10 days'
GROUP BY n."criadoEm"::date, u.nome
ORDER BY rodou_em DESC, casa;

-- =====================================================================
-- 3. DIA A DIA DE OUTUBRO no Beira Lago, do 10 em diante.
--
-- Mostra se a série morre no 17 ou se tem buraco antes. Dia que simplesmente
-- não aparece é dia sem nota nenhuma.
-- =====================================================================
SELECT i."dataCompra"::date AS dia,
       count(*) AS linhas,
       round(sum(i."valorTotal")::numeric, 2) AS valor
FROM "ItemNotaCompra" i
JOIN "NotaCompra" n ON n.id = i."notaCompraId"
JOIN "Unidade" u ON u.id = n."unidadeId"
WHERE u.nome = 'Beira Lago'
  AND i."dataCompra" >= DATE '2026-10-10'
GROUP BY i."dataCompra"::date
ORDER BY dia;

-- =====================================================================
-- 4. A VENDA, para comparar: até que semana ela chegou.
--    Ela atualizou e a compra não — ver as duas lado a lado ajuda a ver se
--    foi o arquivo de compra que ficou para trás, e não a carga inteira.
-- =====================================================================
SELECT u.nome AS casa,
       vs."periodoInicio"::date AS de,
       vs."periodoFim"::date AS ate,
       vs."criadoEm"::date AS carregada_em,
       count(ivs.id) AS linhas,
       round(sum(ivs."valorVendido")::numeric, 2) AS valor
FROM "VendaSemanal" vs
JOIN "Unidade" u ON u.id = vs."unidadeId"
LEFT JOIN "ItemVendaSemanal" ivs ON ivs."vendaSemanalId" = vs.id
WHERE vs."periodoFim" >= DATE '2026-10-01'
GROUP BY u.nome, vs."periodoInicio", vs."periodoFim", vs."criadoEm"
ORDER BY casa, de;
