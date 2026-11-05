-- De onde veio a venda de outubro do Wine Garden, e o que ela mexeu.
--
-- O reenvio voltou 409: já existe venda semanal de 01/10 a 31/10 para essa
-- casa. Ninguém sabe quem a gravou. Antes de apagar qualquer coisa, é preciso
-- saber O QUE ELA FEZ — carga de venda não grava só a venda: ela baixa estoque
-- pela ficha, pode abrir pedido de compra em rascunho e cadastra item de venda
-- sozinha.
--
-- Os passos 1 a 5 só LEEM. O passo 6 apaga, e só deve ser rodado depois de os
-- outros cinco confirmarem que não há nada preso nela.

-- =====================================================================
-- 1. A CARGA: quando, por quem, e com que cara.
--
-- `criadoEm` responde a suspeita do Execute step: se for 04/11 depois das
-- 16h, foi ele.
-- =====================================================================
SELECT '1. a carga' AS parte,
       vs.id AS venda_semanal_id,
       vs."criadoEm" AS gravada_em,
       u.nome AS casa,
       vs."periodoInicio"::date AS de,
       vs."periodoFim"::date AS ate,
       usr.nome AS por
FROM "VendaSemanal" vs
JOIN "Unidade" u ON u.id = vs."unidadeId"
LEFT JOIN "Usuario" usr ON usr.id = vs."importadoPorId"
WHERE u.nome = 'Wine Garden'
  AND vs."periodoInicio" < DATE '2026-11-01'
  AND vs."periodoFim" >= DATE '2026-10-01';

-- =====================================================================
-- 2. QUAL VALOR FOI ENVIADO. É esta soma que decide tudo.
--
--   R$ 663.889,27 -> foi com FATURAMENTO (antes do desconto): errado, refaz
--   R$ 661.351,59 -> foi com LÍQUIDO: está certo, não mexe em nada
--   outro número  -> veio de outro lugar, e aí a gente conversa antes
--
-- `itens` esperado: 306. `sem_item_casado` tem que ser 0 — todas as linhas
-- trazem código, então todas deveriam ter casado ou criado item.
-- =====================================================================
SELECT '2. o valor' AS parte,
       count(*) AS itens,
       round(sum(ivs."valorVendido")::numeric, 2) AS soma_do_valor,
       round(sum(ivs."quantidadeVendida")::numeric, 3) AS quantidade,
       count(*) FILTER (WHERE ivs."itemVendaId" IS NULL) AS sem_item_casado
FROM "ItemVendaSemanal" ivs
JOIN "VendaSemanal" vs ON vs.id = ivs."vendaSemanalId"
JOIN "Unidade" u ON u.id = vs."unidadeId"
WHERE u.nome = 'Wine Garden'
  AND vs."periodoInicio" < DATE '2026-11-01'
  AND vs."periodoFim" >= DATE '2026-10-01';

-- =====================================================================
-- 3. BAIXOU ESTOQUE? Esta é a pergunta que decide se dá para apagar limpo.
--
-- A carga só consome insumo de item COM ficha. O Wine Garden não tem ficha
-- nenhuma, então o esperado aqui é ZERO linhas. Se vier alguma, apagar a
-- venda deixaria o estoque baixado sem a venda que o justifica — e aí o
-- conserto é outro, não este arquivo.
-- =====================================================================
SELECT '3. baixa de estoque' AS parte,
       count(*) AS movimentos,
       round(COALESCE(sum(m.quantidade), 0)::numeric, 3) AS quantidade_total
FROM "MovimentoEstoque" m
WHERE m.referencia IN (
  SELECT vs.id FROM "VendaSemanal" vs
  JOIN "Unidade" u ON u.id = vs."unidadeId"
  WHERE u.nome = 'Wine Garden'
    AND vs."periodoInicio" < DATE '2026-11-01'
    AND vs."periodoFim" >= DATE '2026-10-01'
);

-- =====================================================================
-- 4. ABRIU PEDIDO DE COMPRA? A carga abre rascunho quando a ficha aponta
--    reposição. Sem ficha, o esperado é nenhum. Pedido órfão não quebra
--    nada, mas fica na tela de Pedidos como tarefa que ninguém pediu.
-- =====================================================================
SELECT '4. pedido aberto' AS parte,
       p.id, p.numero, p.status, p."criadoEm"
FROM "PedidoCompra" p
JOIN "Unidade" u ON u.id = p."unidadeId"
WHERE u.nome = 'Wine Garden'
  AND p."criadoEm" >= DATE '2026-11-04'
ORDER BY p."criadoEm" DESC;

-- =====================================================================
-- 5. OS ITENS QUE A CARGA CADASTROU SOZINHA.
--
-- Eles NÃO devem ser apagados junto com a venda. São o catálogo da casa: no
-- reenvio, as linhas casam por código com eles e `itensCriadosAutomaticamente`
-- volta vazio, que é o sinal de que o cadastro já estava lá.
--
-- Esperado: 306.
-- =====================================================================
SELECT '5. itens criados' AS parte,
       count(*) AS itens_automaticos,
       count(*) FILTER (WHERE iv."receitaId" IS NOT NULL) AS com_ficha,
       round(min(iv."precoVenda")::numeric, 2) AS menor_preco,
       round(max(iv."precoVenda")::numeric, 2) AS maior_preco
FROM "ItemVenda" iv
JOIN "Unidade" u ON u.id = iv."unidadeId"
WHERE u.nome = 'Wine Garden' AND iv."criadoAutomaticamente";

-- =====================================================================
-- 6. APAGAR — só depois de o passo 3 ter voltado ZERO movimentos.
--
-- As linhas da venda caem junto por cascata (ItemVendaSemanal tem onDelete:
-- Cascade). Os itens de venda cadastrados FICAM, de propósito.
--
-- Rode as duas linhas abaixo DESCOMENTADAS, uma de cada vez. Até lá, elas são
-- comentário: este arquivo pode ser rodado inteiro sem apagar nada.
-- =====================================================================
-- DELETE FROM "VendaSemanal" vs
--  USING "Unidade" u
--  WHERE u.id = vs."unidadeId"
--    AND u.nome = 'Wine Garden'
--    AND vs."periodoInicio" < DATE '2026-11-01'
--    AND vs."periodoFim" >= DATE '2026-10-01';

-- CONFERÊNCIA depois de apagar: tem que voltar vazio.
-- SELECT vs.id, vs."periodoInicio"::date, vs."periodoFim"::date
-- FROM "VendaSemanal" vs JOIN "Unidade" u ON u.id = vs."unidadeId"
-- WHERE u.nome = 'Wine Garden' AND vs."periodoFim" >= DATE '2026-10-01';
