-- Nome de item de venda em MAIÚSCULA, igual ao que já fizemos com a categoria.
--
-- POR QUE É SEGURO MEXER NO NOME. O casamento da venda é por CÓDIGO do PDV, e
-- quando cai para o nome usa `chaveComparacao`, que compara em minúscula
-- (src/lib/nome-normalizado.ts). Nenhum lugar do app compara nome com a caixa
-- original. Trocar a caixa não desfaz casamento nenhum — nem os antigos, que
-- já estão gravados por id.
--
-- `upper()` do Postgres preserva acento: 'Filé au Poivre' vira 'FILÉ AU
-- POIVRE', não 'FILE'. É o que se quer — tirar acento mudaria a palavra.
--
-- VALE PARA TODAS AS CASAS, não só o Beira Lago: nome em caixa mista numa casa
-- e maiúscula na outra é a mesma bagunça que acabamos de tirar da categoria.
--
-- Rodar duas vezes não faz nada na segunda: quem já está em maiúscula não
-- entra no WHERE.

-- =====================================================================
-- PASSO 1 — AS COLISÕES. Só lê. **Leia antes de rodar o passo 2.**
--
-- `ItemVenda` tem único em (unidade, tipo, categoria, nome). Se duas linhas
-- diferirem SÓ pela caixa — "Carpaccio" e "CARPACCIO" na mesma casa, mesmo
-- tipo, mesma categoria —, passá-las para maiúscula tenta criar duas linhas
-- idênticas e o banco recusa.
--
-- Se isto voltar VAZIO, pode rodar o passo 2 direto.
-- Se voltar alguma linha, NÃO rode: me mande, porque aí são dois cadastros
-- para a mesma coisa e a decisão é qual fica com a venda — fundir é diferente
-- de renomear.
-- =====================================================================
SELECT u.nome AS casa, iv.tipo, iv.categoria, upper(iv.nome) AS nome_em_maiuscula,
       count(*) AS quantos,
       string_agg(iv.nome, ' | ' ORDER BY iv.nome) AS grafias,
       string_agg(COALESCE(iv."codigoPdv", 'sem código'), ' | ' ORDER BY iv.nome) AS codigos
FROM "ItemVenda" iv
JOIN "Unidade" u ON u.id = iv."unidadeId"
GROUP BY u.nome, iv."unidadeId", iv.tipo, iv.categoria, upper(iv.nome)
HAVING count(*) > 1
ORDER BY casa, nome_em_maiuscula;

-- =====================================================================
-- PASSO 2 — O UPDATE. Um comando só, de propósito: o console do Neon já
-- engoliu bloco `DO $$ ... $$` em silêncio neste projeto (arquivo 20).
--
-- É atômico: se houver uma colisão que o passo 1 não pegou, o comando inteiro
-- falha e NADA muda. Não existe meio caminho aqui.
-- =====================================================================
UPDATE "ItemVenda" SET nome = upper(nome) WHERE nome <> upper(nome);

-- =====================================================================
-- PASSO 3 — CONFERÊNCIA: quantos ficaram fora da maiúscula por casa.
-- O esperado é `ainda_minusculo = 0` em todas.
-- =====================================================================
SELECT u.nome AS casa,
       count(*) AS itens,
       count(*) FILTER (WHERE iv.nome <> upper(iv.nome)) AS ainda_minusculo
FROM "ItemVenda" iv
JOIN "Unidade" u ON u.id = iv."unidadeId"
GROUP BY u.nome
ORDER BY itens DESC;
