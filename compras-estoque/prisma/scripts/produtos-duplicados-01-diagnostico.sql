-- Diagnóstico (SÓ LEITURA — não altera nada) dos produtos duplicados por
-- variação de maiúscula/minúscula no nome.
--
-- Contexto: a constraint @@unique([nome, unidadeMedida]) do Produto não impede
-- "BURRATA" e "Burrata" de coexistirem (texto em Postgres é case-sensitive, e
-- normalizarNome só faz trim/colapso de espaço). Enquanto a resolução de
-- ingrediente era por nome, isso fazia a ficha técnica gravar o produto errado
-- silenciosamente. O código já foi corrigido (resolve por id, e criar produto
-- novo pela ficha agora checa existência case-insensitive), mas as linhas
-- duplicadas que já existem no banco continuam lá — este diagnóstico mostra
-- quais são e quanto cada variante é usada, pra decidir a mesclagem com
-- segurança antes de rodar o 02-mesclar.sql.
--
-- Como rodar: cole tudo no SQL Editor do Neon e execute.

-- ---------------------------------------------------------------------------
-- 1) Grupos de duplicidade REAL (mesmo nome ignorando caixa + MESMA unidade de
--    medida). São esses que o 02-mesclar.sql vai unificar.
-- ---------------------------------------------------------------------------
WITH grupos AS (
  SELECT lower(btrim(nome)) AS nome_chave, "unidadeMedida", count(*) AS variantes
  FROM "Produto"
  GROUP BY lower(btrim(nome)), "unidadeMedida"
  HAVING count(*) > 1
)
SELECT
  g.nome_chave                                                                      AS grupo,
  p."unidadeMedida"                                                                 AS unidade_medida,
  p.id                                                                              AS produto_id,
  p.nome                                                                            AS grafia,
  p.ativo,
  p."criadoEm"                                                                      AS criado_em,
  (SELECT count(*) FROM "IngredienteReceita"      x WHERE x."produtoId" = p.id)     AS em_fichas,
  (SELECT count(*) FROM "PrecoAtualProduto"       x WHERE x."produtoId" = p.id)     AS precos_atuais,
  (SELECT count(*) FROM "HistoricoPrecoProduto"   x WHERE x."produtoId" = p.id)     AS historico_preco,
  (SELECT count(*) FROM "EstoqueSaldo"            x WHERE x."produtoId" = p.id)     AS saldos_estoque,
  (SELECT count(*) FROM "MovimentoEstoque"        x WHERE x."produtoId" = p.id)     AS movimentos,
  (SELECT count(*) FROM "ContagemEstoque"         x WHERE x."produtoId" = p.id)     AS contagens,
  (SELECT count(*) FROM "ItemPedido"              x WHERE x."produtoId" = p.id)     AS itens_pedido,
  (SELECT count(*) FROM "ItemNotaCompra"          x WHERE x."produtoId" = p.id)     AS itens_nota,
  (SELECT count(*) FROM "ParametroEstoqueProduto" x WHERE x."produtoId" = p.id)     AS parametros
FROM "Produto" p
JOIN grupos g
  ON lower(btrim(p.nome)) = g.nome_chave
 AND p."unidadeMedida" = g."unidadeMedida"
ORDER BY g.nome_chave, p."criadoEm";

-- ---------------------------------------------------------------------------
-- 2) Homônimos com unidade de medida DIFERENTE (ex.: "AZEITE"/LT e "AZEITE"/UND).
--    O 02-mesclar.sql NÃO mexe nesses de propósito: podem ser catálogo
--    legitimamente distinto (o mesmo insumo comprado a granel e em embalagem)
--    ou podem ser erro de cadastro — só uma pessoa que conhece a operação sabe
--    dizer. Lista aqui só pra revisão manual.
-- ---------------------------------------------------------------------------
WITH grupos AS (
  SELECT lower(btrim(nome)) AS nome_chave, count(DISTINCT "unidadeMedida") AS unidades
  FROM "Produto"
  GROUP BY lower(btrim(nome))
  HAVING count(DISTINCT "unidadeMedida") > 1
)
SELECT
  g.nome_chave                                                                  AS grupo,
  p.id                                                                          AS produto_id,
  p.nome                                                                        AS grafia,
  p."unidadeMedida"                                                             AS unidade_medida,
  p.ativo,
  (SELECT count(*) FROM "IngredienteReceita" x WHERE x."produtoId" = p.id)      AS em_fichas,
  (SELECT count(*) FROM "PrecoAtualProduto"  x WHERE x."produtoId" = p.id)      AS precos_atuais
FROM "Produto" p
JOIN grupos g ON lower(btrim(p.nome)) = g.nome_chave
ORDER BY g.nome_chave, p."unidadeMedida";

-- ---------------------------------------------------------------------------
-- 3) Resumo de uma linha (quantos grupos e quantas linhas serão mescladas).
-- ---------------------------------------------------------------------------
WITH grupos AS (
  SELECT lower(btrim(nome)) AS nome_chave, "unidadeMedida", count(*) AS variantes
  FROM "Produto"
  GROUP BY lower(btrim(nome)), "unidadeMedida"
  HAVING count(*) > 1
)
SELECT
  count(*)                        AS grupos_duplicados,
  coalesce(sum(variantes), 0)     AS linhas_envolvidas,
  coalesce(sum(variantes - 1), 0) AS linhas_que_serao_removidas
FROM grupos;
