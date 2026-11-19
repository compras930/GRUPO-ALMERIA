#!/usr/bin/env python3
"""Para cada insumo da ficha que não casou, sugere produtos do cadastro.

   /usr/local/bin/python3.13 -I prisma/scripts/fichas-beira-lago/gerar-candidatos.py \
       fichas.json > prisma/scripts/fichas-beira-lago/2-candidatos.sql

POR QUE SUGERIR E NÃO DECIDIR. "PIMENTA DO REINO" aparece em 31 fichas e não
existe com esse nome no cadastro — mas existe "PIMENTA DO REINO MOIDA 500G" e
talvez também "PIMENTA DO REINO EM GRAOS". As duas são pimenta; só uma é a que
o chef usa, e a diferença aparece no custo de 31 pratos. Escolher sozinho por
semelhança de texto é exatamente o erro que este projeto evita desde a primeira
carga de preço.

A BUSCA É POR PALAVRA SIGNIFICATIVA, não por semelhança global: o nome do
cadastro carrega marca, peso e embalagem ("MOIDA 500G", "FD 6X5KG") que não
existem na ficha, e qualquer medida de distância textual penaliza isso e erra.
Procurar pelas duas primeiras palavras da ficha dentro do nome do produto acha
muito mais — e deixa a decisão com quem conhece a cozinha.
"""
import json
import re
import sys

if len(sys.argv) < 2:
    sys.exit("uso: gerar-candidatos.py <fichas.json>")

fichas = json.load(open(sys.argv[1], encoding="utf-8"))["fichas"]

uso: dict[str, int] = {}
for f in fichas:
    for i in f["ingredientes"]:
        if i["tipo"] == "INSUMO":
            uso[i["chave"]] = uso.get(i["chave"], 0) + 1

# Palavras curtas e genéricas não ajudam a achar nada e trazem lixo.
VAZIAS = {"DE", "DO", "DA", "EM", "COM", "E", "A", "O", "SEM", "P", "KG", "LT", "UND", "G", "ML"}


def termos(chave: str) -> list[str]:
    palavras = [p for p in chave.split() if p not in VAZIAS and len(p) > 2]
    return palavras[:2] or palavras[:1] or [chave]


sql = lambda s: str(s).replace("'", "''")

NORM = (
    "upper(regexp_replace(translate(btrim({c}), "
    "'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', "
    "'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g'))"
)

print("-- Candidatos de produto para cada insumo de ficha que não casou. SÓ LEITURA.")
print("-- GERADO por prisma/scripts/fichas-beira-lago/gerar-candidatos.py")
print("--")
print("-- Como usar: a coluna `candidatos` traz até 5 produtos cujo nome contém")
print("-- as palavras do insumo. Escolha um, e mande a lista de pares de volta —")
print("-- é ela que vira o SQL do import. Insumo sem candidato nenhum ou é")
print("-- cadastro que falta, ou é preparo que não está na planilha de fichas.")
print()

print("WITH planilha(chave, termo1, termo2, usos) AS (VALUES")
linhas = []
for chave in sorted(uso, key=lambda k: (-uso[k], k)):
    t = termos(chave)
    t1 = t[0]
    t2 = t[1] if len(t) > 1 else t[0]
    linhas.append(f"  ('{sql(chave)}', '{sql(t1)}', '{sql(t2)}', {uso[chave]})")
print(",\n".join(linhas))
print("),")
print("naoCasados AS (")
print("  SELECT * FROM planilha p")
print("   WHERE NOT EXISTS (")
print(f"     SELECT 1 FROM \"Produto\" pr WHERE pr.ativo AND {NORM.format(c='pr.nome')} = p.chave")
print("   )")
print(")")
print("SELECT n.chave AS insumo_da_ficha, n.usos AS fichas_que_usam,")
print("       (SELECT string_agg(x.nome, ' | ' ORDER BY length(x.nome))")
print("          FROM (")
print('            SELECT pr.nome FROM "Produto" pr')
print("             WHERE pr.ativo")
print(f"               AND {NORM.format(c='pr.nome')} LIKE '%' || n.termo1 || '%'")
print(f"               AND {NORM.format(c='pr.nome')} LIKE '%' || n.termo2 || '%'")
print("             LIMIT 5")
print("          ) x) AS candidatos")
print("  FROM naoCasados n")
print(" ORDER BY n.usos DESC, n.chave;")
