-- As duas produções do bar: xarope simples e sumo de limão. Beira Lago.
--
-- SÃO OS DOIS ITENS MAIS USADOS DO BAR INTEIRO — 21 e 22 dos 52 drinks — e
-- não existiam em lugar nenhum: a planilha de PRODUÇÕES está com as linhas em
-- branco e rendimento #DIV/0!. Nenhum drink com limão ou açúcar tinha custo.
--
-- Viram FICHA, não produto, porque não se compram: o bar produz. O insumo
-- delas é o limão e o açúcar, que são comprados — e assim, quando o limão
-- subir, os 22 drinks sobem sozinhos.
--
-- OS RENDIMENTOS VIERAM DO BAR:
--   xarope simples  1 kg de açúcar + 1 L de água  → 1,6 L
--   sumo de limão   3 kg de limão taiti           → 1 L   ← CONFIRMAR
--
-- O "1 L" DO SUMO É LEITURA MINHA, não resposta do bar: perguntei "quantos
-- quilos para quantos litros" e recebi "3 kg". 3 kg de limão taiti rendem por
-- volta de 1 litro de sumo, e por isso adotei 1 — mas é o número que divide o
-- custo em 22 drinks. Se o bar disser outro, troque o 1.0 da linha do
-- rendimento e rode de novo.
--
-- A ÁGUA FILTRADA NÃO ENTRA: não existe como produto, porque não se compra
-- água filtrada — ela sai da torneira. Custo zero, e o rendimento de 1,6 L já
-- contém o volume dela.
--
-- SEGURO REPETIR: ids próprios, nada é duplicado.

BEGIN;

-- 1. As duas fichas.
INSERT INTO "Receita" ("id", "unidadeId", "nome", "rendimentoQtd", "rendimentoUnidade", "criadoEm", "atualizadoEm")
SELECT v.id, u.id, v.nome, v.rend, 'LT', now(), now()
  FROM "Unidade" u, (VALUES
    ('recbar-xarope', 'XAROPE SIMPLES', 1.6),
    ('recbar-sumo',   'SUMO DE LIMAO',  1.0)
  ) AS v(id, nome, rend)
 WHERE u.nome = 'Beira Lago'
ON CONFLICT ("unidadeId", "nome") DO NOTHING;

-- 2. O que entra em cada uma.
INSERT INTO "IngredienteReceita" ("id", "receitaId", "produtoId", "subReceitaId", "quantidade", "unidadeMedida")
SELECT DISTINCT ON (v.id)
       v.id, r.id, pr.id, NULL, v.quantidade, pr."unidadeMedida"
  FROM (VALUES
    ('ingbar-xarope-acucar', 'XAROPE SIMPLES', 'ACUCAR REFINADO', 1.0),
    ('ingbar-sumo-limao',    'SUMO DE LIMAO',  'LIMAO TAITI',     3.0)
  ) AS v(id, chave_ficha, chave_produto, quantidade)
  JOIN "Unidade" u ON u.nome = 'Beira Lago'
  JOIN "Receita" r ON r."unidadeId" = u.id
                  AND upper(regexp_replace(translate(btrim(r.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g')) = v.chave_ficha
  JOIN "Produto" pr ON pr.ativo
                   AND upper(regexp_replace(translate(btrim(pr.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g')) = v.chave_produto
                   AND upper(btrim(pr."unidadeMedida")) IN ('KG', 'G', 'LT', 'L', 'ML')
 ORDER BY v.id, pr.id
ON CONFLICT ("id") DO UPDATE
   SET "receitaId"     = EXCLUDED."receitaId",
       "produtoId"     = EXCLUDED."produtoId",
       "quantidade"    = EXCLUDED."quantidade",
       "unidadeMedida" = EXCLUDED."unidadeMedida";

COMMIT;

-- Conferência: as duas fichas com o insumo e o custo por litro que elas
-- passam a ter. Custo zero aqui significa insumo sem preço de compra.
SELECT r.nome AS producao, r."rendimentoQtd" AS rende_litros,
       pr.nome AS insumo, i.quantidade, pr."unidadeMedida",
       (SELECT round(pa.preco::numeric, 2) FROM "PrecoAtualProduto" pa
         WHERE pa."produtoId" = pr.id LIMIT 1) AS preco_do_insumo
  FROM "Receita" r
  JOIN "Unidade" u ON u.id = r."unidadeId" AND u.nome = 'Beira Lago'
  LEFT JOIN "IngredienteReceita" i ON i."receitaId" = r.id
  LEFT JOIN "Produto" pr ON pr.id = i."produtoId"
 WHERE r.id IN ('recbar-xarope', 'recbar-sumo')
    OR upper(btrim(r.nome)) IN ('XAROPE SIMPLES', 'SUMO DE LIMAO')
 ORDER BY r.nome;
