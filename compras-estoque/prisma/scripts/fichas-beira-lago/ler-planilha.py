#!/usr/bin/env python3
"""Lê a planilha de fichas técnicas do Beira Lago e devolve JSON estruturado.

   /usr/local/bin/python3.13 -I prisma/scripts/fichas-beira-lago/ler-planilha.py \
       "FTPS BEIRA LAGO.xlsx" > fichas.json

O FORMATO DA PLANILHA (uma aba por ficha, 203 delas):

    FICHA TÉCNICA DE PREPARO
       Item:         ABOBORA ASSADA
       Rendimento:   1.7            Kg
       Ingredientes  PB (Kg/L)  PL  Medida Caseira  FC  Unid. Compra  Custo ...
       ABOBORA CABOTIA   1.0                            1.0           4
       ...
       TOTAL:                                                         20.49
       1 kg = R$     12.05

PB É O QUE ENTRA NA CONTA, não PL. PB é peso bruto — o que sai da despensa,
com casca, osso e aparas. PL é o que sobra depois da limpeza. O estoque baixa
o que saiu da prateleira, não o que chegou à panela; usar PL subestimaria o
consumo exatamente nos insumos de maior perda, que são os caros.

CUSTO E CMV DA PLANILHA SÃO IGNORADOS. Neste projeto custo nunca é coluna
gravada: ele é recalculado a partir do preço atual do insumo, e é isso que faz
a atualização de preço percorrer as fichas sozinha. Os números do chef servem
para CONFERIR depois — divergência grande aponta ingrediente que não casou.
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
    sys.exit("uso: ler-planilha.py <arquivo.xlsx>")

IGNORAR = {"DASHBOARD", "INSUMOS"}


def norm(s) -> str:
    s = unicodedata.normalize("NFD", str(s)).encode("ascii", "ignore").decode().upper()
    return re.sub(r"[^A-Z0-9]+", " ", s).strip()


def sem_prefixo(s: str) -> str:
    """Tira "SB" e "MONTAGEM" do começo.

    A planilha usa os dois como marcação de tipo, não como parte do nome: a
    aba "SB- BECHAMEL" é citada como "BECHAMEL" dentro de outra ficha. Sem
    tirar o prefixo, 20 preparos viravam "insumo que não existe no cadastro" —
    e alguém iria procurar bechamel na lista de compras.
    """
    return norm(re.sub(r"^(SB|MONTAGEM)\b[\s\-]*", "", norm(s))).strip()


wb = openpyxl.load_workbook(sys.argv[1], data_only=True)
fichas = []
for aba in wb.sheetnames:
    if aba in IGNORAR:
        continue
    ws = wb[aba]
    item = rendimento = unidade = None
    ingredientes = []
    for linha in ws.iter_rows(values_only=True):
        c = [("" if x is None else str(x).strip()) for x in (list(linha) + [""] * 10)[:10]]
        if c[1].startswith("Item:"):
            item = c[2]
        elif c[1].startswith("Rendimento"):
            rendimento, unidade = c[2], c[3]
        elif c[1] and c[1] not in ("Ingredientes", "TOTAL:") and not c[1].startswith("1 kg"):
            if c[2]:
                ingredientes.append({"nome": c[1], "quantidade": float(c[2].replace(",", "."))})
    # A IDENTIDADE É O NOME DA ABA, não o campo "Item:".
    #
    # Em 17 fichas o "Item:" ficou com o nome de outra ficha: alguém duplicou
    # a aba e não trocou o campo. "LULA RECHEADA" está escrita como
    # "BABAGANOUSH", "MASSA FRESCA" como "ROSSINI". Usar o "Item:" criaria
    # receita com nome errado e faria a sub-receita apontar para o prato
    # errado — silenciosamente, e com custo plausível.
    #
    # O nome da aba é único por construção no Excel e foi digitado uma vez só.
    fichas.append(
        {
            "aba": aba,
            "item": item or aba,
            "nome": aba.strip(),
            "chave": norm(aba),
            "itemDivergente": bool(item) and norm(item) != norm(aba),
            "rendimento": float(rendimento.replace(",", ".")) if rendimento else None,
            "unidade": unidade or "Kg",
            "ingredientes": ingredientes,
        }
    )

# SUB-RECEITA É INGREDIENTE QUE É OUTRA FICHA. Resolver isso aqui, e não no
# banco, é o que permite o SQL do import ser burro: ele só grava o que já foi
# decidido. A régua é o nome normalizado do campo "Item:" das outras abas.
# O índice aceita as quatro grafias que a planilha usa para a mesma ficha: o
# nome da aba e o campo "Item:", cada um com e sem o prefixo de tipo.
porChave: dict[str, dict] = {}
for f in fichas:
    # A aba manda; o "Item:" entra como apelido, porque outras fichas citam a
    # sub-receita por ele. `setdefault` garante que, havendo conflito, quem
    # vence é a ficha cuja ABA tem aquele nome.
    for k in {norm(f["aba"]), sem_prefixo(f["aba"])}:
        porChave.setdefault(k, f)
for f in fichas:
    for k in {norm(f["item"]), sem_prefixo(f["item"])}:
        porChave.setdefault(k, f)

for f in fichas:
    for ing in f["ingredientes"]:
        ing["chave"] = norm(ing["nome"])
        alvo = porChave.get(ing["chave"]) or porChave.get(sem_prefixo(ing["nome"]))
        ing["tipo"] = "SUBRECEITA" if alvo else "INSUMO"
        if alvo:
            # Guarda a ficha de destino resolvida: o SQL do import não
            # adivinha nada, ele só grava o que foi decidido aqui.
            ing["subreceita"] = alvo["chave"]

json.dump({"fichas": fichas}, sys.stdout, ensure_ascii=False, indent=1)
