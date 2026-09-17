-- Corrige o rendimento de três receitas que descrevem UMA PORÇÃO, e liga cada
-- uma ao item de venda que estava sem ficha.
--
-- O PROBLEMA. custoItemVenda calcula o custo de UMA UNIDADE do rendimento.
-- Estas três têm rendimento em KG — 0,274 / 0,453 / 0,153 — que é o PESO da
-- porção, confirmado pelo setor de compras. Como está, o sistema calcula o
-- custo de UM QUILO do prato: divide a receita inteira por 0,274 em vez de
-- entregá-la como está. A cabríssima apareceria a R$ 71,81 com CMV de 49%,
-- contra 14,7% da pizza irmã (4 FORMAGGIO, que não tem rendimento e por isso
-- já sai certa).
--
-- A CORREÇÃO. rendimentoQtd = 1, rendimentoUnidade = 'UND': "esta receita rende
-- uma porção". O custo passa a ser a soma dos ingredientes, que é o que a
-- receita descreve.
--
-- O peso não se perde: vai pro modo de preparo como anotação. Ele é derivado
-- pela importação do dashboard antigo (o decimal 0,2744471434123592 é a
-- assinatura disso), então é referência, não medição — mas é a única que
-- existe e não custa nada guardar.
--
-- FICAM DE FORA, e continuam sem ficha: GNOCCHI TRUFA (2,526 KG) e CREME DE
-- COGUMELOS (1,410 KG). Esses são LOTE, não porção — 2,5 kg de gnocchi não é
-- um prato. Pra eles o caminho é outro: o item de venda precisa de uma receita
-- própria que consuma o lote como SUB-RECEITA na quantidade da porção, e essa
-- quantidade ainda não foi informada.
--
-- Idempotente: na segunda execução o rendimento já é 1 e o item já tem ficha.
-- Faça o backup antes.

-- ---------------------------------------------------------------------------
-- Passo 1 — PLANO. Espere 3 linhas, com o rendimento atual em KG.
-- ---------------------------------------------------------------------------
WITH mapa(casa, item, receita) AS (VALUES
  ('Matri', 'Cabríssima & Figo', 'CABRISSIMA E FIGO'),
  ('Matri', 'Corniccione', 'CORNICCIONI'),
  ('Matri', 'Pastrami Fries', 'PASTRAMI FRIES')
)
SELECT m.casa, m.item, m.receita,
       round(r."rendimentoQtd"::numeric, 3) || ' ' || COALESCE(r."rendimentoUnidade", '') AS rendimento_hoje,
       (SELECT count(*) FROM "IngredienteReceita" x WHERE x."receitaId" = r.id) AS ingredientes,
       iv."precoVenda",
       CASE WHEN iv."receitaId" IS NULL THEN 'sem ficha' ELSE 'já tem ficha' END AS item_hoje
FROM mapa m
JOIN "Unidade" un ON un.nome = m.casa
JOIN "ItemVenda" iv ON iv."unidadeId" = un.id AND lower(btrim(iv.nome)) = lower(btrim(m.item))
JOIN "Receita" r    ON r."unidadeId"  = un.id AND lower(btrim(r.nome))  = lower(btrim(m.receita))
ORDER BY m.casa, m.item;

-- ---------------------------------------------------------------------------
-- Passo 2 — Guarda o peso no modo de preparo, antes de trocar o rendimento.
-- ---------------------------------------------------------------------------
WITH mapa(casa, receita) AS (VALUES

  ('Matri', 'CABRISSIMA E FIGO'),
  ('Matri', 'CORNICCIONI'),
  ('Matri', 'PASTRAMI FRIES')
)
UPDATE "Receita" r
SET "modoPreparo" = COALESCE(r."modoPreparo" || E'\n\n', '')
      || 'Peso de referência da porção: ' || round(r."rendimentoQtd"::numeric, 3) || ' KG.'
FROM mapa m
JOIN "Unidade" un ON un.nome = m.casa
WHERE r."unidadeId" = un.id
  AND lower(btrim(r.nome)) = lower(btrim(m.receita))
  AND upper(btrim(COALESCE(r."rendimentoUnidade", ''))) = 'KG'
  AND COALESCE(r."modoPreparo", '') NOT LIKE '%Peso de referência da porção%';

-- ---------------------------------------------------------------------------
-- Passo 3 — Rendimento passa a ser "1 porção".
-- ---------------------------------------------------------------------------
WITH mapa(casa, receita) AS (VALUES

  ('Matri', 'CABRISSIMA E FIGO'),
  ('Matri', 'CORNICCIONI'),
  ('Matri', 'PASTRAMI FRIES')
)
UPDATE "Receita" r
SET "rendimentoQtd" = 1, "rendimentoUnidade" = 'UND'
FROM mapa m
JOIN "Unidade" un ON un.nome = m.casa
WHERE r."unidadeId" = un.id
  AND lower(btrim(r.nome)) = lower(btrim(m.receita))
  AND upper(btrim(COALESCE(r."rendimentoUnidade", ''))) = 'KG';

-- ---------------------------------------------------------------------------
-- Passo 4 — Liga o item de venda à receita.
-- ---------------------------------------------------------------------------
WITH mapa(casa, item, receita) AS (VALUES
  ('Matri', 'Cabríssima & Figo', 'CABRISSIMA E FIGO'),
  ('Matri', 'Corniccione', 'CORNICCIONI'),
  ('Matri', 'Pastrami Fries', 'PASTRAMI FRIES')
)
UPDATE "ItemVenda" iv
SET "receitaId" = r.id
FROM mapa m
JOIN "Unidade" un ON un.nome = m.casa
JOIN "Receita" r  ON r."unidadeId" = un.id AND lower(btrim(r.nome)) = lower(btrim(m.receita))
WHERE iv."unidadeId" = un.id
  AND lower(btrim(iv.nome)) = lower(btrim(m.item))
  AND iv."receitaId" IS NULL
  AND 1 = (SELECT count(*) FROM "ItemVenda" x
            WHERE x."unidadeId" = un.id AND lower(btrim(x.nome)) = lower(btrim(m.item)))
  AND 1 = (SELECT count(*) FROM "Receita" y
            WHERE y."unidadeId" = un.id AND lower(btrim(y.nome)) = lower(btrim(m.receita)));

-- ---------------------------------------------------------------------------
-- Verificação — rendimento 1 UND, item com ficha. Confira o CMV na tela
-- depois: as três são de Matri e devem ficar na mesma faixa das outras
-- pizzas (a 4 FORMAGGIO está em 14,7%).
-- ---------------------------------------------------------------------------
WITH mapa(casa, item, receita) AS (VALUES
  ('Matri', 'Cabríssima & Figo', 'CABRISSIMA E FIGO'),
  ('Matri', 'Corniccione', 'CORNICCIONI'),
  ('Matri', 'Pastrami Fries', 'PASTRAMI FRIES')
)
SELECT m.casa, m.item, r."rendimentoQtd", r."rendimentoUnidade",
       CASE WHEN iv."receitaId" IS NULL THEN 'AINDA SEM FICHA' ELSE 'ok' END AS status
FROM mapa m
JOIN "Unidade" un ON un.nome = m.casa
JOIN "ItemVenda" iv ON iv."unidadeId" = un.id AND lower(btrim(iv.nome)) = lower(btrim(m.item))
JOIN "Receita" r    ON r."unidadeId"  = un.id AND lower(btrim(r.nome))  = lower(btrim(m.receita))
ORDER BY m.casa, m.item;
