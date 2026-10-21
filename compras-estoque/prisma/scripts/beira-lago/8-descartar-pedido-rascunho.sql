-- Descarta o pedido de compra rascunho que a primeira carga de vendas gerou.
--
-- POR QUE ELE EXISTE. A carga de venda não só registra venda: ela explode a
-- ficha de cada item CASADO, dá baixa teórica de estoque e sugere a reposição
-- num pedido rascunho. Com 29 itens casados de 231, a sugestão foi calculada
-- sobre 12% do cardápio — não é um pedido pequeno, é um pedido errado.
--
-- POR QUE APAGAR E NÃO CANCELAR. Rascunho não é documento: ele não foi
-- aprovado, não foi enviado a fornecedor e não tem recebimento. Guardá-lo como
-- "cancelado" encheria a tela de Pedidos de lixo que ninguém vai reler. Os
-- itens saem junto pelo ON DELETE CASCADE de ItemPedido.
--
-- O QUE ISTO **NÃO** DESFAZ: a baixa de estoque dos 29 que casaram. Ela está
-- certa — aqueles itens foram vendidos mesmo — e continua valendo.
--
-- Troque o id se for outro pedido. O passo 1 confere ANTES de apagar.

-- ---------------------------------------------------------------------------
-- 1. O que vai sair. Confira: status tem que ser RASCUNHO e a observação tem
--    que dizer que veio de venda semanal.
-- ---------------------------------------------------------------------------
SELECT p.id, p.numero, p.status, u.nome AS casa, p.observacao,
       (SELECT count(*) FROM "ItemPedido" i WHERE i."pedidoId" = p.id)   AS itens,
       (SELECT count(*) FROM "Recebimento" r WHERE r."pedidoId" = p.id)  AS recebimentos
FROM "PedidoCompra" p
JOIN "Unidade" u ON u.id = p."unidadeId"
WHERE p.id = 'cmvi0cu7m00mo1e0h3nymh4tc';

-- ---------------------------------------------------------------------------
-- 2. O descarte. Só apaga se ainda for RASCUNHO e não tiver recebimento —
--    as duas condições estão no WHERE, então rodar isto num pedido que
--    avançou não faz nada em vez de fazer estrago.
-- ---------------------------------------------------------------------------
DELETE FROM "PedidoCompra" p
WHERE p.id = 'cmvi0cu7m00mo1e0h3nymh4tc'
  AND p.status = 'RASCUNHO'
  AND NOT EXISTS (SELECT 1 FROM "Recebimento" r WHERE r."pedidoId" = p.id);

-- ---------------------------------------------------------------------------
-- 3. CONFERÊNCIA: tem que voltar vazio.
-- ---------------------------------------------------------------------------
SELECT id, numero, status FROM "PedidoCompra" WHERE id = 'cmvi0cu7m00mo1e0h3nymh4tc';
