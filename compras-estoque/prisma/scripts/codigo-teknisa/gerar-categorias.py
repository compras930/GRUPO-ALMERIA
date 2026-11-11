#!/usr/bin/env python3
"""Gera o SQL que preenche Produto.categoria a partir do código do Teknisa.

   python3 -I prisma/scripts/codigo-teknisa/gerar-categorias.py \
       <teknisa_compras_codigo_grupo.csv> > prisma/scripts/codigo-teknisa/categorias-teknisa.sql

POR QUE EXISTE. Em 11/11/2026 o diagnóstico mostrou que as três casas do
Teknisa tinham a maior parte do dinheiro em produto SEM categoria — R$ 408 mil
no 104 Sul, R$ 369 mil no Noroeste, R$ 365 mil no Wine Garden. A régua do CMV
enxuto é por categoria, e categoria vazia não entra: o enxuto dessas casas
estava enxergando perto de um quinto da compra real.

O VOCABULÁRIO É O DO PAINEL ("Insumo de cozinha", "Bebida", "Revenda emporio"…)
e não uma tradução para os nomes antigos. Dois vocabulários para a mesma coisa
é como o CMV do Wine Garden virou 1,0% em novembro: cada lado conhecia metade.

CASA PELA LINHA DE COMPRA, não por CodigoCompraProduto. A primeira versão
usava aquela tabela e atualizou 14 produtos de 1.079: ela só guarda os códigos
que precisaram de CONVERSÃO de unidade, não todos os que a casa compra. O
código de verdade está em ItemNotaCompra — no `codigoBruto` e, nas cargas
antigas que não o preenchiam, no quarto campo de `chaveOrigem`
(unidade|data|NF|codigoProduto|seq).

SÓ AS TRÊS CASAS DO TEKNISA. O Beira Lago vem do XMenu, que tem espaço de
código independente: nada garante que "1042" de um não seja "1042" do outro.
Restringir pela casa é mais barato que depender de `origemBruta`, que está no
schema mas pode não estar no banco.

AGRUPA POR CATEGORIA em vez de uma linha por produto: sete UPDATEs com lista de
código cabem em ~16 KB, e o console do Neon trunca script grande sem avisar.

RECUSA SE O CSV TIVER CÓDIGO COM DUAS CATEGORIAS. Nesse caso não há resposta
certa para escolher sozinho, e escrever a errada é pior que não escrever.
"""
import csv
import sys
from collections import defaultdict

if len(sys.argv) < 2:
    sys.exit("uso: gerar-categorias.py <arquivo.csv>")

linhas = list(csv.DictReader(open(sys.argv[1], encoding="utf-8-sig")))
if not linhas:
    sys.exit("recusado: CSV vazio")

por_codigo = defaultdict(set)
nome = {}
for l in linhas:
    codigo = l["codigoProduto"].strip()
    categoria = l["categoria"].strip()
    if not codigo or not categoria:
        sys.exit(f"recusado: linha sem código ou categoria: {l}")
    por_codigo[codigo].add(categoria)
    nome[codigo] = l["nomeProduto"].strip()

conflitos = {c: v for c, v in por_codigo.items() if len(v) > 1}
if conflitos:
    for c, v in list(conflitos.items())[:10]:
        print(f"-- CONFLITO {c} {nome[c]}: {sorted(v)}", file=sys.stderr)
    sys.exit(f"recusado: {len(conflitos)} código(s) com mais de uma categoria")

por_categoria = defaultdict(list)
for codigo, cats in por_codigo.items():
    por_categoria[cats.pop()].append(codigo)

print("-- Preenche Produto.categoria pelo código de compra do Teknisa.")
print("-- GERADO por prisma/scripts/codigo-teknisa/gerar-categorias.py — não editar à mão.")
print(f"-- {len(por_codigo)} códigos, {len(por_categoria)} categorias.")
print("--")
print("-- Casa o produto pelo CÓDIGO, nunca pelo nome: é a lição mais cara deste")
print("-- projeto. 'AZEITE EXTRA VIRGEM 3L' existe escrito de quatro jeitos.")
print("--")
print("-- Seguro rodar duas vezes: UPDATE idempotente, nenhuma linha criada.")
print()

for categoria in sorted(por_categoria):
    codigos = sorted(por_categoria[categoria])
    lista = ", ".join(f"'{c}'" for c in codigos)
    print(f"-- {categoria}: {len(codigos)} códigos")
    print('UPDATE "Produto" p')
    print(f"   SET categoria = '{categoria}'")
    print(f" WHERE coalesce(p.categoria, '') IS DISTINCT FROM '{categoria}'")
    print("   AND p.id IN (")
    print('     SELECT i."produtoId"')
    print('       FROM "ItemNotaCompra" i')
    print('       JOIN "NotaCompra" n ON n.id = i."notaCompraId"')
    print('       JOIN "Unidade"    u ON u.id = n."unidadeId"')
    print('      WHERE i."produtoId" IS NOT NULL')
    print("        AND u.nome IN ('104 Sul', 'Noroeste', 'Wine Garden')")
    print("        AND coalesce(i.\"codigoBruto\", split_part(coalesce(i.\"chaveOrigem\", ''), '|', 4))")
    print(f"            IN ({lista})")
    print("   );")
    print()

print("-- Conferência: quanto sobrou sem categoria, por casa, nos últimos 3 meses.")
print("""SELECT u.nome AS casa,
       count(DISTINCT p.id) FILTER (WHERE coalesce(trim(p.categoria), '') = '') AS produtos_sem_categoria,
       count(DISTINCT p.id)                                                     AS produtos_comprados
  FROM "ItemNotaCompra" i
  JOIN "NotaCompra" n ON n.id = i."notaCompraId"
  JOIN "Unidade"    u ON u.id = n."unidadeId"
  JOIN "Produto"    p ON p.id = i."produtoId"
 WHERE i."dataCompra" >= date_trunc('month', now()) - interval '2 months'
 GROUP BY 1
 ORDER BY 1;""")
