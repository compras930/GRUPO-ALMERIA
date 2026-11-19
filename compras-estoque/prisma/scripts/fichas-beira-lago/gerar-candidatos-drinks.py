#!/usr/bin/env python3
"""Candidatos de produto para cada ingrediente de drink. SÓ LEITURA.

   /usr/local/bin/python3.13 -I prisma/scripts/fichas-beira-lago/gerar-candidatos-drinks.py \
       drinks.json > prisma/scripts/fichas-beira-lago/5-candidatos-drinks.sql

69 DOS 73 INGREDIENTES NÃO ACHARAM PRODUTO — e a casa obviamente compra gin.
O que não bate é a forma do nome: a planilha do bar escreve "GIN TANQUERAY N
TEN", o cadastro escreve "TANQUERAY TEN GIN 750ML". A planilha põe a
CATEGORIA na frente (GIN, VERMUTE, WHISKY, FRUTA, MEIA LUA, SUMO, BITTER) do
mesmo jeito que a da cozinha punha SB e MONTAGEM, e o cadastro põe a marca na
frente e o volume no fim.

POR ISSO A BUSCA É PELA MARCA, não pelo nome inteiro. Tirado o prefixo de
categoria, o que sobra — TANQUERAY, CARPANO, HENDRICKS — é a palavra que
identifica a garrafa e que está no nome do cadastro em algum lugar. Medida de
semelhança de texto erraria aqui: "GIN TANQUERAY" e "GIN TANQUERAY SEVILLA"
são parecidíssimos e são garrafas diferentes, com preço diferente.

NÃO DECIDE NADA. Devolve até 5 candidatos por ingrediente para alguém do bar
escolher. Casar por texto e gravar seria errar o preço de 52 drinks em
silêncio.

O QUE NEM DEVERIA ESTAR AQUI: SUMO LIMAO, XAROPE SIMPLES, MEL FERMENTADO e as
clarificações são PRODUÇÃO DO BAR, não item de compra. Viram ficha com
rendimento, como qualquer sub-receita. Saem marcados na coluna `observacao`
para não se perder no meio da lista.
"""
import json
import re
import sys

if len(sys.argv) < 2:
    sys.exit("uso: gerar-candidatos-drinks.py <drinks.json>")

drinks = json.load(open(sys.argv[1], encoding="utf-8"))["drinks"]

# Prefixos que a planilha do bar usa como marcação de categoria.
CATEGORIAS = (
    "GIN", "VODKA", "WHISKY", "WHISKEY", "TEQUILA", "CACHACA", "PISCO", "SAKE",
    "LICOR", "VERMUTE", "BITTER", "APERITIVO", "ESPUMANTE", "XAROPE", "FRUTA",
    "MEIA LUA", "SUMO", "CHA", "PIMENTA",
)

# Preparo do bar: não se compra, se produz. Vira ficha, não vínculo.
PRODUCAO = (
    "SUMO", "XAROPE SIMPLES", "MEL FERMENTADO", "CLARIFICACAO",
    "XAROPE GENGIBRE", "XAROPE FRAMBOESA", "XAROPE CONCETRADO",
)

VAZIAS = {"DE", "DO", "DA", "EM", "COM", "E", "A", "O", "N", "ANOS", "LT", "KG", "UND", "ML"}


def sem_categoria(chave: str) -> str:
    for c in sorted(CATEGORIAS, key=len, reverse=True):
        if chave == c or chave.startswith(c + " "):
            return chave[len(c) :].strip()
    return chave


def termos(chave: str) -> tuple[str, str]:
    """Duas palavras de busca: a marca e o que a qualifica.

    Duas e não uma: "TANQUERAY" sozinho traz Tanqueray, Ten e Sevilla
    misturados, e a diferença entre elas é o preço da dose.
    """
    palavras = [p for p in sem_categoria(chave).split() if p not in VAZIAS and len(p) > 2]
    if not palavras:
        palavras = [chave]
    return palavras[0], (palavras[1] if len(palavras) > 1 else palavras[0])


uso: dict[str, int] = {}
for d in drinks:
    for i in d["ingredientes"]:
        uso[i["chave"]] = uso.get(i["chave"], 0) + 1

sql = lambda s: str(s).replace("'", "''")

NORM = (
    "upper(regexp_replace(translate(btrim({c}), "
    "'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', "
    "'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g'))"
)

linhas = []
for chave in sorted(uso, key=lambda k: (-uso[k], k)):
    t1, t2 = termos(chave)
    producao = any(chave.startswith(p) for p in PRODUCAO)
    obs = "PRODUCAO DO BAR — vira ficha, nao produto" if producao else ""
    linhas.append(
        f"  ('{sql(chave)}', '{sql(t1)}', '{sql(t2)}', {uso[chave]}, '{sql(obs)}')"
    )

print("-- Candidatos de produto para cada ingrediente de DRINK. SÓ LEITURA.")
print(f"-- {len(uso)} ingredientes distintos, {len(drinks)} drinks.")
print("-- GERADO por gerar-candidatos-drinks.py")
print("--")
print("-- A coluna `candidatos_marca` busca pela MARCA sozinha e a")
print("-- `candidatos_precisos` exige marca + qualificador. Quando as duas")
print("-- trouxerem coisas diferentes, olhe: é o caso TANQUERAY / TANQUERAY TEN,")
print("-- garrafas diferentes com preço diferente.")
print("--")
print("-- Escolha um produto por linha e mande a lista de volta. Linha sem")
print("-- candidato nenhum é cadastro que falta — ou produção do bar, que não")
print("-- se compra (ver a coluna `observacao`).")
print()
print("WITH ficha(chave, marca, qualificador, drinks_que_usam, observacao) AS (VALUES")
print(",\n".join(linhas))
print(")")
print("SELECT f.chave AS ingrediente_do_drink, f.drinks_que_usam, f.observacao,")
print("       (SELECT string_agg(x.nome || ' [' || x.un || ']', ' | ' ORDER BY length(x.nome))")
print("          FROM (SELECT pr.nome, pr.\"unidadeMedida\" AS un FROM \"Produto\" pr")
print("                 WHERE pr.ativo")
print(f"                   AND {NORM.format(c='pr.nome')} LIKE '%' || f.marca || '%'")
print("                 LIMIT 5) x) AS candidatos_marca,")
print("       (SELECT string_agg(x.nome || ' [' || x.un || ']', ' | ' ORDER BY length(x.nome))")
print("          FROM (SELECT pr.nome, pr.\"unidadeMedida\" AS un FROM \"Produto\" pr")
print("                 WHERE pr.ativo")
print(f"                   AND {NORM.format(c='pr.nome')} LIKE '%' || f.marca || '%'")
print(f"                   AND {NORM.format(c='pr.nome')} LIKE '%' || f.qualificador || '%'")
print("                 LIMIT 5) x) AS candidatos_precisos")
print("  FROM ficha f")
print(" WHERE NOT EXISTS (")
print(f"   SELECT 1 FROM \"Produto\" pr WHERE pr.ativo AND {NORM.format(c='pr.nome')} = f.chave")
print(" )")
print(" ORDER BY f.drinks_que_usam DESC, f.chave;")
