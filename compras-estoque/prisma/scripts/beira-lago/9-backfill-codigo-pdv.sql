-- Grava o código do PDV nos 34 vinhos que JÁ EXISTEM no cadastro do
-- Beira Lago e por isso não casaram na primeira carga de vendas.
--
-- O QUE SÃO. O XMenu vende o vinho com o país no fim do nome
-- ("KAIKEN ESTATE MALBEC - ARGENTINA"); o cadastro tem o nome sem o país
-- ("Kaiken Estate Malbec"). Nomes diferentes, mesmo vinho. Cadastrar um
-- segundo item seria partir a venda daquele rótulo em dois.
--
-- POR QUE CÓDIGO, E NÃO "ARRUMAR O NOME". Arrumar o nome resolve até alguém
-- renomear de novo — e nome é a parte que a casa muda sozinha. O código do PDV
-- não muda quando o cardápio é reescrito. É a mesma lição de
-- resolucao-item-venda.ts: resolver por identificador, nunca por texto.
--
-- COMO O PAREAMENTO FOI FEITO: o nome do cadastro é PREFIXO EXATO do nome do
-- PDV, ignorando acento e pontuação, com pelo menos duas palavras. Não é
-- parecença: é o nome inteiro mais um sufixo de país. Nenhum item ficou com
-- dois códigos e nenhum código apontou pra dois itens — conferido antes de
-- gerar. Ainda assim, LEIA a lista: o comentário de cada linha traz o nome do
-- PDV que originou o código.
--
-- Só escreve onde codigoPdv está VAZIO. Rodar duas vezes não muda nada.

BEGIN;

UPDATE "ItemVenda" iv
   SET "codigoPdv" = v.codigo
  FROM (VALUES
  ('Alta Yari Malbec', '70039502062'),  -- ALTA YARI MALBEC - ARGENTINA
  ('Artero Macabeo-Verdejo', '70039502069'),  -- ARTERO MACABEO VERDEJO - ESPANHA
  ('Azevedo Loureiro Alvarinho', '70039502178'),  -- AZEVEDO LOUREIRO ALVARINHO - PORTUGAL
  ('Boya Pinot Noir', '70039502220'),  -- BOYA PINOT NOIR - CHILE
  ('Bracalle Jacopo Biondi-Santi', '70039501878'),  -- BRACALLE - JACOPO BIONDI-SANTI - ITALIA
  ('Cabriz Colheita Selecionada Tinto 375ml', '70039501610'),  -- CABRIZ COLHEITA SELECIONADA TINTO 375ML - PORTUGAL
  ('Carlos Montes Tannat', '70039502216'),  -- CARLOS MONTES TANNAT - URUGUAI
  ('Castelo de Borba Reserva', '70039502033'),  -- CASTELO DE BORBA RESERVA - PORTUGAL
  ('Chablis Joseph Drouhin', '70039502225'),  -- CHABLIS JOSEPH DROUHIN - FRANCA
  ('Chablis Maurice Lecester', '70039502022'),  -- CHABLIS MAURICE LECESTER - FRANCA
  ('Cobogó Sauvignon Blanc', '70039501955'),  -- COBOGO SAUVIGNON BLANC - BRASILIA
  ('Colomé Torrontes Estate', '70039502063'),  -- COLOME TORRONTES ESTATE - ARGENTINA
  ('Domaine Rochebin Bourgogne Pinot Noir', '70039502190'),  -- DOMAINE ROCHEBIN BOURGOGNE PINOT NOIR - FRANCA
  ('Haras de Pirque Galantas', '70039502246'),  -- HARAS DE PIRQUE GALANTAS - CHILE
  ('Kaiken Estate Malbec', '70039502013'),  -- KAIKEN ESTATE MALBEC - ARGENTINA
  ('Los Vascos Cromas Cabernet Sauvignon', '70039502222'),  -- LOS VASCOS CROMAS CABERNET SAUVIGNON - CHILE
  ('Maná Grande Reserva Syrah/Viognier', '70039501953'),  -- MANA GRANDE RESERVA SYRAH/VIOGNIER - BRASILIA
  ('Mas Andes Reserva', '70039502018'),  -- MAS ANDES RESERVA - CHILE
  ('Mascara De Fuego Carménère', '70039502184'),  -- MASCARA DE FUEGO CARMENERE - CHILE
  ('Michelle Carraro Cabernet Franc', '70039502015'),  -- MICHELLE CARRARO CABERNET FRANC - BRASIL
  ('Monograph Moschofilero', '70039502232'),  -- MONOGRAPH MOSCHOFILERO - GRECIA
  ('Montchenot Chenin Blanc', '70039502049'),  -- MONTCHENOT CHENIN BLANC - ARGENTINA
  ('Montchenot Gran Reserva 10 Anos', '70039502050'),  -- MONTCHENOT GRAN RESERVA 10 ANOS - ARGENTINA
  ('Monte do Zambujeiro', '70039502214'),  -- MONTE DO ZAMBUJEIRO - PORTUGAL
  ('Penedo Borges Cepas', '70039502014'),  -- PENEDO BORGES CEPAS - ARGENTINA
  ('Pesquera Crianza', '70039502224'),  -- PESQUERA CRIANZA - ESPANHA
  ('Pouilly-Fuisse Vieilles Vignes', '70039502080'),  -- POUILLY FUISSE VIEILLES VIGNES - FRANCA
  ('Saint Ser Rosé', '70039502025'),  -- SAINT SER ROSE - FRANCA 
  ('Santo Cristo Amphora Garnacha', '70039501875'),  -- SANTO CRISTO AMPHORA GARNACHA - ESPANHA
  ('Schroeder Pinot Noir Saurus', '70039502064'),  -- SCHROEDER PINOT NOIR SAURUS - ARGENTINA
  ('Seu Claudino Superiore Syrah', '40027201285'),  -- SEU CLAUDINO SUPERIORE SYRAH - BRASIL 
  ('Vezzi Amalteia Brut Rosé', '70039502016'),  -- VEZZI AMALTEIA BRUT ROSE - BRASIL
  ('Vidigueira Premium Antão Vaz Alentejo DOC', '70039502061'),  -- VIDIGUEIRA PREMIUM ANTAO VAZ ALENTEJO DOC - PORTUGAL
  ('Voga Prosecco Brut DOC', '70039502208')  -- VOGA PROSECCO BRUT DOC - ITALIA
  ) AS v(nome, codigo)
 WHERE iv."unidadeId" = (SELECT id FROM "Unidade" WHERE nome = 'Beira Lago')
   AND iv.nome = v.nome
   AND iv."codigoPdv" IS NULL;

COMMIT;

-- CONFERÊNCIA: tem que voltar 34 linhas, todas com código.
SELECT iv.nome, iv."codigoPdv"
FROM "ItemVenda" iv
JOIN "Unidade" u ON u.id = iv."unidadeId"
WHERE u.nome = 'Beira Lago'
  AND iv."codigoPdv" IN (

    '70039502062',
    '70039502069',
    '70039502178',
    '70039502220',
    '70039501878',
    '70039501610',
    '70039502216',
    '70039502033',
    '70039502225',
    '70039502022',
    '70039501955',
    '70039502063',
    '70039502190',
    '70039502246',
    '70039502013',
    '70039502222',
    '70039501953',
    '70039502018',
    '70039502184',
    '70039502015',
    '70039502232',
    '70039502049',
    '70039502050',
    '70039502214',
    '70039502014',
    '70039502224',
    '70039502080',
    '70039502025',
    '70039501875',
    '70039502064',
    '40027201285',
    '70039502016',
    '70039502061',
    '70039502208'
  )
ORDER BY iv.nome;
