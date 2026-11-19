#!/usr/bin/env python3
"""As garrafas do bar aparecem nas notas de compra? SÓ LEITURA.

   /usr/local/bin/python3.13 -I prisma/scripts/fichas-beira-lago/gerar-busca-notas-bar.py \
       drinks.json prisma/scripts/fichas-beira-lago > prisma/scripts/fichas-beira-lago/7-busca-notas-bar.sql

23 GARRAFAS NÃO ACHARAM PRODUTO NO CADASTRO, e a casa obviamente compra
Hendrick's. Criar produto novo para cada uma seria repetir o erro do robalo —
dois cadastros do mesmo item, a compra entrando num e a ficha baixando do
outro, estoque errado nos dois lados e ninguém vendo.

A PERGUNTA ANTES DE CRIAR É SE A NOTA JÁ TRAZ A GARRAFA. `ItemNotaCompra`
guarda `nomeBruto`, que é o nome como veio da nota, mesmo quando a linha não
foi casada com nenhum produto. Então:

  acha nomeBruto e tem produtoId  → o produto existe com outro nome: é par,
                                    não cadastro novo;
  acha nomeBruto e produtoId nulo → a compra entra e não casa com nada: falta
                                    ligar, e o estoque dessa garrafa nunca
                                    existiu;
  não acha nada                   → ou a garrafa não é comprada, ou a compra
                                    do bar não passa pelo Teknisa — que é uma
                                    descoberta maior que as fichas.

A busca é pela MARCA, não pelo nome inteiro: a nota escreve "GIN HENDRICKS
GF 750ML" e a ficha escreve "GIN HENDRIX" — inclusive com erro de grafia,
que é por isso que se busca HENDRI e não HENDRIX.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

if len(sys.argv) < 3:
    sys.exit("uso: gerar-busca-notas-bar.py <drinks.json> <destino>")

drinks = json.load(open(sys.argv[1], encoding="utf-8"))["drinks"]
destino = Path(sys.argv[2])


def norm(s) -> str:
    s = unicodedata.normalize("NFD", str(s)).encode("ascii", "ignore").decode().upper()
    return re.sub(r"[^A-Z0-9]+", " ", s).strip()


# Já casados no 6b — não precisam de busca.
casados = set()
pares = destino / "pares-drinks.csv"
if pares.exists():
    for linha in pares.open(encoding="utf-8"):
        if ";" in linha:
            casados.add(norm(linha.split(";")[0]))

# Produção do bar: não se compra, não adianta procurar na nota.
PRODUCAO = ("SUMO", "XAROPE SIMPLES", "MEL FERMENTADO", "CLARIFICACAO", "XAROPE GENGIBRE",
            "XAROPE FRAMBOESA", "XAROPE CONCETRADO", "GELO")

CATEGORIAS = ("GIN", "VODKA", "WHISKY", "WHISKEY", "TEQUILA", "CACHACA", "PISCO", "SAKE",
              "LICOR", "VERMUTE", "BITTER", "APERITIVO", "ESPUMANTE", "XAROPE", "FRUTA",
              "MEIA LUA", "SUMO", "CHA", "PIMENTA")

VAZIAS = {"DE", "DO", "DA", "EM", "COM", "E", "A", "O", "N", "ANOS", "LT", "KG", "UND", "ML"}


def marca(chave: str) -> str:
    """A palavra que identifica a garrafa, truncada para tolerar a grafia.

    "HENDRIX" na ficha e "HENDRICKS" na nota só se encontram pelo começo:
    seis letras acham os dois e ainda não trazem lixo.
    """
    resto = chave
    for c in sorted(CATEGORIAS, key=len, reverse=True):
        if resto == c or resto.startswith(c + " "):
            resto = resto[len(c) :].strip()
            break
    palavras = [p for p in resto.split() if p not in VAZIAS and len(p) > 2]
    alvo = palavras[0] if palavras else chave
    return alvo[:6]


uso: dict[str, int] = {}
for d in drinks:
    for i in d["ingredientes"]:
        if i["chave"] in casados or any(i["chave"].startswith(p) for p in PRODUCAO):
            continue
        uso[i["chave"]] = uso.get(i["chave"], 0) + 1

sql = lambda s: str(s).replace("'", "''")

NORM = (
    "upper(regexp_replace(translate(btrim({c}), "
    "'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', "
    "'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g'))"
)

valores = ",\n".join(
    f"  ('{sql(k)}', '{sql(marca(k))}', {v})" for k, v in sorted(uso.items(), key=lambda x: (-x[1], x[0]))
)

print("-- As garrafas do bar aparecem nas notas de compra? SÓ LEITURA.")
print(f"-- {len(uso)} garrafas sem produto no cadastro.")
print("-- GERADO por gerar-busca-notas-bar.py")
print("--")
print("-- Leitura do resultado:")
print("--   linhas_na_nota > 0 e produto_casado cheio → o produto existe com")
print("--     outro nome; é par a fazer, não cadastro novo.")
print("--   linhas_na_nota > 0 e produto_casado vazio → a compra entra e não")
print("--     casa com nada: o estoque dessa garrafa nunca existiu.")
print("--   linhas_na_nota = 0 → ou não se compra, ou a compra do bar não passa")
print("--     pelo Teknisa.")
print()
print("WITH ficha(chave, marca, drinks_que_usam) AS (VALUES")
print(valores)
print(")")
print("SELECT f.chave AS ingrediente_do_drink, f.drinks_que_usam,")
print("       (SELECT count(*) FROM \"ItemNotaCompra\" i")
print(f"         WHERE {NORM.format(c='i.\"nomeBruto\"')} LIKE '%' || f.marca || '%') AS linhas_na_nota,")
print("       (SELECT string_agg(DISTINCT i.\"nomeBruto\", ' | ')")
print("          FROM \"ItemNotaCompra\" i")
print(f"         WHERE {NORM.format(c='i.\"nomeBruto\"')} LIKE '%' || f.marca || '%') AS nome_na_nota,")
print("       (SELECT string_agg(DISTINCT pr.nome, ' | ')")
print("          FROM \"ItemNotaCompra\" i JOIN \"Produto\" pr ON pr.id = i.\"produtoId\"")
print(f"         WHERE {NORM.format(c='i.\"nomeBruto\"')} LIKE '%' || f.marca || '%') AS produto_casado")
print("  FROM ficha f")
print(" ORDER BY f.drinks_que_usam DESC, f.chave;")
