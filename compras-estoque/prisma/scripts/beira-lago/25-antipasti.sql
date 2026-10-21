-- ANTIPASTI vira ENTRADAS.
--
-- Rode mesmo que você já tenha rodado o 24: aqui só mexe em ANTIPASTI, e rodar
-- duas vezes não muda nada (depois da primeira não sobra ANTIPASTI para casar).
--
-- O GERADOR FOI AJUSTADO JUNTO, e sem isso este UPDATE seria temporário: o
-- XMenu manda ITENS DO MENU >>> ANTIPASTI em toda carga, então a próxima leva
-- de itens recriaria a categoria. É a mesma mecânica que produziu TINTO ao lado
-- de Tintos. Agora `categoriaCanonicaPura` conhece o agrupamento, e qualquer
-- item novo que chegue como ANTIPASTI entra como ENTRADAS.

-- 1. COLISÕES. Tem que vir vazio: prato que exista nos dois lugares com o mesmo
--    nome faria o banco recusar o UPDATE.
SELECT a.tipo, a.nome, count(*) AS quantos_viram_um
FROM (
  SELECT iv.tipo, iv.nome
  FROM "ItemVenda" iv
  JOIN "Unidade" u ON u.id = iv."unidadeId" AND u.nome = 'Beira Lago'
  WHERE upper(btrim(iv.categoria)) IN ('ANTIPASTI', 'ENTRADAS')
) a
GROUP BY a.tipo, a.nome
HAVING count(*) > 1;

-- 2. O UPDATE. ENTRADAS deve ir de 83.727 para 89.847 (+ 6.120 de ANTIPASTI).
UPDATE "ItemVenda" iv
   SET categoria = 'ENTRADAS'
  FROM "Unidade" u
 WHERE u.id = iv."unidadeId"
   AND u.nome = 'Beira Lago'
   AND upper(btrim(iv.categoria)) = 'ANTIPASTI';
