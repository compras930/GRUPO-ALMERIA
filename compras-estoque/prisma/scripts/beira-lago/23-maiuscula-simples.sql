-- Tudo em MAIÚSCULA, e Carnes/Pescados/Massas viram PRINCIPAIS.
-- UM COMANDO SÓ.
--
-- O 20 fazia a mesma coisa dentro de BEGIN/COMMIT e com um bloco DO que
-- abortava em caso de colisão. Só que a colisão é ZERO — o 22 provou —, então o
-- guarda não protege de nada e é a única peça do arquivo que pode falhar sem
-- dizer claramente por quê. Fora ele.
--
-- Um UPDATE sozinho é atômico por si: ou grava as 282 linhas, ou nenhuma.
-- BEGIN/COMMIT ali era decoração.
--
-- O console do Neon mostra o resultado numa aba "UPDATE n". ME MANDE ESSE n.
UPDATE "ItemVenda" iv
   SET categoria = CASE
         WHEN upper(btrim(iv.categoria)) IN ('CARNES', 'PESCADOS', 'MASSAS') THEN 'PRINCIPAIS'
         ELSE upper(btrim(iv.categoria))
       END
  FROM "Unidade" u
 WHERE u.id = iv."unidadeId"
   AND u.nome = 'Beira Lago'
   AND iv.categoria IS NOT NULL
   AND iv.categoria IS DISTINCT FROM CASE
         WHEN upper(btrim(iv.categoria)) IN ('CARNES', 'PESCADOS', 'MASSAS') THEN 'PRINCIPAIS'
         ELSE upper(btrim(iv.categoria))
       END;
