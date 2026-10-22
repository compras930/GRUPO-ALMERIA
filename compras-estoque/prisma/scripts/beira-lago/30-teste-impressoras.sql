-- A última linha de venda sem item do Beira Lago: "TESTE IMPRESSORAS".
--
-- Sobrou 1 de 150 depois do 28. Vale R$ 0,01 e aparece quando alguém testa a
-- impressora da cozinha pelo PDV.
--
-- POR QUE CADASTRAR UMA LINHA DE UM CENTAVO. Não é pelo centavo: é para o
-- relatório parar de ter ruído. Uma linha que volta "não reconhecida" em toda
-- carga ensina a ignorar a lista de não reconhecidos — e essa lista é o alarme
-- que avisa quando um prato NOVO entra no cardápio e ninguém cadastrou. Alarme
-- que toca todo dia por nada é alarme desligado.
--
-- Entra INATIVO, como os 111 do arquivo 28: some do seletor de perdas e da
-- fila de fichas, e a venda passada casa igual, porque o casamento é por
-- código.
--
-- CATEGORIA 'TAXAS', junto com a taxa de whisky: não é comida, não tem ficha,
-- e não deve entrar na conta do CMV como prato vendido.
INSERT INTO "ItemVenda" (id, "unidadeId", tipo, categoria, nome, "precoVenda", "codigoPdv", ativo, "criadoEm", "atualizadoEm")
SELECT gen_random_uuid()::text, u.id, 'PRATO', 'TAXAS', 'TESTE IMPRESSORAS', 0.01, '6001180188', false, now(), now()
FROM "Unidade" u
WHERE u.nome = 'Beira Lago'
  AND NOT EXISTS (
    SELECT 1 FROM "ItemVenda" iv
    WHERE iv."unidadeId" = u.id AND iv."codigoPdv" = '6001180188'
  );

-- CONFERÊNCIA: uma linha, inativa.
SELECT iv.nome, iv."codigoPdv", iv.categoria, iv."precoVenda", iv.ativo
FROM "ItemVenda" iv
JOIN "Unidade" u ON u.id = iv."unidadeId" AND u.nome = 'Beira Lago'
WHERE iv."codigoPdv" = '6001180188';
