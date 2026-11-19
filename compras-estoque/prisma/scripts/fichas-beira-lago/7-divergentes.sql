-- As seis fichas em que a planilha e o app discordam. SÓ LEITURA.
--
-- Nas outras 195 o número de ingredientes bate. Nestas não, e não dá para
-- supor qual lado vale: pode ser receita que mudou depois da planilha, pode
-- ser importação antiga que entrou pela metade. Quem decide é a cozinha.
--
-- O que a PLANILHA diz (para comparar com o que sair daqui):
--
--   FALAFEL (rend. 9,5 Kg) — 10 ingredientes
--     GRÃO DE BICO 3,4 · SALSA 0,4 · COENTRO 0,4 · ALHO 0,02 ·
--     BICARBONATO 0,02 · CEBOLA BRANCA 2,0 · COMINHO 0,02 ·
--     LIMÃO TAHITI 0,15 · SAL REFINADO 0,04 · AZEITE EXTRA VIRGEM 0,04
--
--   BACALHAU COZIDO (rend. 0,3 Kg) — 5
--     BACALHAU 0,22 · AZEITE EXTRA VIRGEM 0,1 · ALECRIM 0,002 ·
--     TOMILHO 0,002 · ALHO DESCASCADO 0,02
--
--   ROBALO MONTAGEM (rend. 0,615 Kg) — 5
--     ROBALO GRELHADO 0,22 · MOLHO VIN BLANC 0,08 (sub) · ASPARGOS 0,065 ·
--     PURE DE BANANA DA TERRA 0,12 (sub) · FAROFA DE BANANA 0,08 (sub)
--
--   CALDEIRADA MEDITERRANEA (rend. 0,453 Kg) — 9
--     POLVO GRELHADO 0,1 · CAMARÃO G 0,06 · TENTACULOS DE MINI LULA 0,06 ·
--     CALDO DE CAMARÃO 0,1 (sub) · MANTEIGA SEM SAL 0,03 · SAL REFINADO 0,002 ·
--     PIMENTA DO REINO 0,001 · PÃO RUSTICO BRANCO 0,1 · ROBALO CRU 0,05
--
--   STEAK AU POIVRE (rend. 0,5 Kg) — 3
--     SB- FILÉ RENDIMENTO 0,2 (sub) · MOLHO POIVRE 0,12 (sub) ·
--     BATATA RENDIMENTO 0,18 (sub)
--
--   ARROZ DE PATO (rend. 0,792 Kg) — 8, e o app tem 10
--     ARROZ ALTITUDE 0,07 · COXA E SOBRECOXA CONFIT 0,05 (sub) ·
--     PEITO DE PATO 0,1 · CALDO DE FRANGO 0,35 (sub) · SOFRITO 0,03 ·
--     CHORIZO 0,03 · ERVILHA TORTA 0,08 · SALSA 0,002

SELECT r.nome AS ficha,
       coalesce(pr.nome, sub.nome) AS ingrediente_no_app,
       CASE WHEN sub.id IS NOT NULL THEN 'sub-receita' ELSE 'insumo' END AS tipo,
       i.quantidade, i."unidadeMedida"
  FROM "Receita" r
  JOIN "Unidade" u ON u.id = r."unidadeId" AND u.nome = 'Beira Lago'
  LEFT JOIN "IngredienteReceita" i ON i."receitaId" = r.id
  LEFT JOIN "Produto" pr ON pr.id = i."produtoId"
  LEFT JOIN "Receita" sub ON sub.id = i."subReceitaId"
 WHERE upper(regexp_replace(translate(btrim(r.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g')) IN (
         'FALAFEL', 'BACALHAU COZIDO', 'ROBALO MONTAGEM',
         'CALDEIRADA MEDITERRANEA', 'STEAK AU POIVRE', 'ARROZ DE PATO'
       )
 ORDER BY r.nome, 2;
