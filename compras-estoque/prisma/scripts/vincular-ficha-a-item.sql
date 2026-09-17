-- Liga itens de venda que aparecem SEM FICHA às receitas que já existem, mas
-- estavam órfãs — nenhum item de venda apontava pra elas.
--
-- O caso que revelou isto: "Quattro Formaggi" aparecia SEM FICHA no /cmv do
-- Matri enquanto a receita "4 FORMAGGIO" existia. Mesmo prato, dois nomes,
-- sem o vínculo. Dos 617 itens sem ficha, 28 tinham receita órfã parecida e
-- 10 foram confirmados pelo setor de compras.
--
-- DESSES 10, SÓ 5 ENTRAM AQUI. O motivo é o rendimento.
--
-- custoItemVenda calcula o custo de UMA unidade do rendimento da receita. Se
-- rendimentoUnidade é UND (ou não há rendimento), uma unidade é uma porção e a
-- conta está certa. Se é KG, o sistema calcula o custo de UM QUILO do prato.
--
--   4 FORMAGGIO        sem rendimento     -> R$ 17,31   CMV 14,7%   correto
--   CABRISSIMA E FIGO  rendimento 0,274 KG -> R$ 71,81  CMV 49,2%   ERRADO
--
-- As duas são pizza da mesma casa e não custam uma o triplo da outra: o 0,274
-- é o PESO da pizza, e o sistema divide por ele. O custo real da cabríssima
-- seria 0,274 x 71,81 = R$ 19,68, ou 13,5% — em linha com a irmã.
--
-- Ficam de fora até alguém dizer o que o rendimento significa em cada uma
-- (peso de uma porção, ou tamanho de um lote):
--
--   Matri       CABRISSIMA E FIGO   0,274 KG
--   Matri       CORNICCIONI         0,453 KG
--   Matri       GNOCCHI TRUFA       2,526 KG   <- 2,5 kg não é um prato, é lote
--   Matri       PASTRAMI FRIES      0,153 KG
--   Wine Garden CREME DE COGUMELOS  1,410 KG   <- idem
--
-- Ligar essas cinco agora poria número errado numa tela que a casa usa pra
-- decidir preço. Pior que não ter custo é ter um custo errado com cara de
-- certo — a ficha some da lista "sem ficha técnica" e ninguém volta nela.
--
-- Casa por (casa, nome) e não por id: ids de produção e do banco local são
-- cuids de importações separadas. Recusa nome que exista duas vezes na casa,
-- só liga item SEM ficha, e reexecutar não muda nada.

-- ---------------------------------------------------------------------------
-- Passo 1 — PLANO. Espere 5 linhas. `rendimento` tem que vir vazio ou em UND.
-- ---------------------------------------------------------------------------
WITH mapa(casa, item, receita) AS (VALUES
  ('Matri', 'Quattro Formaggi', '4 FORMAGGIO'),
  ('Matri', 'Gnocchi all''Amatriciana', 'GNOCCHI  AMATRICIANA'),
  ('Matri', 'Panzerotto', 'PANZETORO'),
  ('104 Sul', 'Salada de Frutas', 'SALADA DE FRUTAS'),
  ('Noroeste', 'Salada de Frutas', 'SALADA DE FRUTAS')
)
SELECT m.casa, m.item, m.receita,
       COALESCE(round(r."rendimentoQtd"::numeric, 2)::text || ' ' || COALESCE(r."rendimentoUnidade", ''), '(sem rendimento)') AS rendimento,
       (SELECT count(*) FROM "IngredienteReceita" x WHERE x."receitaId" = r.id) AS ingredientes,
       iv."precoVenda"
FROM mapa m
JOIN "Unidade" un ON un.nome = m.casa
JOIN "ItemVenda" iv ON iv."unidadeId" = un.id AND lower(btrim(iv.nome)) = lower(btrim(m.item))
JOIN "Receita" r    ON r."unidadeId"  = un.id AND lower(btrim(r.nome))  = lower(btrim(m.receita))
ORDER BY m.casa, m.item;

-- ---------------------------------------------------------------------------
-- Passo 2 — Liga.
-- ---------------------------------------------------------------------------
WITH mapa(casa, item, receita) AS (VALUES
  ('Matri', 'Quattro Formaggi', '4 FORMAGGIO'),
  ('Matri', 'Gnocchi all''Amatriciana', 'GNOCCHI  AMATRICIANA'),
  ('Matri', 'Panzerotto', 'PANZETORO'),
  ('104 Sul', 'Salada de Frutas', 'SALADA DE FRUTAS'),
  ('Noroeste', 'Salada de Frutas', 'SALADA DE FRUTAS')
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
-- Verificação — os 5 passam a ter ficha.
-- ---------------------------------------------------------------------------
WITH mapa(casa, item) AS (VALUES
  ('Matri', 'Quattro Formaggi'),
  ('Matri', 'Gnocchi all''Amatriciana'),
  ('Matri', 'Panzerotto'),
  ('104 Sul', 'Salada de Frutas'),
  ('Noroeste', 'Salada de Frutas')
)
SELECT m.casa, m.item,
       CASE WHEN iv."receitaId" IS NULL THEN 'AINDA SEM FICHA' ELSE 'ok' END AS status
FROM mapa m
JOIN "Unidade" un ON un.nome = m.casa
JOIN "ItemVenda" iv ON iv."unidadeId" = un.id AND lower(btrim(iv.nome)) = lower(btrim(m.item))
ORDER BY status DESC, m.casa, m.item;
