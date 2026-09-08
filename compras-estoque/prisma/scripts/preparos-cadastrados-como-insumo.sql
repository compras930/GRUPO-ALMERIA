-- SÓ LEITURA. Levanta as linhas de ficha que custam ZERO porque apontam pra um
-- Produto sem preço na casa delas, e diz, pra cada uma, se existe uma Receita com
-- aquele nome na MESMA casa — ou seja, se dá pra repontar a linha pra sub-receita
-- ou se a receita precisa ser criada antes.
--
-- Contexto: o levantamento dos insumos zerados mostrou que boa parte não é
-- "faltou cadastrar preço" — é preparo da própria casa que a importação
-- registrou como se fosse insumo comprado. Os nomes com prefixo "SB " são os
-- mais evidentes (SB Aioli tomate, SB Arancine, SB Geléia de damasco), mas
-- entram também ARROZ ARBÓREO COZIDO, SALADA DE ERVAS, TELHA DE PARMESÃO, as
-- aparas e o CALDO DE VEGETAIS. Nesses casos o custo real existe: está nos
-- ingredientes da receita, que o sistema nunca lê porque a ficha aponta pro
-- produto zerado.
--
-- O caso do arroz arbóreo mostrou por que essa consulta é necessária antes de
-- qualquer SQL de correção: a receita dele existe, mas na Wine Garden, enquanto
-- as fichas que precisam dela estão em 104 Sul e Noroeste. Receita é por casa
-- (@@unique([unidadeId, nome])) e a validação de salvamento recusa sub-receita de
-- outra unidade — então "a receita já existe" não significa "dá pra repontar".
--
-- Colunas de decisão:
--   acao = REPONTAR              -> existe receita com esse nome na casa da ficha;
--                                   é o único caso resolvível por SQL
--   acao = COPIAR DE OUTRA CASA  -> existe receita com esse nome em outra casa
--                                   (a coluna diz quais); dá pra replicar, desde
--                                   que os insumos dela tenham preço na casa nova
--   acao = DECIDIR PRECO OU RECEITA -> não existe receita em lugar nenhum. Aqui a
--                                   consulta não tem como saber se é insumo
--                                   comprado que só falta precificar (MOSTARDA
--                                   DIJON, OREGANO) ou preparo da casa cuja
--                                   receita só a cozinha sabe (CARCAÇA DE PEIXE,
--                                   Apara de Carne). É decisão humana, item a item.
--
--   quantidade / un_linha -> ATENÇÃO: repontar muda o significado do número. Como
--                           insumo, custo = quantidade × preço. Como sub-receita,
--                           é quantidade ÷ rendimentoQtd × custo do lote. Uma
--                           linha "110 UN" contra rendimento de 2,337 KG viraria
--                           47 lotes; o 110 provavelmente quer dizer 110 g e
--                           precisa virar 0,110 na mesma tacada.
--
--   alerta_quantidade -> a razão pela qual precificar esses produtos às cegas é
--                           perigoso. Enquanto o preço é zero, qualquer
--                           quantidade absurda fica invisível (zero × qualquer
--                           coisa = zero). Achado real: uma linha de CALDO DE
--                           VEGETAIS com quantidade 40000 em KG — 40 toneladas,
--                           que é 40 litros escritos em ml. Se alguém precificar
--                           esse produto a R$ 5/kg, o custo daquela ficha vira
--                           R$ 200 mil. A quantidade tem que ser corrigida ANTES
--                           do preço, não depois.

WITH linha_sem_custo AS (
  SELECT
    i.id                                                        AS linha_id,
    i.quantidade,
    i."unidadeMedida"                                           AS un_linha,
    p.id                                                        AS produto_id,
    p.nome                                                      AS produto,
    p."unidadeMedida"                                           AS un_produto,
    -- tira o prefixo "SB " (sub-receita) pra casar com o nome da receita
    regexp_replace(lower(btrim(p.nome)), '^sb\s+', '')          AS nome_busca,
    r.nome                                                      AS ficha,
    un.id                                                       AS casa_id,
    un.nome                                                     AS casa
  FROM "IngredienteReceita" i
  JOIN "Produto" p  ON p.id = i."produtoId"
  JOIN "Receita" r  ON r.id = i."receitaId"
  JOIN "Unidade" un ON un.id = r."unidadeId"
  -- o que torna a linha custo zero: nenhum preço positivo pra esse produto NA
  -- CASA da ficha. Preço é por casa, então tem que ser avaliado por casa.
  WHERE NOT EXISTS (
    SELECT 1 FROM "PrecoAtualProduto" pa
    WHERE pa."produtoId" = p.id AND pa."unidadeId" = un.id AND pa.preco > 0
  )
)
SELECT
  CASE
    -- Receita "casca": tem 1 único ingrediente, que é o próprio produto de mesmo
    -- nome. É artefato da importação (a mesma família das 32 auto-referências já
    -- corrigidas), não um preparo. Repontar pra ela só embrulha o mesmo zero numa
    -- camada a mais, por isso não conta como solução.
    WHEN rc.id IS NOT NULL
     AND (SELECT count(*) FROM "IngredienteReceita" x WHERE x."receitaId" = rc.id) = 1
     AND EXISTS (
           SELECT 1 FROM "IngredienteReceita" x
           JOIN "Produto" p2 ON p2.id = x."produtoId"
           WHERE x."receitaId" = rc.id
             AND regexp_replace(lower(btrim(p2.nome)), '^sb\s+', '') = l.nome_busca
         )
      THEN 'RECEITA E CASCA (nao resolve)'
    WHEN rc.id IS NOT NULL THEN 'REPONTAR'
    WHEN EXISTS (SELECT 1 FROM "Receita" r2 WHERE lower(btrim(r2.nome)) = l.nome_busca)
      THEN 'COPIAR DE OUTRA CASA'
    ELSE 'DECIDIR PRECO OU RECEITA'
  END                                                                  AS acao,
  l.produto,
  l.un_produto,
  l.casa,
  l.ficha,
  l.quantidade,
  l.un_linha,
  -- Quantidade que não fecha com a unidade: em KG/LT, 100+ significa que o número
  -- está em grama/ml. Invisível hoje (preço zero), explode no dia que precificar.
  CASE
    WHEN upper(btrim(l.un_linha)) IN ('KG', 'LT', 'L') AND l.quantidade >= 100
      THEN 'quantidade parece estar em g/ml'
    ELSE ''
  END                                                                  AS alerta_quantidade,
  rc.nome                                                              AS receita_na_casa,
  rc."rendimentoQtd"                                                   AS rendimento,
  rc."rendimentoUnidade"                                               AS un_rendimento,
  (SELECT count(*) FROM "IngredienteReceita" x WHERE x."receitaId" = rc.id) AS ingredientes,
  -- se não há receita na casa da ficha, onde mais existe uma com esse nome
  (SELECT string_agg(u2.nome, ', ' ORDER BY u2.nome)
     FROM "Receita" r2 JOIN "Unidade" u2 ON u2.id = r2."unidadeId"
     WHERE lower(btrim(r2.nome)) = l.nome_busca)                       AS receita_em_outras_casas
FROM linha_sem_custo l
LEFT JOIN "Receita" rc
       ON rc."unidadeId" = l.casa_id
      AND lower(btrim(rc.nome)) = l.nome_busca
ORDER BY 1, l.produto, l.casa;

-- ---------------------------------------------------------------------------
-- Resumo por ação, pra dimensionar antes de ler linha por linha.
-- ---------------------------------------------------------------------------
WITH linha_sem_custo AS (
  SELECT
    i.quantidade, i."unidadeMedida" AS un_linha, p.id AS produto_id, p.nome AS produto,
    regexp_replace(lower(btrim(p.nome)), '^sb\s+', '') AS nome_busca, un.id AS casa_id
  FROM "IngredienteReceita" i
  JOIN "Produto" p  ON p.id = i."produtoId"
  JOIN "Receita" r  ON r.id = i."receitaId"
  JOIN "Unidade" un ON un.id = r."unidadeId"
  WHERE NOT EXISTS (
    SELECT 1 FROM "PrecoAtualProduto" pa
    WHERE pa."produtoId" = p.id AND pa."unidadeId" = un.id AND pa.preco > 0
  )
)
SELECT
  CASE
    WHEN EXISTS (
           SELECT 1 FROM "Receita" rc
           WHERE rc."unidadeId" = l.casa_id AND lower(btrim(rc.nome)) = l.nome_busca
             AND (SELECT count(*) FROM "IngredienteReceita" x WHERE x."receitaId" = rc.id) = 1
             AND EXISTS (
                   SELECT 1 FROM "IngredienteReceita" x
                   JOIN "Produto" p2 ON p2.id = x."produtoId"
                   WHERE x."receitaId" = rc.id
                     AND regexp_replace(lower(btrim(p2.nome)), '^sb\s+', '') = l.nome_busca
                 )
         )
      THEN 'RECEITA E CASCA (nao resolve)'
    WHEN EXISTS (SELECT 1 FROM "Receita" rc WHERE rc."unidadeId" = l.casa_id AND lower(btrim(rc.nome)) = l.nome_busca)
      THEN 'REPONTAR'
    WHEN EXISTS (SELECT 1 FROM "Receita" r2 WHERE lower(btrim(r2.nome)) = l.nome_busca)
      THEN 'COPIAR DE OUTRA CASA'
    ELSE 'DECIDIR PRECO OU RECEITA'
  END                                            AS acao,
  count(*)                                       AS linhas_de_ficha,
  count(DISTINCT l.produto_id)                   AS produtos,
  count(*) FILTER (
    WHERE upper(btrim(l.un_linha)) IN ('KG','LT','L') AND l.quantidade >= 100
  )                                              AS com_alerta_de_quantidade
FROM linha_sem_custo l
GROUP BY 1
ORDER BY 2 DESC;
