-- FUSÃO DOS PRODUTOS-FANTASMA — passo 2 de 2: GRAVAR.
--
-- NÃO RODE ESTE ARQUIVO sem ter lido o resultado do 14-fundir-1-conferir.sql,
-- principalmente a coluna `quantidade_depois` das fichas da BURRATA.
--
-- TUDO NUMA TRANSAÇÃO SÓ. Aqui o BEGIN/COMMIT é obrigatório, ao contrário do
-- cadastro de produtos: lá havia uma pausa humana no meio, e transação não
-- sobrevive a pausa. Aqui são oito tabelas que descrevem o MESMO fato, e uma
-- fusão pela metade — ficha movida, saldo não — deixaria o estoque mentindo de
-- um jeito que nenhuma tela mostraria.
--
-- A ORDEM das operações não é estética: o produto fantasma só é desativado no
-- fim, depois que tudo que apontava para ele já aponta para o real.
--
-- RODAR DUAS VEZES É SEGURO. Depois da primeira não sobra nada apontando para
-- o fantasma, então a segunda passagem não encontra linha para mover e não faz
-- nada. O saldo NÃO soma duas vezes.
--
-- O QUE ESTE ARQUIVO NÃO TOCA: ATUM, VINHO TINTO CULINARIO e VINHO PERMATIN
-- JEREZ. Falta saber o que a casa compra no lugar deles.

BEGIN;

-- Os pares vivem numa tabela temporária em vez de repetidos em cada comando:
-- oito comandos com a mesma lista copiada é um fator errado em um deles
-- esperando para acontecer. Ela morre no fim da sessão sozinha.
CREATE TEMP TABLE _fusao ON COMMIT DROP AS
WITH pares(fantasma, real_, fator) AS (
  VALUES ('GEMA', 'GEMA DE OVO 1KG', 1.0),
         ('BURRATA', 'BURRATA CAMPANA 200GR', 5.0),
         ('CONHAQUE DOMECQ', 'CONHAQUE DOMECQ 1LT', 1.0),
         ('VINHO BRANCO', 'VINHO BRANCO SAINT GERMAIN 750ML  (COZINHA)', 1.0)
)
SELECT f.id AS fantasma_id,
       f.nome AS fantasma_nome,
       r.id AS real_id,
       r.nome AS real_nome,
       r."unidadeMedida" AS real_unidade,
       pa.fator,
       (SELECT COALESCE("estoqueEmId", id) FROM "Unidade" WHERE nome = 'Beira Lago') AS despensa,
       (SELECT id FROM "Unidade" WHERE nome = 'Beira Lago') AS casa
FROM pares pa
JOIN "Produto" f ON upper(btrim(f.nome)) = upper(btrim(pa.fantasma))
JOIN "Produto" r ON upper(btrim(r.nome)) = upper(btrim(pa.real_));

-- Trava de segurança, com TRÊS desfechos, e a distinção importa:
--
--   4 pares  tudo certo, segue.
--   0 pares  a fusão JÁ FOI FEITA — os fantasmas foram renomeados no passo 9 e
--            por isso não casam mais. Não é erro. Os comandos abaixo não
--            encontram nada para mover e a transação fecha sem mudar nada.
--   1 a 3    aí sim é para abortar: algum nome mudou e uma das fusões
--            aconteceria sozinha, deixando as outras três pela metade.
--
-- A versão anterior desta trava exigia 4 e derrubava a segunda passagem com
-- uma parede de erros. Nada era danificado, porque a transação desfaz tudo,
-- mas o susto é gratuito e vinha justamente de quem conferiu direito e rodou
-- de novo por via das dúvidas.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM _fusao;
  IF n = 0 THEN
    RAISE NOTICE 'Nenhum par encontrado: a fusão já foi feita antes. Nada a fazer.';
  ELSIF n <> 4 THEN
    RAISE EXCEPTION 'Esperava 4 pares ou 0 (já fundido), encontrei %. Algum nome de produto mudou — confira o 14-fundir-1 antes.', n;
  END IF;
END $$;

-- 1. AS FICHAS. A quantidade é convertida e a unidade passa a ser a do produto
--    real — é o que corrige a burrata de quilos para potes.
UPDATE "IngredienteReceita" ing
   SET "produtoId" = fu.real_id,
       quantidade = ing.quantidade * fu.fator,
       "unidadeMedida" = fu.real_unidade
  FROM _fusao fu
 WHERE ing."produtoId" = fu.fantasma_id;

-- 2. O HISTÓRICO DE MOVIMENTO. Não é apagado: entrada, saída e ajuste do
--    fantasma passam a contar como do real, com a quantidade convertida. É o
--    que mantém o relatório de consumo contínuo em vez de nascer hoje.
UPDATE "MovimentoEstoque" m
   SET "produtoId" = fu.real_id,
       quantidade = m.quantidade * fu.fator
  FROM _fusao fu
 WHERE m."produtoId" = fu.fantasma_id;

-- 3. AS CONTAGENS ANTERIORES, pelo mesmo motivo: sem elas a Conferência da
--    contagem perderia o período fechado e trataria segunda-feira como marco
--    zero de novo.
UPDATE "ContagemEstoque" c
   SET "produtoId" = fu.real_id,
       "quantidadeContada" = c."quantidadeContada" * fu.fator,
       "quantidadeSistema" = c."quantidadeSistema" * fu.fator,
       diferenca = c.diferenca * fu.fator
  FROM _fusao fu
 WHERE c."produtoId" = fu.fantasma_id;

-- 4. AS LINHAS DE NOTA. Por definição o fantasma não tem nenhuma — é isso que
--    o torna fantasma. Vai aqui mesmo assim: se UMA existir, deixá-la para
--    trás recriaria o problema na próxima carga.
UPDATE "ItemNotaCompra" i
   SET "produtoId" = fu.real_id
  FROM _fusao fu
 WHERE i."produtoId" = fu.fantasma_id;

-- 5. O ITEM DE PEDIDO, idem.
UPDATE "ItemPedido" ip
   SET "produtoId" = fu.real_id
  FROM _fusao fu
 WHERE ip."produtoId" = fu.fantasma_id;

-- 6. O SALDO. Soma, não substitui — e é por isso que precisa de UPDATE e
--    DELETE em vez de um repointar: a chave (unidade, produto) já existe no
--    real, então mover a linha do fantasma violaria o único.
UPDATE "EstoqueSaldo" sr
   SET quantidade = sr.quantidade + sf.quantidade * fu.fator
  FROM _fusao fu
  JOIN "EstoqueSaldo" sf
    ON sf."produtoId" = fu.fantasma_id AND sf."unidadeId" = fu.despensa
 WHERE sr."produtoId" = fu.real_id AND sr."unidadeId" = fu.despensa;

-- O real pode não ter linha de saldo ainda; nesse caso a do fantasma vira a
-- dele, convertida.
UPDATE "EstoqueSaldo" sf
   SET "produtoId" = fu.real_id,
       quantidade = sf.quantidade * fu.fator
  FROM _fusao fu
 WHERE sf."produtoId" = fu.fantasma_id
   AND sf."unidadeId" = fu.despensa
   AND NOT EXISTS (
     SELECT 1 FROM "EstoqueSaldo" x
     WHERE x."produtoId" = fu.real_id AND x."unidadeId" = fu.despensa
   );

DELETE FROM "EstoqueSaldo" sf
 USING _fusao fu
 WHERE sf."produtoId" = fu.fantasma_id AND sf."unidadeId" = fu.despensa;

-- 7. A CURVA ABC. Só desce do fantasma para o real se o real não tiver a dela
--    — a classificação do real, quando existe, foi calculada sobre o consumo
--    de verdade. Isto importa para a FOLHA DE CONTAGEM: produto sem curva some
--    da folha, e perder a burrata na segunda-feira seria perder o item mais
--    caro da lista.
UPDATE "ParametroEstoqueProduto" gr
   SET "classeAbc" = COALESCE(gr."classeAbc", gf."classeAbc"),
       "grupoContagem" = COALESCE(gr."grupoContagem", gf."grupoContagem"),
       "estoqueMinimo" = COALESCE(gr."estoqueMinimo", gf."estoqueMinimo"),
       "estoqueIdeal" = COALESCE(gr."estoqueIdeal", gf."estoqueIdeal")
  FROM _fusao fu
  JOIN "ParametroEstoqueProduto" gf
    ON gf."produtoId" = fu.fantasma_id AND gf."unidadeId" = fu.despensa
 WHERE gr."produtoId" = fu.real_id AND gr."unidadeId" = fu.despensa;

UPDATE "ParametroEstoqueProduto" gf
   SET "produtoId" = fu.real_id
  FROM _fusao fu
 WHERE gf."produtoId" = fu.fantasma_id
   AND gf."unidadeId" = fu.despensa
   AND NOT EXISTS (
     SELECT 1 FROM "ParametroEstoqueProduto" x
     WHERE x."produtoId" = fu.real_id AND x."unidadeId" = fu.despensa
   );

DELETE FROM "ParametroEstoqueProduto" gf
 USING _fusao fu
 WHERE gf."produtoId" = fu.fantasma_id AND gf."unidadeId" = fu.despensa;

-- 8. O PREÇO DO FANTASMA SAI, e o do real fica como está. É o oposto do que o
--    instinto pede: o preço do fantasma é o inventado (R$ 0,70 na gema), e o
--    do real é o que tem nota por trás. Nada é recalculado aqui — o custo é
--    sempre recomputado na leitura, a partir de PrecoAtualProduto.
DELETE FROM "PrecoAtualProduto" pf
 USING _fusao fu
 WHERE pf."produtoId" = fu.fantasma_id AND pf."unidadeId" = fu.despensa;

DELETE FROM "HistoricoPrecoProduto" hf
 USING _fusao fu
 WHERE hf."produtoId" = fu.fantasma_id AND hf."unidadeId" = fu.despensa;

-- 9. O FANTASMA É DESATIVADO E RENOMEADO — não apagado.
--
--    Desativado em vez de apagado porque apagar perderia o rastro de que ele
--    existiu, e é esse rastro que explica um número estranho de setembro.
--
--    RENOMEADO porque o nome é perigoso enquanto existir: a carga de compra
--    casa por nome quando não tem código, e um produto chamado "GEMA" parado
--    no catálogo volta a capturar linha de nota na próxima semana, recriando
--    exatamente o fantasma que esta transação acabou de desfazer.
UPDATE "Produto" p
   SET ativo = false,
       nome = p.nome || ' (fundido em ' || fu.real_nome || ')'
  FROM _fusao fu
 WHERE p.id = fu.fantasma_id
   AND p.nome NOT LIKE '%(fundido em %';

-- 10. OS DOIS INSUMOS SEM CUSTO REAL. Zera o preço: tira do CMV o custo falso.
UPDATE "PrecoAtualProduto" pa
   SET preco = 0
  FROM "Produto" p, "Unidade" u
 WHERE pa."produtoId" = p.id
   AND u.nome = 'Beira Lago'
   AND pa."unidadeId" = COALESCE(u."estoqueEmId", u.id)
   AND upper(btrim(p.nome)) IN ('AGUA COCCÃO', 'ÁGUA COCCÃO', 'SALADA DE ERVAS');

COMMIT;

-- =====================================================================
-- CONFERÊNCIA. Tem que vir tudo zerado na coluna `ainda_aponta`.
-- =====================================================================
SELECT p.nome AS fantasma,
       p.ativo,
       (SELECT count(*) FROM "IngredienteReceita" i WHERE i."produtoId" = p.id)
     + (SELECT count(*) FROM "EstoqueSaldo" s WHERE s."produtoId" = p.id)
     + (SELECT count(*) FROM "PrecoAtualProduto" x WHERE x."produtoId" = p.id)
     + (SELECT count(*) FROM "ParametroEstoqueProduto" g WHERE g."produtoId" = p.id)
     + (SELECT count(*) FROM "MovimentoEstoque" m WHERE m."produtoId" = p.id)
     + (SELECT count(*) FROM "ContagemEstoque" c WHERE c."produtoId" = p.id) AS ainda_aponta
FROM "Produto" p
WHERE p.nome LIKE '%(fundido em %'
ORDER BY p.nome;

-- E o que ficou nos produtos reais: saldo somado, preço com nota por trás,
-- fichas apontando para o lugar certo.
SELECT p.nome,
       p."unidadeMedida" AS unidade,
       round(COALESCE(s.quantidade, 0)::numeric, 3) AS saldo,
       round(COALESCE(pa.preco, 0)::numeric, 4) AS preco,
       (SELECT count(*) FROM "IngredienteReceita" i WHERE i."produtoId" = p.id) AS fichas,
       COALESCE(g."classeAbc", '-') AS curva
FROM "Produto" p
JOIN "Unidade" u ON u.nome = 'Beira Lago'
LEFT JOIN "EstoqueSaldo" s ON s."produtoId" = p.id AND s."unidadeId" = COALESCE(u."estoqueEmId", u.id)
LEFT JOIN "PrecoAtualProduto" pa ON pa."produtoId" = p.id AND pa."unidadeId" = COALESCE(u."estoqueEmId", u.id)
LEFT JOIN "ParametroEstoqueProduto" g ON g."produtoId" = p.id AND g."unidadeId" = COALESCE(u."estoqueEmId", u.id)
WHERE upper(btrim(p.nome)) IN (
  'GEMA DE OVO 1KG', 'BURRATA CAMPANA 200GR', 'CONHAQUE DOMECQ 1LT',
  'VINHO BRANCO SAINT GERMAIN 750ML  (COZINHA)'
)
ORDER BY p.nome;
