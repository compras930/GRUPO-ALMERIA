#!/usr/bin/env python3
"""SQL só de leitura: quanto da planilha de fichas o cadastro já conhece.

   /usr/local/bin/python3.13 -I prisma/scripts/fichas-beira-lago/gerar-diagnostico.py \
       fichas.json > prisma/scripts/fichas-beira-lago/1-diagnostico.sql

POR QUE MEDIR ANTES DE IMPORTAR. O ingrediente da ficha é escrito pelo chef
("MANTEIGA SEM SAL"); o produto do cadastro vem do Teknisa com outra grafia
("MANTEIGA COMUM S/ SAL 5KG"). Importar primeiro e descobrir depois quantos
não casaram é como a importação anterior parou: fichas gravadas com metade
dos ingredientes, e custo saindo pela metade — baixo, convincente e errado.

O casamento aqui é POR NOME porque não existe outro caminho: a planilha não
tem código de produto. Por isso o nome normalizado é só o primeiro filtro, e o
que não casa vira lista para alguém parear à mão — nunca um palpite gravado.
"""
import json
import re
import sys
import unicodedata

if len(sys.argv) < 2:
    sys.exit("uso: gerar-diagnostico.py <fichas.json>")

dados = json.load(open(sys.argv[1], encoding="utf-8"))
fichas = dados["fichas"]

insumos = sorted({i["chave"] for f in fichas for i in f["ingredientes"] if i["tipo"] == "INSUMO"})
nomes_de_ficha = sorted({f["chave"] for f in fichas})
# Quantas vezes cada insumo aparece: ordena a fila de pareamento por impacto.
uso = {}
for f in fichas:
    for i in f["ingredientes"]:
        if i["tipo"] == "INSUMO":
            uso[i["chave"]] = uso.get(i["chave"], 0) + 1

sql = lambda s: str(s).replace("'", "''")

# A mesma normalização do Python, em SQL: sem acento, sem pontuação, caixa
# alta. Tem que ser a MESMA, senão o diagnóstico mente para os dois lados.
NORM = (
    "upper(regexp_replace(translate(btrim({c}), "
    "'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', "
    "'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g'))"
)

print("-- Diagnóstico das fichas técnicas do Beira Lago. SÓ LEITURA.")
print(f"-- {len(fichas)} fichas, {len(insumos)} insumos distintos.")
print("-- GERADO por prisma/scripts/fichas-beira-lago/gerar-diagnostico.py")
print()

print("-- 1. Quantos insumos da planilha o cadastro conhece.")
print("WITH planilha(chave, usos) AS (VALUES")
print(",\n".join(f"  ('{sql(k)}', {uso[k]})" for k in insumos))
print("),")
print("casados AS (")
print("  SELECT p.chave, p.usos, count(DISTINCT pr.id) AS produtos,")
print("         min(pr.nome) AS exemplo")
print("    FROM planilha p")
print(f"    LEFT JOIN \"Produto\" pr ON {NORM.format(c='pr.nome')} = p.chave AND pr.ativo")
print("   GROUP BY 1, 2")
print(")")
print("SELECT CASE WHEN produtos = 1 THEN 'casou com 1 produto'")
print("            WHEN produtos > 1 THEN 'ambiguo: mais de um produto'")
print("            ELSE 'sem produto no cadastro' END AS situacao,")
print("       count(*) AS insumos, sum(usos) AS linhas_de_ficha")
print("  FROM casados GROUP BY 1 ORDER BY 2 DESC;")
print()

print("-- 2. Os que NÃO casaram, por quantas fichas dependem deles.")
print("--    É a fila de pareamento: o de cima trava mais ficha.")
print("WITH planilha(chave, usos) AS (VALUES")
print(",\n".join(f"  ('{sql(k)}', {uso[k]})" for k in insumos))
print(")")
print("SELECT p.chave AS insumo_da_planilha, p.usos AS fichas_que_usam")
print("  FROM planilha p")
print(" WHERE NOT EXISTS (")
print(f"   SELECT 1 FROM \"Produto\" pr WHERE pr.ativo AND {NORM.format(c='pr.nome')} = p.chave")
print(" )")
print(" ORDER BY p.usos DESC, 1")
print(" LIMIT 60;")
print()

print("-- 3. Fichas que já existem como receita no Beira Lago — estas o import")
print("--    NÃO pode recriar, sob pena de duplicar o cardápio.")
print("WITH planilha(chave) AS (VALUES")
print(",\n".join(f"  ('{sql(k)}')" for k in nomes_de_ficha))
print(")")
print("SELECT count(*) FILTER (WHERE r.id IS NOT NULL) AS ja_existem,")
print("       count(*) FILTER (WHERE r.id IS NULL)     AS a_criar")
print("  FROM planilha p")
print('  LEFT JOIN "Receita" r ON ' + NORM.format(c="r.nome") + " = p.chave")
print('  LEFT JOIN "Unidade" u ON u.id = r."unidadeId" AND u.nome = \'Beira Lago\';')
print()

print("-- 4. Fichas que casam com item do CARDÁPIO do Beira Lago — são as que,")
print("--    depois de criadas, passam a baixar estoque na venda.")
print("WITH planilha(chave) AS (VALUES")
print(",\n".join(f"  ('{sql(k)}')" for k in nomes_de_ficha))
print(")")
print("SELECT count(DISTINCT iv.id) AS itens_de_cardapio_que_ganham_ficha")
print("  FROM planilha p")
print('  JOIN "Unidade" u ON u.nome = \'Beira Lago\'')
print('  JOIN "ItemVenda" iv ON iv."unidadeId" = u.id AND iv.ativo')
print(f"   AND {NORM.format(c='iv.nome')} = p.chave")
print('  WHERE iv."receitaId" IS NULL;')
