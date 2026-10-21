-- Fecha a receita de evento da semana 13–19/10, que entrou crua.
--
-- O QUE ACONTECEU. Essa carga foi enviada ANTES de o painel colapsar os
-- eventos nos 4 códigos EVT-*. Vieram 32 linhas com o nome do evento inteiro
-- ("MENU EVENTO - LABORATÓRIO SABIN - FESTA DO MÉDICO 16/10/26"), e nome de
-- evento nunca casa: o da semana que vem é outro. Elas ficaram gravadas sem
-- item, valendo zero.
--
-- São R$ 215.552,57 — mais da metade dos R$ 403.360,64 da semana. Sem isso, o
-- faturamento do app fica pela metade e TODO CMV sai com o dobro do tamanho.
--
-- O QUE ESTE SQL FAZ. Apaga as 32 linhas órfãs e põe no lugar 4 linhas
-- apontando para os itens EVT-*, com `quantidadeVendida = valor em reais` —
-- a mesma convenção do cadastro (preço R$ 1,00), que faz quantidade × preço
-- reproduzir o valor vendido.
--
-- POR QUE APAGAR, E NÃO SÓ ACRESCENTAR. Deixar as 32 de pé não erraria número
-- nenhum (sem item, elas valem zero), mas apareceriam como "não reconhecidas"
-- para sempre, em toda conferência, sem nada a fazer sobre elas. A lista de
-- não reconhecidos é a que precisa continuar confiável — ela é o alarme de
-- cadastro faltando. Enchê-la de linhas insolúveis treina quem opera a
-- ignorá-la, e aí o alarme não serve mais. O nome de cada evento continua no
-- painel e na coluna `observacao` do export.
--
-- Nada aqui mexe em estoque: linha sem item nunca explodiu ficha, e os itens
-- EVT-* não têm ficha nem devem ter — o custo de evento está diluído na
-- matéria-prima e só a contagem separa.
--
-- TESTE IMPRESSORAS (R$ 0,02) sai junto, pelo mesmo motivo: não é venda.

-- ---------------------------------------------------------------------------
-- 1. O QUE VAI SAIR. Rode, confira, e guarde o resultado se quiser o registro
--    dos nomes. Tem que listar 33 linhas: 32 de evento e o TESTE IMPRESSORAS.
-- ---------------------------------------------------------------------------
SELECT ivs."codigoBruto", ivs."nomeBruto", ivs."quantidadeVendida"
FROM "ItemVendaSemanal" ivs
WHERE ivs."vendaSemanalId" = 'cmvi0cqjc00021e0h78c9qb9c'
  AND ivs."itemVendaId" IS NULL
ORDER BY ivs."nomeBruto";

-- ---------------------------------------------------------------------------
-- 2. A TROCA.
-- ---------------------------------------------------------------------------
BEGIN;

DELETE FROM "ItemVendaSemanal"
WHERE "vendaSemanalId" = 'cmvi0cqjc00021e0h78c9qb9c'
  AND "itemVendaId" IS NULL;

INSERT INTO "ItemVendaSemanal" (id, "vendaSemanalId", "itemVendaId", "nomeBruto", "codigoBruto", "quantidadeVendida")
SELECT
  'evs' || substr(md5('cmvi0cqjc00021e0h78c9qb9c' || v.codigo), 1, 22),
  'cmvi0cqjc00021e0h78c9qb9c',
  iv.id,
  v.nome,
  v.codigo,
  v.valor
FROM (VALUES
  ('EVT-MENU',     'EVENTO - MENU',     136931.06),
  ('EVT-SERVICOS', 'EVENTO - SERVICOS',  29500.00),
  ('EVT-BEBIDAS',  'EVENTO - BEBIDAS',   24652.47),
  ('EVT-VINHOS',   'EVENTO - VINHOS',    24469.04)
) AS v(codigo, nome, valor)
JOIN "ItemVenda" iv
  ON iv."codigoPdv" = v.codigo
 AND iv."unidadeId" = (SELECT id FROM "Unidade" WHERE nome = 'Beira Lago')
-- Se já tiver rodado, não duplica.
WHERE NOT EXISTS (
  SELECT 1 FROM "ItemVendaSemanal" x
  WHERE x."vendaSemanalId" = 'cmvi0cqjc00021e0h78c9qb9c'
    AND x."codigoBruto" = v.codigo
);

COMMIT;

-- ---------------------------------------------------------------------------
-- 3. CONFERÊNCIA: o faturamento da semana, como o app vai calcular.
--    Tem que dar R$ 403.360,64 — o total do XMenu para 13 a 19/10.
--    "sem_item" tem que ser 0.
-- ---------------------------------------------------------------------------
SELECT count(*) AS linhas,
       count(*) FILTER (WHERE ivs."itemVendaId" IS NULL) AS sem_item,
       round(sum(ivs."quantidadeVendida" * coalesce(iv."precoVenda", 0))::numeric, 2) AS faturamento
FROM "ItemVendaSemanal" ivs
LEFT JOIN "ItemVenda" iv ON iv.id = ivs."itemVendaId"
WHERE ivs."vendaSemanalId" = 'cmvi0cqjc00021e0h78c9qb9c';
