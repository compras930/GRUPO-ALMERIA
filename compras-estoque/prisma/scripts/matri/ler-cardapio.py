"""Lê a planilha de fichas do Matri (CARDAPIO MATRI — PIZZARIA E TRATTORIA) e
diz o que tem dentro, antes de importar.

LAYOUT, que é DIFERENTE do Beira Lago:

    linha 1   <nome do prato> | | CUSTO DA RECEITA | | <custo> | [rendimento em texto]
    linha 2   INGREDIENTE | PESO LÍQUIDO | UNIDADE | RENDIMENTO | PESO BRUTO | PREÇO | CUSTO
    linha 3+  os ingredientes

Duas convenções importam:

  MONTAGEM - X  é o PRATO, e vale UMA porção. Não tem rendimento declarado, e
                não precisa: a ficha já é por prato servido.
  SB - X        é SUB-RECEITA, feita em lote. O rendimento dela está escrito à
                mão na primeira linha ("RENDIMENTO 3 KG"), não num campo.

A COLUNA `RENDIMENTO` DO INGREDIENTE é o fator de aproveitamento, e o Beira
Lago não tem equivalente: ossobuco com rendimento 0,4 quer dizer que de 5,5 kg
comprados sobram 2,2 kg limpos. É por isso que existem duas colunas de peso.

QUAL DAS DUAS IMPORTAR: PESO BRUTO. O que sai da despensa é o osso junto —
importar o líquido faria o estoque baixar menos do que a cozinha tira da
prateleira, e a diferença apareceria na contagem como sumiço. O custo da
planilha também usa o bruto, o que confirma a leitura.

Uso:
    python3 -I prisma/scripts/matri/ler-cardapio.py <arquivo.xlsx>
"""

import sys
import re
import unicodedata

import openpyxl

ABAS_NAO_FICHA = {"DASHBOARD", "INSUMOS SISTEMA", "CADASTRO NOVOS", "MODELO", "LISTA"}


def chave(nome):
    s = unicodedata.normalize("NFKD", str(nome or "")).encode("ascii", "ignore").decode()
    return " ".join(s.split()).upper()


def nome_limpo(aba):
    """'MONTAGEM - MARGHERITA ' -> 'MARGHERITA'; 'SB- RAGU' -> 'RAGU'."""
    s = str(aba).strip()
    return re.sub(r"^(MONTAGEM|SB)\s*-\s*", "", s, flags=re.I).strip()


def ler(ws):
    """(custo, rendimento_em_texto, [(ingrediente, liquido, unidade, fator, bruto)])."""
    linhas = list(ws.iter_rows(values_only=True))
    if not linhas:
        return None, None, []
    cab = linhas[0]
    custo = next((c for c in cab[3:6] if isinstance(c, (int, float))), None)
    texto = " ".join(str(c) for c in cab if isinstance(c, str))
    rend = re.search(r"RENDIMENTO[^0-9]*([0-9]+[.,]?[0-9]*)\s*(KG|G|LT|ML|UN|UND)?", texto, re.I)

    itens = []
    lendo = False
    for linha in linhas:
        rot = [chave(c) for c in linha[:2]]
        if "INGREDIENTE" in rot:
            lendo = True
            continue
        if not lendo:
            continue
        nome = linha[0] if len(linha) > 0 else None
        if nome is None or not str(nome).strip():
            continue
        if chave(nome).startswith(("TOTAL", "CUSTO", "1 KG")):
            continue
        num = lambda i: linha[i] if len(linha) > i and isinstance(linha[i], (int, float)) else None
        itens.append((str(nome).strip(), num(1), linha[2] if len(linha) > 2 else None, num(3), num(4)))
    return custo, (rend.group(0) if rend else None), itens


def main(caminho):
    wb = openpyxl.load_workbook(caminho, data_only=True)
    abas = [n for n in wb.sheetnames if n.strip().upper() not in ABAS_NAO_FICHA]

    pratos = [n for n in abas if chave(n).startswith("MONTAGEM")]
    subs = [n for n in abas if chave(n).startswith("SB")]
    outras = [n for n in abas if n not in pratos and n not in subs]

    dados = {n: ler(wb[n]) for n in abas}
    porChave = {chave(nome_limpo(n)): n for n in abas}

    print(f"ABAS: {len(abas)}  ({len(pratos)} pratos, {len(subs)} sub-receitas, {len(outras)} outras)")
    if outras:
        print("  outras:", ", ".join(o.strip() for o in outras))

    sem_ing = [n for n in abas if not dados[n][2]]
    sem_rend = [n for n in subs if not dados[n][1]]
    print(f"  sem ingrediente ........... {len(sem_ing)}")
    print(f"  sub-receita sem rendimento  {len(sem_rend)}")
    print()

    usados = {}
    com_fator = []
    sem_bruto = []
    for n, (_, _, itens) in dados.items():
        for nome, liq, un, fator, bruto in itens:
            usados.setdefault(chave(nome), []).append(n)
            if fator is not None and abs(fator - 1) > 0.001:
                com_fator.append((n, nome, fator, liq, bruto))
            if bruto is None:
                sem_bruto.append((n, nome))

    sub_usadas = {k for k in usados if k in porChave}
    insumos = {k for k in usados if k not in porChave}
    print(f"INGREDIENTES: {sum(len(v) for v in usados.values())} linhas, {len(usados)} nomes distintos")
    print(f"  que são sub-receita desta planilha ... {len(sub_usadas)}")
    print(f"  insumos comprados .................... {len(insumos)}")
    print(f"  com fator de aproveitamento != 1 ..... {len(com_fator)} linhas")
    print(f"  SEM peso bruto (não dá para importar)  {len(sem_bruto)} linhas")
    print()

    if sem_rend:
        print("-- SUB-RECEITA SEM RENDIMENTO (bloqueia o custo por porção)")
        for n in sorted(sem_rend):
            print(f"   {n.strip()}")
        print()
    if sem_ing:
        print("-- ABA SEM INGREDIENTE")
        for n in sorted(sem_ing):
            print(f"   {n.strip()}")
        print()

    print("-- SUB-RECEITAS, e o rendimento declarado")
    for n in sorted(subs):
        print(f"   {nome_limpo(n):34} {dados[n][1] or '— SEM RENDIMENTO —'}")
    print()

    print(f"-- INSUMOS COMPRADOS ({len(insumos)}), por quantas fichas usam")
    for k in sorted(insumos, key=lambda k: (-len(usados[k]), k)):
        print(f"   {len(usados[k]):3}x  {k}")


if __name__ == "__main__":
    main(sys.argv[1])
