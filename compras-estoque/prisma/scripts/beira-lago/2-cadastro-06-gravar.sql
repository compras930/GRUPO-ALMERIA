-- PARTE 06 de 06 — o cadastro. É A ÚNICA QUE ESCREVE no catálogo.
-- Só depois de ler a parte 05.
-- ---------------------------------------------------------------------------
-- 5. O CADASTRO. É o único passo que escreve.
--
--    AJUSTE A LISTA DE GRUPOS. Cadastrar tudo deixa a compra inteira do Beira
--    Lago visível — que é o que se quer pra "quanto foi gasto". Mas três
--    grupos NÃO são matéria-prima de prato vendido:
--
--      ALIMENTAÇÃO FUNCIONÁRIO    R$ 34.979,66
--      HIGIENE E LIMPEZA          R$ 26.743,50
--      DESCARTÁVEIS E EMBALAGENS  R$ 24.665,20
--
--    Hoje a tela de consumo (src/app/(app)/estoque/consumo/page.tsx) não filtra
--    por categoria: tudo que tiver saldo e contagem entra no mesmo número. A
--    categoria vai gravada justamente pra dar o filtro depois — mas enquanto o
--    filtro não existe, esses R$ 86 mil aparecem junto do CMV se forem contados.
--
--    Comente a linha do grupo que não quiser cadastrar AGORA.
--
--    O NOT EXISTS é case-insensitive de propósito: o unique do Postgres é
--    byte a byte, então sem ele "Queijo Gouda" e "QUEIJO GOUDA" entrariam os
--    dois e o casamento (que ignora caixa) passaria a ter duas respostas.
-- ---------------------------------------------------------------------------
BEGIN;

-- 5a. O que vai ficar DE FORA: nome que já existe no catálogo em OUTRA
--     unidade de medida.
--
--     Isto não é zelo extra, é o que o NOT EXISTS do passo 5 NÃO cobre: ele
--     compara (nome, unidade), então um "ACELGA" em KG passa limpo por cima de
--     um "ACELGA" em LT que já existe — e aí são dois produtos de mesmo nome,
--     com a compra num e a contagem no outro. O consumo dos dois sai errado, e
--     sai errado em silêncio, que é o pior jeito.
--
--     O que fica de fora aqui continua aparecendo como "não reconhecido" na
--     carga, que é visível e cobra uma decisão. Produto partido em dois não
--     cobra nada de ninguém.
--
--     A decisão, depois, é uma de duas: ConversaoUnidadeCompra (quando são
--     embalagens do mesmo produto — 1 LT de Aperol = 1,333 garrafas de 750ml)
--     ou corrigir a unidade do cadastro (quando ela está simplesmente errada).
--     As duas mexem em produto que as OUTRAS casas já usam — por isso não são
--     feitas aqui.
--     Esta consulta SÓ LISTA. A exclusão acontece no WHERE do INSERT logo
--     abaixo, e não apagando linha daqui: a lista das 396 continua inteira na
--     tabela de trabalho, que é de onde o 4-conflito-de-unidade.sql lê — antes
--     ou depois deste passo, tanto faz. Script que destrói o próprio insumo de
--     diagnóstico obriga a acertar a ordem na primeira tentativa.
SELECT c.nome, c.unidade AS unidade_da_compra, p."unidadeMedida" AS ja_cadastrado_em, c.valor
FROM "_bl_cadastro" c
JOIN "Produto" p
  ON lower(regexp_replace(btrim(p.nome), '\s+', ' ', 'g')) = lower(c.nome)
 AND p."unidadeMedida" <> c.unidade
ORDER BY c.valor DESC;

INSERT INTO "Produto" (id, nome, "unidadeMedida", categoria, ativo, "criadoEm")
SELECT
  'bl' || substr(md5(c.nome || '|' || c.unidade), 1, 23),
  c.nome,
  c.unidade,
  c.grupo,
  true,
  now()
FROM "_bl_cadastro" c
WHERE c.grupo IN (
  'VINHOS',
  'MATERIA PRIMA',
  'BEBIDAS',
  'EVENTOS',
  'ALIMENTAÇÃO FUNCIONÁRIO',
  'HIGIENE E LIMPEZA',
  'DESCARTÁVEIS E EMBALAGENS'
)
-- Já existe com ESTA unidade: nada a fazer, a linha devia ter casado sozinha.
AND NOT EXISTS (
  SELECT 1 FROM "Produto" p
  WHERE lower(regexp_replace(btrim(p.nome), '\s+', ' ', 'g')) = lower(c.nome)
    AND p."unidadeMedida" = c.unidade
)
-- Já existe com OUTRA unidade: é o do passo 5a, e é o que não pode entrar.
AND NOT EXISTS (
  SELECT 1 FROM "Produto" p
  WHERE lower(regexp_replace(btrim(p.nome), '\s+', ' ', 'g')) = lower(c.nome)
    AND p."unidadeMedida" <> c.unidade
);

COMMIT;

-- ---------------------------------------------------------------------------
-- 6. CONFERÊNCIA FINAL, por grupo.
--
--    "cadastrados" + "fora_por_conflito" tem que fechar com "na_lista" em
--    todo grupo que você NÃO comentou no passo 5. "fora_por_conflito" é
--    exatamente o que o passo 5a listou — e continua pendente, não resolvido:
--    essas linhas vão voltar como "não reconhecidas" na próxima carga, até
--    alguém decidir conversão ou correção de unidade (4-conflito-de-unidade.sql).
-- ---------------------------------------------------------------------------
SELECT c.grupo,
       count(*) AS na_lista,
       count(p.id) AS cadastrados,
       count(*) FILTER (
         WHERE EXISTS (SELECT 1 FROM "Produto" x
                        WHERE lower(regexp_replace(btrim(x.nome), '\s+', ' ', 'g')) = lower(c.nome)
                          AND x."unidadeMedida" <> c.unidade)
       ) AS fora_por_conflito,
       round(sum(c.valor), 2) AS valor
FROM "_bl_cadastro" c
LEFT JOIN "Produto" p
  ON lower(regexp_replace(btrim(p.nome), '\s+', ' ', 'g')) = lower(c.nome)
 AND p."unidadeMedida" = c.unidade
GROUP BY c.grupo
ORDER BY valor DESC;

-- ---------------------------------------------------------------------------
-- 7. LIMPEZA, só depois de conferir o passo 6. Descomente e rode.
--    A tabela não atrapalha nada se ficar — ela só não é do app.
-- ---------------------------------------------------------------------------
-- DROP TABLE "_bl_cadastro";

-- Depois do passo 5: mande a MESMA carga de novo pela rota /api/n8n/precos.
-- Nada duplica — a `chave` XMENU|id_entrada|sequencia já está gravada e as
-- linhas repetidas são puladas. O que muda é que agora elas casam: preço e
-- entrada de estoque entram para os produtos recém-criados, com a data da
-- nota (não a data da carga). `naoReconhecidos` tem que cair de 396 para
-- perto de zero.
