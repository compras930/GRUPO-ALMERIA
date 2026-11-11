#!/usr/bin/env python3
"""Fornecedor padrão de cada item da lista, tirado da planilha geral de compras.

   /usr/local/bin/python3.13 -I prisma/scripts/pedidos/gerar-fornecedores-padrao.py \
       <COMPRAS_*.xlsm> <pasta com as planilhas Solicitacao_*.xlsx> \
       > prisma/scripts/pedidos/4-fornecedores-padrao.sql

POR QUE A PLANILHA GERAL É A FONTE. É nela que quem compra escreve, toda
semana, de quem vem cada item — a informação existe há meses e não está no
app. Deduzir o fornecedor das notas seria pior: a nota diz quem FATUROU, que
nem sempre é a quem se pede (distribuidor, representante), e muita linha de
nota sequer casou com produto.

O FORNECEDOR PADRÃO É UM PALPITE BOM, NÃO UMA REGRA. Ele preenche a separação
da semana seguinte; quem compra troca quando quiser, e a troca é que vira o
novo padrão. Por isso o script só PREENCHE o que está vazio: rodar de novo não
desfaz escolha feita na tela.

Casa pelo NOME NORMALIZADO (sem acento, sem caixa, sem pontuação), porque os
dois arquivos são escritos à mão pela mesma equipe e divergem em acento e
espaço. O que não casa fica de fora e é listado no fim — item sem par é item
que alguém digitou diferente, e vale ver a lista.
"""
import glob
import hashlib
import re
import sys
import unicodedata

try:
    import openpyxl
except ImportError:
    sys.exit("recusado: openpyxl não encontrado — use /usr/local/bin/python3.13")

if len(sys.argv) < 3:
    sys.exit("uso: gerar-fornecedores-padrao.py <COMPRAS.xlsm> <pasta das listas>")

ABA_PARA_CASA = {
    "WINE GARDEN": "Wine Garden",
    "NORO": "Noroeste",
    "BEIRA LAGO": "Beira Lago",
    "104 SUL": "104 Sul",
}
ARQUIVO_PARA_CASA = {
    "Wine_Garden": "Wine Garden",
    "104_Sul": "104 Sul",
    "Beira_Lago": "Beira Lago",
    "Noroeste": "Noroeste",
}


def norm(s) -> str:
    s = unicodedata.normalize("NFD", str(s)).encode("ascii", "ignore").decode().upper()
    return re.sub(r"[^A-Z0-9]+", " ", s).strip()


def sql(s: str) -> str:
    return str(s).replace("'", "''")


# 1. As listas já importadas, para casar nome a nome.
listas: dict[str, dict[str, str]] = {}
for caminho in glob.glob(f"{sys.argv[2]}/*.xlsx"):
    casa = next((c for k, c in ARQUIVO_PARA_CASA.items() if k in caminho.replace(" ", "_")), None)
    if not casa:
        continue
    ws = openpyxl.load_workbook(caminho, data_only=True)["Solicitação de Compras"]
    nomes: dict[str, str] = {}
    for r in ws.iter_rows(min_row=8, values_only=True):
        if r[1] and r[2]:
            nomes.setdefault(norm(r[1]), str(r[1]).strip())
    listas[casa] = nomes

if len(listas) < 4:
    sys.exit(f"recusado: achei lista de {len(listas)} casas, esperava 4")

# 2. Os pares (casa, item, fornecedor) da planilha geral.
wb = openpyxl.load_workbook(sys.argv[1], data_only=True)
pares: list[tuple[str, str, str]] = []
fornecedores: set[str] = set()
sem_par: dict[str, list[str]] = {}
for aba, casa in ABA_PARA_CASA.items():
    if aba not in wb.sheetnames:
        sys.exit(f"recusado: aba {aba} não existe na planilha geral")
    for r in wb[aba].iter_rows(min_row=3, values_only=True):
        produto = r[1] if len(r) > 1 else None
        fornecedor = r[6] if len(r) > 6 else None
        if not produto or not fornecedor:
            continue
        chave = norm(produto)
        candidatos = [k for k in listas[casa] if k == chave]
        if not candidatos:
            candidatos = [k for k in listas[casa] if k.startswith(chave) or chave.startswith(k)]
        if not candidatos:
            sem_par.setdefault(casa, []).append(str(produto).strip())
            continue
        # O nome da LISTA é o que grava: é ele que está no banco.
        nome_na_lista = listas[casa][sorted(candidatos, key=len)[0]]
        f = str(fornecedor).strip().upper()
        fornecedores.add(f)
        pares.append((casa, nome_na_lista, f))

# Um item pode aparecer duas vezes na planilha geral; fica o primeiro.
vistos = set()
unicos = []
for casa, item, f in pares:
    if (casa, item) in vistos:
        continue
    vistos.add((casa, item))
    unicos.append((casa, item, f))

print("-- Fornecedor padrão de cada item da lista de compras.")
print("-- GERADO por prisma/scripts/pedidos/gerar-fornecedores-padrao.py — não editar à mão.")
print(f"-- {len(unicos)} itens, {len(fornecedores)} fornecedores.")
print("--")
print("-- Só PREENCHE o que está vazio: rodar de novo não desfaz a escolha feita")
print("-- na tela. O padrão é palpite bom, não regra.")
print()

print("-- 1. Os fornecedores que ainda não existem no cadastro.")
print('INSERT INTO "Fornecedor" ("id", "nome")')
print("SELECT v.id, v.nome FROM (VALUES")
linhas = []
for f in sorted(fornecedores):
    ident = "frn" + hashlib.md5(f.encode()).hexdigest()[:16]
    linhas.append(f"    ('{ident}', '{sql(f)}')")
print(",\n".join(linhas))
print("  ) AS v(id, nome)")
print(' WHERE NOT EXISTS (SELECT 1 FROM "Fornecedor" f WHERE upper(btrim(f."nome")) = v.nome);')
print()

print("-- 2. O fornecedor padrão de cada item.")
print('UPDATE "ListaPedidoItem" l')
print('   SET "fornecedorPadraoId" = f.id')
print('  FROM (VALUES')
linhas = [f"    ('{sql(casa)}', '{sql(item)}', '{sql(f)}')" for casa, item, f in unicos]
print(",\n".join(linhas))
print("  ) AS v(casa, item, fornecedor)")
print('  JOIN "Unidade"    u ON u."nome" = v.casa')
print('  JOIN "Fornecedor" f ON upper(btrim(f."nome")) = v.fornecedor')
print(' WHERE l."unidadeId" = u.id')
print('   AND l."nome" = v.item')
print('   AND l."fornecedorPadraoId" IS NULL;')
print()

print("-- Conferência: quantos itens de cada casa já têm fornecedor.")
print('SELECT u.nome AS casa, count(*) AS itens,')
print('       count(l."fornecedorPadraoId") AS com_fornecedor')
print('  FROM "ListaPedidoItem" l JOIN "Unidade" u ON u.id = l."unidadeId"')
print(" GROUP BY 1 ORDER BY 1;")

for casa, itens in sem_par.items():
    print(f"-- sem par na lista de {casa} ({len(itens)}): {', '.join(itens[:8])}", file=sys.stderr)
