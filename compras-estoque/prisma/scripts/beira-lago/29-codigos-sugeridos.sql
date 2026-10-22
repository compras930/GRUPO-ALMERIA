-- Grava o código do PDV em três itens que casaram por NOME em agosto.
--
-- A carga de agosto devolveu `codigosASugerir` para estes três: o item já
-- existia no catálogo, casou pelo nome, e a rota avisou qual código o PDV usa.
-- Gravar o código é o que faz a próxima carga casar por IDENTIFICADOR.
--
-- POR QUE ISSO IMPORTA, com a história deste projeto: 34 vinhos não casaram
-- por um sufixo de país no nome, e 169 linhas de venda casaram por código
-- contra ZERO por nome. Casar por nome funciona até alguém renomear o prato no
-- cardápio — e renomear prato é coisa que acontece toda temporada.
--
-- SÓ GRAVA ONDE ESTÁ VAZIO. Se o item já tem código, este arquivo não o
-- sobrescreve: um código diferente do esperado é divergência para olhar, não
-- para apagar em silêncio.
UPDATE "ItemVenda" iv
   SET "codigoPdv" = v.codigo
  FROM (VALUES
    ('FALAFEL',          '70039502521'),
    ('DOPPIO RAVIOLI',   '70039501915'),
    ('ANTEPASTO ALMERIA', '70039502358')
  ) AS v(nome, codigo),
       "Unidade" u
 WHERE u.nome = 'Beira Lago'
   AND iv."unidadeId" = u.id
   AND lower(btrim(iv.nome)) = lower(btrim(v.nome))
   AND iv."codigoPdv" IS NULL;

-- CONFERÊNCIA: os três com o código gravado.
SELECT iv.nome, iv."codigoPdv", iv.categoria, iv.ativo
FROM "ItemVenda" iv
JOIN "Unidade" u ON u.id = iv."unidadeId" AND u.nome = 'Beira Lago'
WHERE lower(btrim(iv.nome)) IN ('falafel', 'doppio ravioli', 'antepasto almeria')
ORDER BY iv.nome;
