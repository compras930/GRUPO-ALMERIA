-- Preenche `valorVendido` na semana de 2026-10-20 a 2026-10-20.
-- GERADO por prisma/scripts/beira-lago/gerar-valor-vendido.ts.
--
-- 97 itens · R$ 60.510,62 no XMenu.
--
-- Essa semana entrou antes de a rota aceitar `valorTotal`, então o
-- faturamento dela está sendo ESTIMADO por quantidade × preço cadastrado — e
-- estimar erra sempre no mesmo sentido, porque cardápio sobe e cadastro fica
-- parado. No mês inteiro a diferença é de R$ 11.192 (0,88%), toda para baixo,
-- o que INFLA todo CMV: o faturamento é o denominador.
--
-- Casa pelo CÓDIGO dentro da semana — a linha gravada guarda `codigoBruto` e
-- o export traz `codigo`. Nome não serve, pelo motivo de sempre.
--
-- Só escreve onde `valorVendido` está NULO: rodar duas vezes não muda nada, e
-- linha que já veio com valor declarado pela origem não é sobrescrita por
-- este arquivo, que é mais velho que ela.

BEGIN;

UPDATE "ItemVendaSemanal" i
   SET "valorVendido" = v.valor
  FROM (VALUES
  ('1001080491', 90.00),
  ('1001280504', 0.02),
  ('1001410487', 196.20),
  ('1001410488', 228.90),
  ('1001410489', 196.20),
  ('10014108', 21.80),
  ('1001430131', 20.00),
  ('100143017', 36.00),
  ('1001430313', 18.00),
  ('100146087', 261.60),
  ('100146096', 385.00),
  ('100146097', 192.00),
  ('1001600311', 396.00),
  ('100172059', 264.00),
  ('100183064', 180.00),
  ('100183072', 160.00),
  ('100183074', 76.00),
  ('100183077', 160.00),
  ('200143018', 12.00),
  ('40026201202', 36.00),
  ('40026201209', 84.00),
  ('40026201210', 38.00),
  ('4002920356', 10.90),
  ('4002920357', 10.90),
  ('4002920728', 57.50),
  ('50032801036', 10.00),
  ('70039501569', 36.00),
  ('70039501573', 799.80),
  ('70039501574', 387.00),
  ('70039501581', 10.90),
  ('70039501780', 85.00),
  ('70039501875', 184.00),
  ('70039501899', 260.00),
  ('70039501901', 108.00),
  ('70039501902', 768.00),
  ('70039501903', 62.00),
  ('70039501907', 950.00),
  ('70039501909', 475.00),
  ('70039501910', 294.00),
  ('70039501911', 115.00),
  ('70039501913', 672.00),
  ('70039501916', 2975.00),
  ('70039501919', 265.00),
  ('70039501920', 645.00),
  ('70039501921', 1085.00),
  ('70039501923', 1980.00),
  ('70039501925', 925.00),
  ('70039501926', 465.00),
  ('70039501927', 69.00),
  ('70039501935', 294.00),
  ('70039501937', 135.00),
  ('70039501938', 126.00),
  ('70039501940', 240.00),
  ('70039501966', 174.00),
  ('70039501981', 28.00),
  ('70039502013', 348.00),
  ('70039502016', 154.00),
  ('70039502029', 758.00),
  ('70039502050', 848.00),
  ('70039502059', 214.00),
  ('70039502060', 304.00),
  ('70039502062', 204.00),
  ('70039502063', 239.00),
  ('70039502064', 239.00),
  ('70039502129', 256.00),
  ('70039502131', 58.00),
  ('70039502167', 144.00),
  ('70039502168', 192.00),
  ('70039502177', 164.00),
  ('70039502230', 619.00),
  ('70039502246', 389.00),
  ('70039502349', 2790.00),
  ('70039502350', 350.00),
  ('70039502351', 140.00),
  ('70039502518', 195.00),
  ('70039502519', 65.00),
  ('70039502526', 150.00),
  ('70039502529', 1470.00),
  ('70039502530', 145.00),
  ('70039502564', 96.00),
  ('70039502625', 56.00),
  ('70039502627', 192.00),
  ('70039502738', 20.00),
  ('70039502744', 656.00),
  ('70039502757', 110.00),
  ('70039502758', 168.00),
  ('70039502759', 175.00),
  ('70039502760', 185.00),
  ('70039502761', 52.00),
  ('70039502762', 875.00),
  ('70039502763', 490.00),
  ('70039502936', 178.00),
  ('70039502972', 68.00),
  ('EVT-BEBIDAS', 7051.36),
  ('EVT-MENU', 17642.95),
  ('EVT-SERVICOS', 4306.40),
  ('EVT-VINHOS', 0.19)
  ) AS v(codigo, valor)
 WHERE i."codigoBruto" = v.codigo
   AND i."valorVendido" IS NULL
   AND i."vendaSemanalId" = (
     SELECT vs.id FROM "VendaSemanal" vs
     JOIN "Unidade" u ON u.id = vs."unidadeId"
     WHERE u.nome = 'Beira Lago'
       AND vs."periodoInicio" = DATE '2026-10-20'
       AND vs."periodoFim" = DATE '2026-10-20'
   );

COMMIT;

-- CONFERÊNCIA: faturamento da semana. Tem que dar R$ 60.510,62 — ou um
-- pouquinho menos, se algum código existir no export e não no app (é o caso
-- conhecido da semana de 13 a 19: a linha "TESTE IMPRESSORAS " de 15/10 só
-- está no export, então essa semana fecha em R$ 403.360,63, um centavo
-- abaixo). Diferença maior que centavos não é isso: me diga quanto deu.
--
-- "sem_valor" tem que ser 0. Se sobrar, é linha que o app tem e o export não
-- — me diga qual.
SELECT count(*) AS linhas,
       count(*) FILTER (WHERE i."valorVendido" IS NULL) AS sem_valor,
       round(sum(COALESCE(i."valorVendido", i."quantidadeVendida" * COALESCE(iv."precoVenda", 0)))::numeric, 2) AS faturamento
FROM "ItemVendaSemanal" i
JOIN "VendaSemanal" vs ON vs.id = i."vendaSemanalId"
JOIN "Unidade" u ON u.id = vs."unidadeId"
LEFT JOIN "ItemVenda" iv ON iv.id = i."itemVendaId"
WHERE u.nome = 'Beira Lago'
  AND vs."periodoInicio" = DATE '2026-10-20'
  AND vs."periodoFim" = DATE '2026-10-20';
