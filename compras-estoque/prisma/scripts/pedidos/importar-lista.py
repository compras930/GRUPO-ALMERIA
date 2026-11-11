#!/usr/bin/env python3
"""Transforma a planilha "Solicitação de Compras" de uma casa em SQL de carga.

   /usr/local/bin/python3.13 -I prisma/scripts/pedidos/importar-lista.py \
       "<planilha.xlsx>" "<nome da casa no app>" > 3-lista-<casa>.sql

A PLANILHA É A FONTE, e de propósito. Ela já é o vocabulário de quem pede, na
ordem em que a pessoa anda pela despensa — seção por seção. Reescrever esses
885 nomes no vocabulário do Teknisa antes de a tela existir seria trocar a
ferramenta da casa por outra pior, e cobrar duas semanas de pareamento por
isso.

O QUE É LIDO: nome (coluna B), unidade de compra (C) e a seção, que é a linha
que tem texto na coluna A e nada em B e C. A coluna QTD é ignorada — ela é o
pedido DA SEMANA PASSADA, não o catálogo.

NÃO APAGA NADA: `ON CONFLICT DO UPDATE` só corrige seção, unidade e ordem. Item
que a casa parou de pedir sai pela tela (ativo = false), não por sumir do
arquivo — some do arquivo é como se perde a memória de que ele existia.
"""
import hashlib
import re
import sys
import unicodedata

try:
    import openpyxl
except ImportError:
    sys.exit("recusado: openpyxl não encontrado — use /usr/local/bin/python3.13")

if len(sys.argv) < 3:
    sys.exit('uso: importar-lista.py <planilha.xlsx> "<nome da casa>"')

caminho, casa = sys.argv[1], sys.argv[2]
ws = openpyxl.load_workbook(caminho, data_only=True)["Solicitação de Compras"]

RODAPE = re.compile(r"lista de produtos|preencher qtd|hist[oó]rico", re.I)


def limpo(v) -> str:
    return re.sub(r"\s+", " ", str(v)).strip() if v is not None else ""


def sql(s: str) -> str:
    return s.replace("'", "''")


def ident(casa: str, nome: str) -> str:
    """Id estável: reimportar a planilha não cria linha nova nem id novo."""
    base = f"{casa}|{nome}".lower()
    base = unicodedata.normalize("NFD", base).encode("ascii", "ignore").decode()
    # md5 e não hash(): o hash do Python é semeado por processo, então o id
    # mudaria a cada rodada e a reimportação criaria linha nova.
    digest = hashlib.md5(base.encode()).hexdigest()[:8]
    return "lst" + re.sub(r"[^a-z0-9]+", "", base)[:28] + digest


itens = []
secao = None
for linha in ws.iter_rows(min_row=8, values_only=True):
    a, nome, unidade = limpo(linha[0]), limpo(linha[1]), limpo(linha[2])
    if a and not nome and not unidade:
        if RODAPE.search(a):  # o rodapé explicativo não é seção
            continue
        secao = a
        continue
    if not nome or not unidade:
        continue
    if not secao:
        sys.exit(f"recusado: item antes de qualquer seção: {nome}")
    itens.append((secao, nome, unidade))

if not itens:
    sys.exit("recusado: nenhum item lido — a planilha mudou de formato?")

vistos = set()
unicos = []
for secao, nome, unidade in itens:
    chave = nome.upper()
    if chave in vistos:
        print(f"-- repetido na planilha, mantido só o primeiro: {nome}", file=sys.stderr)
        continue
    vistos.add(chave)
    unicos.append((secao, nome, unidade))

print(f"-- Lista de compras: {casa}")
print(f"-- GERADO de {caminho.split('/')[-1]} por prisma/scripts/pedidos/importar-lista.py")
print(f"-- {len(unicos)} itens em {len(set(s for s, _, _ in unicos))} seções.")
print("--")
print("-- Seguro rodar duas vezes: o id é derivado do nome e o conflito atualiza")
print("-- seção, unidade e ordem — nunca apaga o que a casa já marcou.")
print()
print('INSERT INTO "ListaPedidoItem" ("id", "unidadeId", "secao", "nome", "unidadeCompra", "ordem")')
print("SELECT v.id, u.id, v.secao, v.nome, v.unidade, v.ordem")
print('  FROM "Unidade" u, (VALUES')
linhas = [
    f"    ('{ident(casa, n)}', '{sql(s)}', '{sql(n)}', '{sql(un)}', {i})"
    for i, (s, n, un) in enumerate(unicos, start=1)
]
print(",\n".join(linhas))
print("  ) AS v(id, secao, nome, unidade, ordem)")
print(f" WHERE u.nome = '{sql(casa)}'")
print('ON CONFLICT ("unidadeId", "nome") DO UPDATE')
print('   SET "secao" = EXCLUDED."secao",')
print('       "unidadeCompra" = EXCLUDED."unidadeCompra",')
print('       "ordem" = EXCLUDED."ordem";')
print()
print("-- Conferência: deve bater com o número de itens acima.")
print('SELECT u.nome AS casa, count(*) AS itens, count(DISTINCT l."secao") AS secoes')
print('  FROM "ListaPedidoItem" l JOIN "Unidade" u ON u.id = l."unidadeId"')
print(f" WHERE u.nome = '{sql(casa)}' GROUP BY 1;")
