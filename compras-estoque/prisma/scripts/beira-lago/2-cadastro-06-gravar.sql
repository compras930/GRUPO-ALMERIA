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
AND NOT EXISTS (
  SELECT 1 FROM "Produto" p
  WHERE lower(regexp_replace(btrim(p.nome), '\s+', ' ', 'g')) = lower(c.nome)
    AND p."unidadeMedida" = c.unidade
);

COMMIT;

-- ---------------------------------------------------------------------------
-- 6. CONFERÊNCIA FINAL: quantos dos 396 existem agora, por grupo.
--    "faltam" só pode ser > 0 nos grupos que você comentou no passo 5, ou nos
--    que o passo 3 mandou tirar.
-- ---------------------------------------------------------------------------
SELECT c.grupo,
       count(*) AS na_lista,
       count(p.id) AS cadastrados,
       count(*) - count(p.id) AS faltam,
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
