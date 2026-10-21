-- Confere a fusão depois de rodada. SÓ LÊ.
--
-- Existe à parte porque o console do Neon mostra só o resultado da ÚLTIMA
-- consulta quando se roda um arquivo inteiro — e no 14-fundir-2 esta era a
-- penúltima, então ela passava batido justamente na hora de conferir.
--
-- O QUE TEM QUE DAR: `ainda_aponta` = 0 nas quatro linhas. Qualquer número
-- maior que zero é coisa que continua pendurada no produto desativado, e aí a
-- ficha ou o saldo ficaram para trás.
SELECT p.nome AS fantasma,
       p.ativo,
       (SELECT count(*) FROM "IngredienteReceita" i WHERE i."produtoId" = p.id) AS fichas,
       (SELECT count(*) FROM "EstoqueSaldo" s WHERE s."produtoId" = p.id) AS saldos,
       (SELECT count(*) FROM "PrecoAtualProduto" x WHERE x."produtoId" = p.id) AS precos,
       (SELECT count(*) FROM "ParametroEstoqueProduto" g WHERE g."produtoId" = p.id) AS parametros,
       (SELECT count(*) FROM "MovimentoEstoque" m WHERE m."produtoId" = p.id) AS movimentos,
       (SELECT count(*) FROM "ContagemEstoque" c WHERE c."produtoId" = p.id) AS contagens,
       (SELECT count(*) FROM "IngredienteReceita" i WHERE i."produtoId" = p.id)
     + (SELECT count(*) FROM "EstoqueSaldo" s WHERE s."produtoId" = p.id)
     + (SELECT count(*) FROM "PrecoAtualProduto" x WHERE x."produtoId" = p.id)
     + (SELECT count(*) FROM "ParametroEstoqueProduto" g WHERE g."produtoId" = p.id)
     + (SELECT count(*) FROM "MovimentoEstoque" m WHERE m."produtoId" = p.id)
     + (SELECT count(*) FROM "ContagemEstoque" c WHERE c."produtoId" = p.id) AS ainda_aponta
FROM "Produto" p
WHERE p.nome LIKE '%(fundido em %'
ORDER BY p.nome;
