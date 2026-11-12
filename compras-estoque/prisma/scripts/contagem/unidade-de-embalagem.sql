-- Diagnóstico: produto CADASTRADO EM UNIDADE DE EMBALAGEM.
--
-- Só leitura. Nada é alterado por este arquivo.
--
-- POR QUE IMPORTA. A unidade do produto é a régua de TUDO: é nela que o saldo
-- vive, que a contagem é lançada, que a nota entra (convertida pelo fator) e
-- que a ficha técnica desconta. Quando ela é CX, FD ou PCT, três coisas
-- deixam de bater e nenhuma delas reclama:
--
--   1. QUEM CONTA abre a caixa. A cozinha tem 7 unidades soltas e meia caixa
--      na prateleira; lançar "0,8 CX" é adivinhação, e lançar "7" quando a
--      régua é caixa multiplica o estoque pelo tamanho da embalagem.
--   2. A FICHA TÉCNICA usa a unidade de uso (KG, UND). Se a ficha desconta
--      0,2 KG e o saldo está em CX, o consumo teórico sai numa escala e o
--      contado em outra — e o CMV compara laranja com caixa de laranja.
--   3. O PREÇO fica por caixa. R$ 180/CX e R$ 7,50/UND são o mesmo preço,
--      mas só o segundo dá para comparar com o da semana passada quando o
--      fornecedor muda o tamanho da caixa.
--
-- O QUE FAZER COM O RESULTADO: para cada linha, decidir qual é a unidade de
-- CONTAGEM de verdade (a que a cozinha usa na prateleira). Mudar o cadastro
-- exige converter junto o saldo, as contagens já lançadas e o preço — por
-- isso este arquivo só DIAGNOSTICA. Com a lista em mãos eu escrevo a conversão.

-- 1. Produtos na folha de contagem (curva A ou B) cadastrados em embalagem.
SELECT u.nome                AS casa,
       pe."classeAbc",
       p.nome                AS produto,
       p."unidadeMedida"     AS unidade_do_cadastro,
       pa.preco              AS preco_atual,
       (SELECT count(*) FROM "IngredienteReceita" i WHERE i."produtoId" = p.id) AS usos_em_ficha,
       (SELECT string_agg(DISTINCT i."unidadeMedida", ', ')
          FROM "IngredienteReceita" i WHERE i."produtoId" = p.id)               AS unidades_na_ficha
  FROM "ParametroEstoqueProduto" pe
  JOIN "Produto" p ON p.id = pe."produtoId"
  JOIN "Unidade" u ON u.id = pe."unidadeId"
  LEFT JOIN "PrecoAtualProduto" pa ON pa."produtoId" = p.id AND pa."unidadeId" = pe."unidadeId"
 WHERE pe."classeAbc" IN ('A', 'B')
   AND upper(btrim(p."unidadeMedida")) IN
       ('CX', 'CAIXA', 'FD', 'FARDO', 'PCT', 'PACOTE', 'SACO', 'SC', 'BALDE', 'BOBINA', 'ROLO', 'PC', 'PÇ', 'DZ', 'BD', 'LA')
 ORDER BY u.nome, p.nome;

-- 2. O caso GRAVE: produto em embalagem que a FICHA usa em outra unidade.
--    Aqui o CMV teórico e o contado já estão em escalas diferentes.
SELECT DISTINCT
       p.nome            AS produto,
       p."unidadeMedida" AS unidade_do_cadastro,
       i."unidadeMedida" AS unidade_na_ficha,
       count(*) OVER (PARTITION BY p.id) AS fichas_afetadas
  FROM "IngredienteReceita" i
  JOIN "Produto" p ON p.id = i."produtoId"
 WHERE upper(btrim(p."unidadeMedida")) IN
       ('CX', 'CAIXA', 'FD', 'FARDO', 'PCT', 'PACOTE', 'SACO', 'SC', 'BALDE', 'BOBINA', 'ROLO', 'PC', 'PÇ', 'DZ', 'BD', 'LA')
   AND upper(btrim(i."unidadeMedida")) <> upper(btrim(p."unidadeMedida"))
 ORDER BY produto;

-- 3. Quanto cada um desses pesa na compra dos últimos 3 meses — é o que diz
--    quais consertar primeiro.
SELECT p.nome AS produto,
       p."unidadeMedida" AS unidade_do_cadastro,
       round(sum(coalesce(ic."valorTotal", ic.quantidade * ic."precoUnitNovo"))::numeric, 2) AS comprado_3m,
       count(*) AS linhas_de_nota,
       string_agg(DISTINCT coalesce(ic."unidadeBruta", '?'), ', ') AS unidades_na_nota
  FROM "ItemNotaCompra" ic
  JOIN "Produto" p ON p.id = ic."produtoId"
 WHERE ic."dataCompra" >= date_trunc('month', now()) - interval '2 months'
   AND upper(btrim(p."unidadeMedida")) IN
       ('CX', 'CAIXA', 'FD', 'FARDO', 'PCT', 'PACOTE', 'SACO', 'SC', 'BALDE', 'BOBINA', 'ROLO', 'PC', 'PÇ', 'DZ', 'BD', 'LA')
 GROUP BY 1, 2
 ORDER BY comprado_3m DESC;
