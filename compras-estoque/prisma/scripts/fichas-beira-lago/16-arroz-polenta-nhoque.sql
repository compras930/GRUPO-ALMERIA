-- Arroz arbóreo, polenta Paganini e nhoque. Beira Lago.
--
-- OS DOIS PAGANINI ESTÃO EM UND, e a ficha mede em quilo:
--   ARROZ ARBORIO PAGANINI 1KG          → pacote de 1 kg  → 1,0 kg = 1 pacote
--   POLENTA INSTANTANEA PAGANINI 500GR  → pacote de 500 g → 0,5 kg = 1 pacote
-- O peso veio do NOME do produto, que é onde ele estava escrito. Sem a
-- conversão, 0,5 kg de polenta viraria "meio pacote de polenta" na conta do
-- app — que por coincidência é a mesma coisa, e 1,0 kg de arroz viraria "um
-- pacote", que também é. A coincidência acaba no dia em que a casa trocar o
-- pacote de 500 g pelo de 1 kg, e aí o erro entra sem avisar. Por isso a
-- conversão está escrita, e não assumida.
--
-- O NHOQUE É FEITO NA CASA (confirmado), e a ficha dele já existe:
-- NHOQUE DE BATATA ASTERIX, rendimento 1,3 kg. Então é sub-receita, não
-- produto — o nhoque do prato passa a puxar batata, queijo e farinha, e o
-- preço da batata atravessa o prato sozinho.
--
-- SEGURO REPETIR: ids próprios, regrava em vez de duplicar.

BEGIN;

-- 1. Os dois Paganini, convertidos de quilo para pacote.
INSERT INTO "IngredienteReceita" ("id", "receitaId", "produtoId", "subReceitaId", "quantidade", "unidadeMedida")
SELECT v.id, r.id, pr.id, NULL, v.quilos / v.kg_por_pacote, 'UND'
  FROM (VALUES
    ('ingpg-risoto-arroz',   'RISOTO BASE',        'ARROZ ARBORIO PAGANINI 1KG',         1.0, 1.0),
    ('ingpg-arancine-arroz', 'SB MASSA ARANCINE',  'ARROZ ARBORIO PAGANINI 1KG',         0.5, 1.0),
    ('ingpg-polenta',        'SB POLENTA CREMOSA', 'POLENTA INSTANTANEA PAGANINI 500GR', 0.5, 0.5)
  ) AS v(id, chave_ficha, chave_produto, quilos, kg_por_pacote)
  JOIN "Unidade" u ON u.nome = 'Beira Lago'
  JOIN "Receita" r ON r."unidadeId" = u.id
                  AND upper(regexp_replace(translate(btrim(r.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g')) = v.chave_ficha
  JOIN "Produto" pr ON pr.ativo
                   AND upper(regexp_replace(translate(btrim(pr.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g')) = v.chave_produto
                   -- Exige UND: se o produto for recadastrado em quilo, a
                   -- linha para de entrar em vez de virar o dobro de arroz.
                   AND upper(btrim(pr."unidadeMedida")) = 'UND'
ON CONFLICT ("id") DO UPDATE
   SET "receitaId" = EXCLUDED."receitaId", "produtoId" = EXCLUDED."produtoId",
       "quantidade" = EXCLUDED."quantidade", "unidadeMedida" = EXCLUDED."unidadeMedida";

-- 2. O nhoque, como sub-receita.
INSERT INTO "IngredienteReceita" ("id", "receitaId", "produtoId", "subReceitaId", "quantidade", "unidadeMedida")
SELECT 'ingpg-nhoque', r.id, NULL, sub.id, 0.15, 'KG'
  FROM "Unidade" u
  JOIN "Receita" r ON r."unidadeId" = u.id
                  AND upper(regexp_replace(translate(btrim(r.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g')) = 'NHOQUE COM COGUMELOS'
  JOIN "Receita" sub ON sub."unidadeId" = u.id
                    AND upper(regexp_replace(translate(btrim(sub.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g')) = 'NHOQUE DE BATATA ASTERIX'
 WHERE u.nome = 'Beira Lago'
ON CONFLICT ("id") DO UPDATE
   SET "receitaId" = EXCLUDED."receitaId", "subReceitaId" = EXCLUDED."subReceitaId",
       "produtoId" = NULL, "quantidade" = EXCLUDED."quantidade";

COMMIT;

-- Conferência.
SELECT r.nome AS ficha, coalesce(pr.nome, sub.nome) AS ingrediente,
       round(i.quantidade::numeric, 3) AS quantidade, i."unidadeMedida",
       CASE WHEN sub.id IS NOT NULL THEN 'sub-receita' ELSE 'insumo' END AS tipo
  FROM "IngredienteReceita" i
  JOIN "Receita" r ON r.id = i."receitaId"
  LEFT JOIN "Produto" pr ON pr.id = i."produtoId"
  LEFT JOIN "Receita" sub ON sub.id = i."subReceitaId"
 WHERE i.id LIKE 'ingpg-%'
 ORDER BY r.nome;
