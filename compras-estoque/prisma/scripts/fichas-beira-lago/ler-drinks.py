#!/usr/bin/env python3
"""Lê a planilha de fichas de DRINK do Beira Lago e devolve JSON estruturado.

   /usr/local/bin/python3.13 -I prisma/scripts/fichas-beira-lago/ler-drinks.py \
       "FT ALMERIA BEIRA LAGO OFICIAL.xlsx" > drinks.json

O FORMATO (uma aba por drink, 52 delas):

    NOME DO PRODUTO        APEROL SPRITZ      NUMERO  1   VENDA
    PRODUTO     PPÇ   QUANTIDADE   PREÇO   CUSTO           40
    APERITIVO APEROL   LT   0.06   58.67   3.52
    ...
    PREPARO     MONTADO NA TAÇA
    DECORAÇÃO   MEIA LUA DE LARANJA

MELHOR QUE A DA COZINHA NUM PONTO: cada ingrediente traz a PRÓPRIA unidade
(LT, KG, Uni). Na planilha da cozinha tudo era Kg/L implícito, e era preciso
recusar o que estivesse cadastrado em unidade. Aqui a ficha diz.

RENDIMENTO É 1 DRINK. A ficha inteira é uma dose servida, então o rendimento é
1 UND — e o custo dela já é o custo por drink, sem divisão.

O XAROPE SIMPLES É UM PROBLEMA CONHECIDO: ele é produção do bar (aba
PRODUÇÕES), aparece em 21 drinks, e a ficha dele está com rendimento zero —
#DIV/0! na planilha. Enquanto não tiver rendimento, ele não vira sub-receita;
sai na lista de pendências.
"""
import json
import re
import sys
import unicodedata

try:
    import openpyxl
except ImportError:
    sys.exit("recusado: openpyxl não encontrado — use /usr/local/bin/python3.13")

if len(sys.argv) < 2:
    sys.exit("uso: ler-drinks.py <arquivo.xlsx>")

# Abas que não são ficha de drink: catálogos, rascunhos e o painel.
NAO_SAO_FICHA = {
    "DASHBOARD",
    "DOSES",
    "INGREDIENTES",
    "FICHA DO PRODUTO ",
    "PRODUÇÕES ",
    "IDEIA DE DRINKS",
    "FORNECEDORES",
    "RN 9hrs",
}
CABECALHOS = {"PREPARO", "DECORAÇÃO", "DECORACAO", "OBS", "PRODUTO", "PRODUTO "}


def norm(s) -> str:
    s = unicodedata.normalize("NFD", str(s)).encode("ascii", "ignore").decode().upper()
    return re.sub(r"[^A-Z0-9]+", " ", s).strip()


def unidade_canonica(u: str) -> str:
    """LT, KG e Uni da planilha para o vocabulário do app."""
    u = norm(u)
    if u in ("LT", "L", "LITRO"):
        return "LT"
    if u in ("KG", "K", "QUILO"):
        return "KG"
    if u in ("UNI", "UN", "UND", "UNIDADE"):
        return "UND"
    return ""  # não informada — fica para alguém preencher


wb = openpyxl.load_workbook(sys.argv[1], data_only=True)
drinks = []
for aba in wb.sheetnames:
    if aba in NAO_SAO_FICHA:
        continue
    linhas = list(wb[aba].iter_rows(values_only=True))
    if not linhas:
        continue
    topo = [("" if x is None else str(x).strip()) for x in (list(linhas[0]) + [""] * 12)[:12]]
    nome = topo[3] or aba.strip()
    # O preço de venda fica na coluna K, mas em algumas abas a linha 1 traz o
    # rótulo "VENDA" e o número desce para a linha 2 — a planilha foi montada
    # à mão, aba por aba. Procura o primeiro número das duas primeiras linhas
    # nessa coluna em vez de confiar na posição.
    preco = None
    for linha in linhas[:2]:
        c = [("" if x is None else str(x).strip()) for x in (list(linha) + [""] * 12)[:12]]
        try:
            preco = float(c[10].replace(",", "."))
            break
        except ValueError:
            continue

    ingredientes = []
    for linha in linhas[2:]:
        c = [("" if x is None else str(x).strip()) for x in (list(linha) + [""] * 12)[:12]]
        if not c[0] or c[0].upper() in CABECALHOS or not c[4]:
            continue
        try:
            quantidade = float(c[4].replace(",", "."))
        except ValueError:
            continue
        ingredientes.append(
            {
                "nome": c[0],
                "chave": norm(c[0]),
                "unidade": unidade_canonica(c[3]),
                "quantidade": quantidade,
            }
        )

    drinks.append(
        {
            "aba": aba,
            "nome": nome,
            "chave": norm(aba),
            "precoVenda": preco,
            "ingredientes": ingredientes,
        }
    )

json.dump({"drinks": drinks}, sys.stdout, ensure_ascii=False, indent=1)
