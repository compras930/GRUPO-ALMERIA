#!/usr/bin/env python3
"""SQL só de leitura: o que o cadastro sabe dos ingredientes de drink.

   /usr/local/bin/python3.13 -I prisma/scripts/fichas-beira-lago/gerar-diagnostico-drinks.py \
       drinks.json > prisma/scripts/fichas-beira-lago/4-diagnostico-drinks.sql

A PERGUNTA AQUI NÃO É SÓ "EXISTE?", É "EM QUE UNIDADE?".

O drink mede em LITRO: 30 ml de gin, 15 ml de vermute. A garrafa quase sempre
está cadastrada em UND, porque é assim que se compra. Gravar "0,03" contra um
produto em UND diria que o drink gasta 3% de uma garrafa — o que por acaso até
é verdade para 750 ml, mas é coincidência: para a garrafa de litro seriam 3%
também, e o custo sairia 25% errado, sempre para baixo.

Por isso a consulta 2 separa os que casam em unidade dos que não casam, e a 3
tenta ler o volume do NOME do produto ("GIN TANQUERAY 750ML"), que é onde essa
informação costuma estar escrita. Com o volume, a conversão é exata e o import
pode gravar litro contra garrafa sem inventar nada.
"""
import json
import re
import sys

if len(sys.argv) < 2:
    sys.exit("uso: gerar-diagnostico-drinks.py <drinks.json>")

drinks = json.load(open(sys.argv[1], encoding="utf-8"))["drinks"]

uso: dict[str, dict] = {}
for d in drinks:
    for i in d["ingredientes"]:
        atual = uso.setdefault(i["chave"], {"usos": 0, "unidades": set()})
        atual["usos"] += 1
        if i["unidade"]:
            atual["unidades"].add(i["unidade"])

sql = lambda s: str(s).replace("'", "''")

NORM = (
    "upper(regexp_replace(translate(btrim({c}), "
    "'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', "
    "'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g'))"
)

valores = ",\n".join(
    f"  ('{sql(k)}', {v['usos']}, '{sql('/'.join(sorted(v['unidades'])) or '?')}')"
    for k, v in sorted(uso.items(), key=lambda x: (-x[1]["usos"], x[0]))
)

print("-- Diagnóstico das fichas de DRINK do Beira Lago. SÓ LEITURA.")
print(f"-- {len(drinks)} drinks, {len(uso)} ingredientes distintos.")
print("-- GERADO por gerar-diagnostico-drinks.py")
print()

print("-- 1. Resumo: existe no cadastro? e a unidade bate com a da ficha?")
print("WITH ficha(chave, usos, unidade) AS (VALUES")
print(valores)
print("),")
print("casado AS (")
print("  SELECT f.*, pr.id AS produto_id, pr.nome AS produto, pr.\"unidadeMedida\" AS un_cadastro")
print("    FROM ficha f")
print(f"    LEFT JOIN \"Produto\" pr ON pr.ativo AND {NORM.format(c='pr.nome')} = f.chave")
print(")")
print("SELECT CASE")
print("         WHEN produto_id IS NULL THEN 'sem produto no cadastro'")
print("         WHEN unidade = '?' THEN 'unidade nao informada na ficha'")
print("         WHEN upper(btrim(un_cadastro)) = unidade THEN 'ok: unidade bate'")
print("         ELSE 'unidade diferente: ' || unidade || ' na ficha, ' || un_cadastro || ' no cadastro'")
print("       END AS situacao,")
print("       count(*) AS ingredientes, sum(usos) AS linhas_de_drink")
print("  FROM casado GROUP BY 1 ORDER BY 3 DESC;")
print()

print("-- 2. Linha a linha: o que não está pronto para importar.")
print("WITH ficha(chave, usos, unidade) AS (VALUES")
print(valores)
print(")")
print("SELECT f.chave AS ingrediente_da_ficha, f.usos AS drinks_que_usam, f.unidade AS un_ficha,")
print("       pr.nome AS produto_no_cadastro, pr.\"unidadeMedida\" AS un_cadastro")
print("  FROM ficha f")
print(f"  LEFT JOIN \"Produto\" pr ON pr.ativo AND {NORM.format(c='pr.nome')} = f.chave")
print(" WHERE pr.id IS NULL")
print("    OR f.unidade = '?'")
print("    OR upper(btrim(pr.\"unidadeMedida\")) <> f.unidade")
print(" ORDER BY f.usos DESC, f.chave;")
print()

print("-- 3. Para os que estão em UND no cadastro: o volume está escrito no nome?")
print("--    É o que permite converter litro em garrafa sem inventar número.")
print("WITH ficha(chave, usos, unidade) AS (VALUES")
print(valores)
print(")")
print("SELECT f.chave AS ingrediente, pr.nome AS produto, pr.\"unidadeMedida\" AS un_cadastro,")
print("       substring(upper(pr.nome) from '([0-9]+[,.]?[0-9]*)\\s*(ML|L|LT|LITRO)') AS volume_no_nome")
print("  FROM ficha f")
print(f"  JOIN \"Produto\" pr ON pr.ativo AND {NORM.format(c='pr.nome')} = f.chave")
print(" WHERE f.unidade = 'LT' AND upper(btrim(pr.\"unidadeMedida\")) <> 'LT'")
print(" ORDER BY f.usos DESC;")
