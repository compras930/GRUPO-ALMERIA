#!/usr/bin/env python3
"""Por que 80 das 201 fichas não receberam ingrediente. SÓ LEITURA.

   /usr/local/bin/python3.13 -I prisma/scripts/fichas-beira-lago/gerar-diagnostico-fichas.py \
       fichas.json > prisma/scripts/fichas-beira-lago/5-diagnostico-fichas.sql

O 3a NÃO INSERE FICHA CUJO NOME JÁ EXISTE no Beira Lago — e está certo, senão
criaria duas "BECHAMEL" e o app passaria a ter duas verdades. Mas o id que ele
deixou de criar é o id com que as partes 3b..3e gravam ingrediente; a ficha que
já existia tem OUTRO id, e os ingredientes dela simplesmente não entram. Foi
isso, e não erro de execução, que deixou 121 de 201 fichas no 3z.

A pergunta que decide o conserto é se essas fichas que já existiam estão
VAZIAS ou já têm ingrediente cadastrado à mão. Vazia, é só apontar o import
para o id dela. Com conteúdo, importar por cima duplicaria ingrediente — e aí
quem decide é o chef, não eu.
"""
import json
import sys

if len(sys.argv) < 2:
    sys.exit("uso: gerar-diagnostico-fichas.py <fichas.json>")

fichas = json.load(open(sys.argv[1], encoding="utf-8"))["fichas"]

# Mesmo id derivado do nome que o gerar-import.py usa — tem de bater, senão
# este diagnóstico mediria outra coisa.
from hashlib import md5

CASA = "Beira Lago"


def rid(chave: str) -> str:
    return "rec" + md5(f"{CASA}|{chave}".encode()).hexdigest()[:20]


sql = lambda s: str(s).replace("'", "''")

NORM = (
    "upper(regexp_replace(translate(btrim({c}), "
    "'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', "
    "'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g'))"
)

linhas = []
for f in fichas:
    if not f["rendimento"]:
        continue
    linhas.append(
        f"  ('{rid(f['chave'])}', '{sql(f['nome'])}', '{sql(f['chave'])}', {len(f['ingredientes'])})"
    )
valores = ",\n".join(linhas)

print("-- Por que faltaram fichas no 3z. SÓ LEITURA.")
print("-- GERADO por gerar-diagnostico-fichas.py")
print()

for titulo, corpo in [
    (
        "-- 1. Resumo: a ficha entrou com o id do import, ou já existia com outro id?",
        """SELECT CASE
         WHEN r.id IS NULL THEN 'nao existe no app'
         WHEN r.id = p.id   THEN 'criada pelo import'
         WHEN (SELECT count(*) FROM "IngredienteReceita" i WHERE i."receitaId" = r.id) = 0
              THEN 'ja existia, SEM ingrediente'
         ELSE 'ja existia, COM ingrediente'
       END AS situacao,
       count(*) AS fichas, sum(p.quantos) AS ingredientes_da_planilha
  FROM planilha p
  LEFT JOIN "Unidade" u ON u.nome = 'Beira Lago'
  LEFT JOIN "Receita" r ON r."unidadeId" = u.id AND {norm} = p.chave
 GROUP BY 1 ORDER BY 2 DESC;""",
    ),
    (
        "-- 2. Linha a linha das que já existiam: id no app, rendimento e o que já têm.",
        """SELECT p.nome AS ficha_da_planilha, p.quantos AS ingredientes_na_planilha,
       r.id AS id_no_app, r."rendimentoQtd" AS rendimento_no_app,
       (SELECT count(*) FROM "IngredienteReceita" i WHERE i."receitaId" = r.id) AS ingredientes_no_app
  FROM planilha p
  JOIN "Unidade" u ON u.nome = 'Beira Lago'
  JOIN "Receita" r ON r."unidadeId" = u.id AND {norm} = p.chave
 WHERE r.id <> p.id
 ORDER BY 5 DESC, 1
 LIMIT 100;""",
    ),
]:
    print(titulo)
    print("WITH planilha(id, nome, chave, quantos) AS (VALUES")
    print(valores)
    print(")")
    print(corpo.format(norm=NORM.format(c="r.nome")))
    print()
