#!/usr/bin/env python3
"""Preenche o rendimento das fichas que estão sem ele no app.

   /usr/local/bin/python3.13 -I prisma/scripts/fichas-beira-lago/gerar-rendimento.py \
       fichas.json > prisma/scripts/fichas-beira-lago/6-rendimento.sql

SEM RENDIMENTO NÃO HÁ CUSTO POR PORÇÃO. A ficha soma o custo dos ingredientes
e não tem por quanto dividir — fica completa e mesmo assim fora do CMV teórico.
Cerca de 30 fichas do Beira Lago estão assim, quase todas montagens, e a
planilha do chef traz o rendimento de todas elas.

SÓ PREENCHE O QUE ESTÁ VAZIO. Onde o app já tem rendimento, o dele vale: pode
ter sido corrigido depois da planilha, e sobrescrever apagaria essa correção
em silêncio. Por isso o WHERE com IS NULL, e por isso rodar duas vezes não
muda nada na segunda.
"""
import json
import sys

if len(sys.argv) < 2:
    sys.exit("uso: gerar-rendimento.py <fichas.json>")

fichas = [f for f in json.load(open(sys.argv[1], encoding="utf-8"))["fichas"] if f["rendimento"]]

sql = lambda s: str(s).replace("'", "''")

NORM = (
    "upper(regexp_replace(translate(btrim({c}), "
    "'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', "
    "'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g'))"
)

valores = ",\n".join(
    f"  ('{sql(f['chave'])}', {f['rendimento']}, '{sql(f['unidade'])}')" for f in fichas
)

print("-- Rendimento que falta nas fichas do Beira Lago.")
print(f"-- {len(fichas)} fichas na planilha; só as que estão SEM rendimento são tocadas.")
print("-- Pode rodar quantas vezes quiser. GERADO por gerar-rendimento.py")
print()
print("BEGIN;")
print()
print("WITH planilha(chave, rend, un) AS (VALUES")
print(valores)
print(")")
print('UPDATE "Receita" r')
print('   SET "rendimentoQtd" = p.rend,')
print('       "rendimentoUnidade" = coalesce(r."rendimentoUnidade", p.un),')
print('       "atualizadoEm" = now()')
print("  FROM planilha p, \"Unidade\" u")
print(" WHERE u.nome = 'Beira Lago'")
print('   AND r."unidadeId" = u.id')
print(f"   AND {NORM.format(c='r.nome')} = p.chave")
print('   AND r."rendimentoQtd" IS NULL;')
print()
print("COMMIT;")
print()
print("-- Conferência: quantas fichas do Beira Lago ainda estão sem rendimento.")
print('SELECT count(*) FILTER (WHERE r."rendimentoQtd" IS NULL) AS ainda_sem_rendimento,')
print("       count(*) AS fichas_da_casa")
print('  FROM "Receita" r JOIN "Unidade" u ON u.id = r."unidadeId" AND u.nome = \'Beira Lago\';')
