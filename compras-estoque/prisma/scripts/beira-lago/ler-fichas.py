"""Lê a planilha de fichas técnicas do Beira Lago (FTP MENU ALMERIA LAGO) e diz
o que tem dentro, ANTES de importar qualquer coisa.

Mesma ideia do ler-fichas.py do Matri: importar ficha mexe em custo de prato e
em consumo teórico, e um rendimento errado no meio de 170 fichas muda número no
painel sem avisar. Primeiro se olha, depois se importa.

A planilha tem três tipos de aba:
  DASHBOARD  o cardápio: status, tipo, nome no menu, custo, preço, CMV
  INSUMOS    a lista de preços — insumo comprado e sub-receita na mesma coluna
  o resto    uma ficha por aba, no layout "FICHA TÉCNICA DE PREPARO"

O QUE ESTE SCRIPT PROCURA, que é o que estraga importação de ficha:
  - ficha sem rendimento (sem ele não dá para calcular custo por porção)
  - ficha sem ingrediente nenhum (aba criada e nunca preenchida)
  - ingrediente que é OUTRA FICHA (sub-receita) x insumo comprado
  - prato do cardápio sem aba de ficha

Uso:
    python3 -I prisma/scripts/beira-lago/ler-fichas.py <arquivo.xlsx>
"""

import sys
import unicodedata

import openpyxl

ABAS_NAO_FICHA = {"DASHBOARD", "INSUMOS"}


def chave(nome):
    """Compara nome ignorando caixa, acento e espaço — a mesma lição de sempre:
    o mesmo preparo aparece como 'AIOLI DE TABASCO' na lista de preços e
    'AIOLI TABASCO' no nome da aba."""
    s = unicodedata.normalize("NFKD", str(nome or "")).encode("ascii", "ignore").decode()
    return " ".join(s.split()).upper()


def ler_ficha(ws):
    """Devolve (rendimento, unidade, [(ingrediente, quantidade)])."""
    rendimento, unidade, ingredientes = None, None, []
    lendo = False
    for linha in ws.iter_rows(values_only=True):
        celulas = [c for c in linha]
        texto = [chave(c) for c in celulas]
        if "RENDIMENTO:" in texto:
            i = texto.index("RENDIMENTO:")
            rendimento = celulas[i + 1] if i + 1 < len(celulas) else None
            unidade = celulas[i + 2] if i + 2 < len(celulas) else None
            continue
        if "INGREDIENTES" in texto:
            lendo = True
            continue
        if not lendo:
            continue
        # A coluna B tem o nome; a C, o peso bruto. Linha sem as duas encerra
        # a lista (é o TOTAL, ou o "1 kg = R$").
        nome = celulas[1] if len(celulas) > 1 else None
        qtd = celulas[2] if len(celulas) > 2 else None
        if nome is None or chave(nome) in ("TOTAL:", "TOTAL", ""):
            continue
        if chave(nome).startswith("1 KG"):
            continue
        ingredientes.append((str(nome).strip(), qtd))
    return rendimento, unidade, ingredientes


def main(caminho):
    wb = openpyxl.load_workbook(caminho, data_only=True)
    abas = [n for n in wb.sheetnames if n.strip().upper() not in ABAS_NAO_FICHA]
    porChave = {chave(n): n for n in abas}

    fichas = {}
    for n in abas:
        fichas[n] = ler_ficha(wb[n])

    sem_rendimento = [n for n, (r, _, _) in fichas.items() if not isinstance(r, (int, float)) or not r]
    sem_ingrediente = [n for n, (_, _, ing) in fichas.items() if not ing]

    usados = {}
    for n, (_, _, ing) in fichas.items():
        for nome, qtd in ing:
            usados.setdefault(chave(nome), []).append((n, nome, qtd))

    sub_receitas = {k for k in usados if k in porChave}
    insumos = {k for k in usados if k not in porChave}

    print(f"ABAS DE FICHA: {len(abas)}")
    print(f"  sem rendimento ....... {len(sem_rendimento)}")
    print(f"  sem ingrediente ...... {len(sem_ingrediente)}")
    print()
    print(f"INGREDIENTES: {sum(len(v) for v in usados.values())} linhas, {len(usados)} nomes distintos")
    print(f"  sub-receitas (= outra aba) ... {len(sub_receitas)}")
    print(f"  insumos comprados ............ {len(insumos)}")
    print()

    # Ficha que ninguém usa e não está no cardápio é preparo órfão — ou sobrou
    # de uma versão antiga do menu, ou o prato que a usa está com outro nome.
    ws = wb["DASHBOARD"]
    menu = []
    for linha in ws.iter_rows(min_row=2, values_only=True):
        tipo = linha[1] if len(linha) > 1 else None
        nome = linha[2] if len(linha) > 2 else None
        if nome and str(nome).strip():
            menu.append((str(linha[0] or "").strip(), str(tipo or "").strip(), str(nome).strip()))
    print(f"CARDÁPIO (DASHBOARD): {len(menu)} itens")
    sem_aba = [m for m in menu if chave(m[2]) not in porChave]
    print(f"  sem aba de ficha ..... {len(sem_aba)}")
    print()

    if sem_rendimento:
        print("-- FICHAS SEM RENDIMENTO (bloqueiam o custo por porção)")
        for n in sorted(sem_rendimento):
            print(f"   {n.strip()}")
        print()
    if sem_ingrediente:
        print("-- FICHAS SEM INGREDIENTE")
        for n in sorted(sem_ingrediente):
            print(f"   {n.strip()}")
        print()

    print("-- INSUMOS COMPRADOS, por quantas fichas usam")
    ordenados = sorted(insumos, key=lambda k: (-len(usados[k]), k))
    for k in ordenados:
        print(f"   {len(usados[k]):3}x  {usados[k][0][1]}")


if __name__ == "__main__":
    main(sys.argv[1])
