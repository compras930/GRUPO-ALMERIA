#!/usr/bin/env python3
"""O que ainda falta em cada ficha incompleta, e por quê. SÓ LEITURA.

   /usr/local/bin/python3.13 -I prisma/scripts/fichas-beira-lago/gerar-pendencias.py \
       fichas.json incompletas.txt > prisma/scripts/fichas-beira-lago/10-pendencias.sql

O ROBALO MOSTROU O PADRÃO. A planilha chama o peixe de "ROBALO CRU"; o
cadastro chama de "ROBALO FILÉ". Nomes diferentes para a mesma coisa, e o
resultado é um insumo inteiro fora da conta — 6 kg numa ficha só — sem erro
nenhum aparecer em lugar algum.

Este SQL varre as fichas que ficaram incompletas e diz, linha a linha, qual
ingrediente da planilha não está gravado, mostrando ao lado os produtos do
cadastro cujo nome contém a primeira palavra dele. É a lista de trabalho para
fechar o cadastro — e a decisão de qual é qual continua sendo de quem conhece
a cozinha.

`pares.csv` entra aqui porque alguns nomes já foram traduzidos uma vez
("PIMENTA DO REINO" → "PIMENTA DO REINO PRETA EM PÓ"). Sem isso, esta lista
acusaria como faltando o que foi gravado com o nome escolhido lá.
"""
import csv
import json
import re
import sys
import unicodedata
from pathlib import Path

if len(sys.argv) < 3:
    sys.exit("uso: gerar-pendencias.py <fichas.json> <incompletas.txt>")


def norm(s) -> str:
    s = unicodedata.normalize("NFD", str(s)).encode("ascii", "ignore").decode().upper()
    return re.sub(r"[^A-Z0-9]+", " ", s).strip()


fichas = json.load(open(sys.argv[1], encoding="utf-8"))["fichas"]
incompletas = {norm(l) for l in Path(sys.argv[2]).read_text(encoding="utf-8").splitlines() if l.strip()}

# Traduções já decididas por quem conhece a cozinha, da primeira rodada.
apelido = {}
pares = Path(sys.argv[0]).parent / "pares.csv"
if pares.exists():
    for linha in csv.reader(pares.open(encoding="utf-8"), delimiter=";"):
        if len(linha) >= 2:
            apelido[norm(linha[0])] = norm(linha[1])

sql = lambda s: str(s).replace("'", "''")

linhas = []
for f in fichas:
    if not f["rendimento"] or norm(f["nome"]) not in incompletas:
        continue
    for i in f["ingredientes"]:
        esperado = apelido.get(i["chave"], i.get("subreceita") or i["chave"])
        primeira = next((p for p in esperado.split() if len(p) > 3), esperado)
        linhas.append(
            f"  ('{sql(norm(f['nome']))}', '{sql(i['nome'])}', '{sql(esperado)}', "
            f"'{sql(primeira)}', {i['quantidade']})"
        )

NORM = (
    "upper(regexp_replace(translate(btrim({c}), "
    "'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', "
    "'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g'))"
)

print("-- O que falta nas fichas incompletas do Beira Lago. SÓ LEITURA.")
print(f"-- {len(incompletas)} fichas, {len(linhas)} linhas de planilha conferidas.")
print("-- GERADO por gerar-pendencias.py")
print()
print("WITH planilha(ficha, ingrediente, esperado, primeira_palavra, quantidade) AS (VALUES")
print(",\n".join(linhas))
print("),")
print("gravado AS (")
print("  SELECT p.*, g.id AS linha_gravada")
print("    FROM planilha p")
print("    JOIN \"Unidade\" u ON u.nome = 'Beira Lago'")
print(f"    JOIN \"Receita\" r ON r.\"unidadeId\" = u.id AND {NORM.format(c='r.nome')} = p.ficha")
print('    LEFT JOIN "IngredienteReceita" g ON g."receitaId" = r.id')
print('    LEFT JOIN "Produto" pr ON pr.id = g."produtoId"')
print('    LEFT JOIN "Receita" sub ON sub.id = g."subReceitaId"')
print("   WHERE "
      + NORM.format(c="coalesce(pr.nome, sub.nome)")
      + " = p.esperado")
print(")")
print("SELECT p.ficha, p.ingrediente AS ingrediente_da_planilha, p.quantidade,")
print("       (SELECT string_agg(x.nome, ' | ' ORDER BY length(x.nome))")
print("          FROM (SELECT pr.nome FROM \"Produto\" pr")
print("                 WHERE pr.ativo")
print(f"                   AND {NORM.format(c='pr.nome')} LIKE '%' || p.primeira_palavra || '%'")
print("                 LIMIT 4) x) AS produtos_parecidos,")
print("       (SELECT string_agg(x.nome, ' | ' ORDER BY length(x.nome))")
print("          FROM (SELECT r2.nome FROM \"Receita\" r2")
print("                 JOIN \"Unidade\" u2 ON u2.id = r2.\"unidadeId\" AND u2.nome = 'Beira Lago'")
print(f"                 WHERE {NORM.format(c='r2.nome')} LIKE '%' || p.primeira_palavra || '%'")
print("                 LIMIT 3) x) AS fichas_parecidas")
print("  FROM planilha p")
print(" WHERE NOT EXISTS (SELECT 1 FROM gravado g WHERE g.ficha = p.ficha AND g.esperado = p.esperado)")
print(" ORDER BY p.quantidade DESC, p.ficha;")
