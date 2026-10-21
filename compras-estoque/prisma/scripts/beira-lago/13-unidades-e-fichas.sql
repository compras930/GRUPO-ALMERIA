-- Diagnóstico das unidades e rendimentos apontados na lista de compra
-- de 01/10 a 20/10 do Beira Lago.
--
-- SÓ LÊ. Nenhum passo escreve. O conserto sai depois, com o resultado na mão.
--
-- O MECANISMO POR TRÁS DE QUASE TUDO ISTO, antes das consultas:
--
-- A unidade escrita na FICHA é um rótulo. `explodirReceitaPura` multiplica a
-- quantidade e pronto; `IngredienteReceita.unidadeMedida` não entra em
-- nenhuma conta, nem no custo nem na baixa de estoque. Então uma ficha que
-- diz "2 UND de gema" contra um produto cadastrado em KG consome 2 KG de gema
-- e paga 2 x o preço do quilo. Ninguém reclama, porque não há nada que
-- compare as duas unidades.
--
-- Isso dá em duas doenças de sinais opostos, e a segunda é a perigosa:
--
--   - a quantidade INFLA (BURRATA: 47 "kg" numa semana são 47 unidades);
--   - o custo DESINFLA (GEMA: o preço de uma gema, R$ 0,70, lido como preço
--     do quilo, faz 0,02 kg de gema custar um centavo e meio).
--
-- Prato com insumo barato demais parece lucrativo e vai pro cardápio. É o
-- mesmo caso do TOMATE PELADO a R$ 6,88/kg que já está na fila.
--
-- Rode um passo de cada vez e me mande o resultado de cada um.

-- =====================================================================
-- PASSO 1 — A VARREDURA. Onde a ficha e o cadastro discordam da unidade.
--
-- Isto não é a lista dos 6 itens que você apontou: é TODA ficha do Beira
-- Lago cujo ingrediente está numa unidade diferente da do produto. Os seus 6
-- devem aparecer aqui dentro; o que mais aparecer é do mesmo bug e ninguém
-- tinha visto ainda.
-- =====================================================================
SELECT p.nome AS produto,
       p."unidadeMedida" AS unidade_do_cadastro,
       ing."unidadeMedida" AS unidade_na_ficha,
       count(*) AS fichas,
       round(min(pa.preco)::numeric, 4) AS preco_atual,
       string_agg(DISTINCT r.nome, ' | ' ORDER BY r.nome) AS receitas
FROM "IngredienteReceita" ing
JOIN "Receita" r ON r.id = ing."receitaId"
JOIN "Unidade" u ON u.id = r."unidadeId"
JOIN "Produto" p ON p.id = ing."produtoId"
-- Receita segue a COZINHA (a casa); preço segue a DESPENSA. No Beira Lago as
-- duas são a mesma unidade, mas o COALESCE mantém a consulta correta se
-- alguém rodar isto para Noroeste ou Matri, que dividem despensa.
LEFT JOIN "PrecoAtualProduto" pa
       ON pa."produtoId" = p.id
      AND pa."unidadeId" = COALESCE(u."estoqueEmId", u.id)
WHERE u.nome = 'Beira Lago'
  AND upper(btrim(ing."unidadeMedida")) <> upper(btrim(p."unidadeMedida"))
GROUP BY 1, 2, 3
ORDER BY fichas DESC, produto;

-- =====================================================================
-- PASSO 2 — OS 6 APONTADOS: o que o cadastro diz, e o que a NOTA diz.
--
-- A coluna que decide é `unidade_na_nota`: é como o fornecedor vendeu. Se a
-- nota traz UND/MC/PCT e o cadastro diz KG, o preço gravado é o preço da
-- unidade com o nome de quilo — e aí o conserto é o do cadastro, não o da
-- ficha.
--
-- `preco_por_unidade_na_nota` é só valorTotal/quantidade da nota, pra você
-- comparar com o preço atual sem abrir planilha.
-- =====================================================================
SELECT p.nome AS produto,
       p."unidadeMedida" AS unidade_do_cadastro,
       round(pa.preco::numeric, 4) AS preco_atual,
       i."unidadeBruta" AS unidade_na_nota,
       -- count(i.id), não count(*): com LEFT JOIN, `count(*)` conta a linha
       -- vazia e um produto que NUNCA foi comprado apareceria com "1 linha de
       -- nota" e todo o resto nulo — exatamente a leitura oposta da verdadeira.
       count(i.id) AS linhas_de_nota,
       round(sum(i.quantidade)::numeric, 3) AS qtd_comprada,
       round(sum(i."valorTotal")::numeric, 2) AS valor_comprado,
       round((sum(i."valorTotal") / NULLIF(sum(i.quantidade), 0))::numeric, 4) AS preco_por_unidade_na_nota,
       max(i."dataCompra")::date AS ultima_compra
FROM "Produto" p
JOIN "Unidade" u ON u.nome = 'Beira Lago'
LEFT JOIN "PrecoAtualProduto" pa
       ON pa."produtoId" = p.id
      AND pa."unidadeId" = COALESCE(u."estoqueEmId", u.id)
-- A nota é da DESPENSA, e o preço é da despensa também. Sem este escopo, a
-- compra das outras casas entraria na média e o preço_por_unidade_na_nota
-- deixaria de ser comparável com o preço_atual daqui.
LEFT JOIN "ItemNotaCompra" i ON i."produtoId" = p.id
  AND EXISTS (
    SELECT 1 FROM "NotaCompra" nc
    WHERE nc.id = i."notaCompraId"
      AND nc."unidadeId" = COALESCE(u."estoqueEmId", u.id)
  )
WHERE upper(btrim(p.nome)) LIKE ANY (ARRAY[
        'GEMA%', 'BURRATA%', 'SALS_O%', 'AGUA COCC%', '_GUA COCC%',
        'TOMATE ITALIANO%', 'ATUM%',
        'VINHO BRANCO%', 'VINHO TINTO CULIN%', 'CONHAQUE DOMECQ%', 'VINHO PERMATIN%'
      ])
GROUP BY 1, 2, 3, 4
ORDER BY produto, unidade_na_nota;

-- =====================================================================
-- PASSO 3 — TOMATE ITALIANO E ATUM: de onde vêm os 287 kg e os 41 kg.
--
-- Abre o consumo por FICHA, não por produto: mostra quanto cada receita pediu
-- e quantos pratos foram vendidos. Se uma receita sozinha responde por quase
-- tudo, o rendimento dela é o suspeito; se o volume vem espalhado por muitas,
-- o problema é a unidade do insumo, não a ficha.
--
-- `qtd_na_ficha` é por lote. `rendimento` é quantos a receita rende — nulo
-- significa "rende 1", e é aí que mora o erro clássico: ficha escrita para um
-- lote de 20 porções com rendimento em branco cobra as 20 em cada prato.
-- =====================================================================
SELECT pr.nome AS insumo,
       r.nome AS receita,
       r."rendimentoQtd" AS rendimento,
       r."rendimentoUnidade" AS rendimento_unidade,
       ing.quantidade AS qtd_na_ficha,
       ing."unidadeMedida" AS unidade_na_ficha,
       iv.nome AS item_de_venda,
       round(sum(ivs."quantidadeVendida")::numeric, 1) AS vendidos_no_periodo,
       round((ing.quantidade * sum(ivs."quantidadeVendida")
              / COALESCE(NULLIF(r."rendimentoQtd", 0), 1))::numeric, 2) AS consumo_calculado
FROM "IngredienteReceita" ing
JOIN "Produto" pr ON pr.id = ing."produtoId"
JOIN "Receita" r ON r.id = ing."receitaId"
JOIN "Unidade" u ON u.id = r."unidadeId"
JOIN "ItemVenda" iv ON iv."receitaId" = r.id
LEFT JOIN "ItemVendaSemanal" ivs ON ivs."itemVendaId" = iv.id
LEFT JOIN "VendaSemanal" vs ON vs.id = ivs."vendaSemanalId"
WHERE u.nome = 'Beira Lago'
  AND upper(btrim(pr.nome)) LIKE ANY (ARRAY['TOMATE ITALIANO%', 'ATUM%'])
  AND (vs."periodoFim" IS NULL
       OR (vs."periodoFim" >= DATE '2026-10-01' AND vs."periodoFim" <= DATE '2026-10-20'))
GROUP BY 1, 2, 3, 4, 5, 6, 7
ORDER BY consumo_calculado DESC NULLS LAST;

-- =====================================================================
-- PASSO 4 — OS GÊMEOS. O mesmo insumo cadastrado duas vezes, em unidades
-- diferentes.
--
-- É exatamente o caso da ACELGA de agosto. Importa porque o conserto muda:
-- produto sozinho na unidade errada se corrige trocando a unidade; produto
-- com gêmeo na unidade certa precisa ser FUNDIDO, e fundir mexe em ficha,
-- saldo, preço e histórico de compra.
--
-- NÃO rode UPDATE nenhum a partir daqui. Me mande o resultado.
-- =====================================================================
SELECT lower(btrim(p.nome)) AS nome_normalizado,
       count(*) AS cadastros,
       string_agg(p."unidadeMedida", ' / ' ORDER BY p."unidadeMedida") AS unidades,
       string_agg(
         p."unidadeMedida" || '=' || COALESCE(round(pa.preco::numeric, 4)::text, 'sem preço'),
         ' / ' ORDER BY p."unidadeMedida"
       ) AS precos,
       string_agg(
         p."unidadeMedida" || '=' || (
           SELECT count(*) FROM "IngredienteReceita" ig
           JOIN "Receita" rr ON rr.id = ig."receitaId"
           WHERE ig."produtoId" = p.id AND rr."unidadeId" = u.casa
         )::text,
         ' / ' ORDER BY p."unidadeMedida"
       ) AS fichas_que_usam
FROM "Produto" p
CROSS JOIN LATERAL (
  SELECT id AS casa, COALESCE("estoqueEmId", id) AS despensa
  FROM "Unidade" WHERE nome = 'Beira Lago'
) u
LEFT JOIN "PrecoAtualProduto" pa ON pa."produtoId" = p.id AND pa."unidadeId" = u.despensa
GROUP BY 1
HAVING count(*) > 1
ORDER BY cadastros DESC, nome_normalizado;

-- =====================================================================
-- PASSO 5 — AGUA COCCÃO e companhia: o que entra na lista de compra sem
-- nunca ter sido comprado.
--
-- A lista de compra sugere TUDO que foi consumido. Água de cocção é
-- ingrediente de verdade na ficha (e custa nada), mas ninguém compra água de
-- cocção — ela não deveria sair numa lista que alguém vai usar pra fazer
-- pedido.
--
-- Esta consulta acha a classe inteira: insumo que aparece em ficha, tem preço
-- de centavos ou nenhum, e NUNCA apareceu numa nota de compra. Com a lista na
-- mão a gente decide o que fazer com ela — tirar das fichas ou marcar como
-- não comprável.
-- =====================================================================
SELECT p.nome AS insumo,
       p."unidadeMedida" AS unidade,
       round(COALESCE(pa.preco, 0)::numeric, 4) AS preco_atual,
       count(DISTINCT ing."receitaId") AS fichas_que_usam
FROM "Produto" p
JOIN "Unidade" u ON u.nome = 'Beira Lago'
JOIN "IngredienteReceita" ing ON ing."produtoId" = p.id
JOIN "Receita" r ON r.id = ing."receitaId" AND r."unidadeId" = u.id
LEFT JOIN "PrecoAtualProduto" pa
       ON pa."produtoId" = p.id
      AND pa."unidadeId" = COALESCE(u."estoqueEmId", u.id)
WHERE COALESCE(pa.preco, 0) < 0.10
  AND NOT EXISTS (SELECT 1 FROM "ItemNotaCompra" i WHERE i."produtoId" = p.id)
GROUP BY 1, 2, 3
ORDER BY fichas_que_usam DESC, insumo;
