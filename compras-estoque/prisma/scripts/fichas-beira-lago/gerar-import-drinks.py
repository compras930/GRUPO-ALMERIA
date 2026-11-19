#!/usr/bin/env python3
"""Importa as fichas de DRINK do Beira Lago.

   /usr/local/bin/python3.13 -I prisma/scripts/fichas-beira-lago/gerar-import-drinks.py \
       drinks.json prisma/scripts/fichas-beira-lago

Gera 6a-drinks.sql (as fichas), 6b-ingredientes-drinks.sql e
6z-conferencia-drinks.sql.

RENDIMENTO 1 UND, E ISSO É A DEFINIÇÃO DO DRINK. A ficha inteira é uma dose
servida: 60 ml de gin, 30 de limão, 20 de xarope é o copo que vai à mesa. O
custo da ficha já é o custo por drink, sem divisão — ao contrário da cozinha,
onde a ficha rende 9,5 kg e é preciso dividir pela porção.

A UNIDADE RESOLVE SOZINHA, E FOI UMA SURPRESA BOA. O medo era o drink medir
em litro contra garrafa cadastrada em unidade — 0,03 contra um produto em UND
diria 3% de uma garrafa, certo por acaso para 750 ml e errado em 25% para a
de litro. Mas a maioria das garrafas do Beira Lago está cadastrada em LT, e
aí 0,03 LT é 0,03 do produto, sem conversão nenhuma. Onde o produto está em
UND, a linha NÃO ENTRA: vira pendência, não chute.

O QUE NÃO ENTRA, E POR QUÊ:
  - ingrediente sem produto casado (23 garrafas que o cadastro não conhece);
  - produção do bar (sumo de limão, xarope simples, mel fermentado): não se
    compra, vira ficha própria — e sem ela 22 dos 52 drinks ficam incompletos;
  - produto cadastrado em UND ou CX: falta o volume da embalagem.
Tudo isso sai listado no 6z, que é a lista de trabalho do bar.

SEGURO REPETIR, EM QUALQUER ORDEM: cada linha é gravada pelo próprio id, com
"se já existir, atualize". Nenhuma parte depende de outra ter rodado antes.
"""
import csv
import hashlib
import json
import re
import sys
import unicodedata
from pathlib import Path

if len(sys.argv) < 3:
    sys.exit("uso: gerar-import-drinks.py <drinks.json> <destino>")

CASA = "Beira Lago"
destino = Path(sys.argv[2])
drinks = json.load(open(sys.argv[1], encoding="utf-8"))["drinks"]


def norm(s) -> str:
    s = unicodedata.normalize("NFD", str(s)).encode("ascii", "ignore").decode().upper()
    return re.sub(r"[^A-Z0-9]+", " ", s).strip()


def ident(prefixo: str, *partes: str) -> str:
    return prefixo + hashlib.md5("|".join(partes).encode()).hexdigest()[:20]


def sql(s) -> str:
    return str(s).replace("'", "''")


NORM = (
    "upper(regexp_replace(translate(btrim({c}), "
    "'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', "
    "'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]+', ' ', 'g'))"
)
# Só unidade de peso ou volume: é onde a quantidade da ficha significa o mesmo
# que a quantidade do cadastro.
UNIDADES = "('KG', 'G', 'LT', 'L', 'ML')"

# Resolvidos FORA do 6b, por SQL próprio, porque precisaram de conversão de
# unidade. Sem esta lista, a conferência os acusa como pendentes — e lista que
# mente sobre o trabalho já feito faz alguém refazer o que estava pronto.
CONVERTIDOS = {"ST PIERRE AGUA TONICA"}  # 8-tonica.sql: 0,2 LT = 0,74 lata

pares_path = destino / "pares-drinks.csv"
apelido = {}
if pares_path.exists():
    for linha in csv.reader(pares_path.open(encoding="utf-8"), delimiter=";"):
        if len(linha) >= 2:
            apelido[norm(linha[0])] = norm(linha[1])

rec_id = {d["chave"]: ident("recdk", CASA, d["chave"]) for d in drinks}

# ---------------------------------------------------------------- as fichas
fichas = ",\n".join(
    f"    ('{rec_id[d['chave']]}', '{sql(d['nome'])}', '{sql(d['chave'])}')" for d in drinks
)
(destino / "6a-drinks.sql").write_text(
    f"""-- Fichas de DRINK do Beira Lago — as fichas. {len(drinks)} drinks.
-- GERADO por gerar-import-drinks.py; não editar à mão.
--
-- FAÇA UM BRANCH NO NEON ANTES (Branches > Create branch).
--
-- RENDIMENTO 1 UND: a ficha inteira é uma dose servida, então o custo dela já
-- é o custo por drink. Não se divide por nada.
--
-- Não cria ficha cujo nome já exista na casa — e, diferente da importação da
-- cozinha, aqui isso não deixa ninguém para trás: o 6b resolve a ficha PELO
-- NOME, então o drink que já existir recebe os ingredientes na mesma.

BEGIN;

INSERT INTO "Receita" ("id", "unidadeId", "nome", "rendimentoQtd", "rendimentoUnidade", "criadoEm", "atualizadoEm")
SELECT v.id, u.id, v.nome, 1, 'UND', now(), now()
  FROM "Unidade" u, (VALUES
{fichas}
  ) AS v(id, nome, chave)
 WHERE u.nome = '{CASA}'
   AND NOT EXISTS (
     SELECT 1 FROM "Receita" r
      WHERE r."unidadeId" = u.id AND {NORM.format(c='r.nome')} = v.chave
   )
-- Trava de segurança: o NOT EXISTS compara nome normalizado, o banco compara
-- o nome cru. Dois nomes que só diferem por acento passariam pelo primeiro e
-- quebrariam no segundo, derrubando a carga inteira por causa de uma linha.
ON CONFLICT ("unidadeId", "nome") DO NOTHING;

COMMIT;

-- Conferência: quantos drinks existem agora na casa.
SELECT count(*) AS drinks_no_app
  FROM "Receita" r
  JOIN "Unidade" u ON u.id = r."unidadeId" AND u.nome = '{CASA}'
 WHERE {NORM.format(c='r.nome')} IN (
{",".join(chr(10) + "   '" + sql(d["chave"]) + "'" for d in drinks)}
 );
""",
    encoding="utf-8",
)

# ----------------------------------------------------------- os ingredientes
linhas = []
pendentes = []
for d in drinks:
    for pos, ing in enumerate(d["ingredientes"]):
        alvo = apelido.get(ing["chave"], ing["chave"])
        if ing["chave"] in CONVERTIDOS:
            continue
        linhas.append(
            f"    ('{ident('ingdk', CASA, d['chave'], str(pos))}', '{sql(d['chave'])}', "
            f"'{sql(alvo)}', {ing['quantidade']})"
        )
        pendentes.append((d["nome"], ing["nome"], alvo, ing["quantidade"]))

(destino / "6b-ingredientes-drinks.sql").write_text(
    f"""-- Fichas de DRINK do Beira Lago — os ingredientes. {len(linhas)} linhas.
-- GERADO por gerar-import-drinks.py; não editar à mão.
--
-- Pode rodar na ordem que for, e pode repetir: cada linha é gravada pelo
-- próprio id, e regravar atualiza em vez de duplicar.
--
-- SÓ ENTRA O QUE RESOLVE. Ingrediente sem produto casado, ou com produto
-- cadastrado em UND/CX (falta o volume da embalagem), não é gravado — e
-- aparece nomeado no 6z. Gravar pela metade daria custo baixo e convincente,
-- que é pior que custo nenhum.

BEGIN;

INSERT INTO "IngredienteReceita" ("id", "receitaId", "produtoId", "subReceitaId", "quantidade", "unidadeMedida")
SELECT DISTINCT ON (v.id)
       v.id, r.id, pr.id, NULL, v.quantidade, pr."unidadeMedida"
  FROM (VALUES
{",".join(chr(10) + l for l in linhas)}
  ) AS v(id, chave_drink, chave_produto, quantidade)
  JOIN "Unidade" u ON u.nome = '{CASA}'
  JOIN "Receita" r ON r."unidadeId" = u.id AND {NORM.format(c='r.nome')} = v.chave_drink
  JOIN "Produto" pr ON pr.ativo
                   AND {NORM.format(c='pr.nome')} = v.chave_produto
                   AND upper(btrim(pr."unidadeMedida")) IN {UNIDADES}
 ORDER BY v.id, pr.id
ON CONFLICT ("id") DO UPDATE
   SET "receitaId"     = EXCLUDED."receitaId",
       "produtoId"     = EXCLUDED."produtoId",
       "quantidade"    = EXCLUDED."quantidade",
       "unidadeMedida" = EXCLUDED."unidadeMedida";

COMMIT;
""",
    encoding="utf-8",
)

# ------------------------------------------------------------- a conferência
esperado = {}
for d in drinks:
    esperado[d["chave"]] = (d["nome"], len(d["ingredientes"]))

(destino / "6z-conferencia-drinks.sql").write_text(
    f"""-- Drinks do Beira Lago — conferência. SÓ LEITURA, rodar por último.

-- 1. O resumo.
WITH esperado(chave, nome, quantos) AS (VALUES
{",".join(chr(10) + f"  ('{sql(k)}', '{sql(v[0])}', {v[1]})" for k, v in esperado.items())}
)
SELECT count(*) AS drinks_no_app,
       sum((SELECT count(*) FROM "IngredienteReceita" i WHERE i."receitaId" = r.id)) AS ingredientes_gravados,
       sum(e.quantos) AS ingredientes_na_planilha,
       count(*) FILTER (WHERE (SELECT count(*) FROM "IngredienteReceita" i WHERE i."receitaId" = r.id) = e.quantos) AS drinks_completos
  FROM esperado e
  JOIN "Unidade" u ON u.nome = '{CASA}'
  JOIN "Receita" r ON r."unidadeId" = u.id AND {NORM.format(c='r.nome')} = e.chave;

-- 2. A lista de trabalho do bar: o que não entrou, e quantos drinks depende
--    dele. Ordenada pelo que mais aparece — é onde cada cadastro feito compra
--    mais exatidão.
WITH linha(chave_drink, ingrediente, chave_produto, quantidade) AS (VALUES
{",".join(chr(10) + f"  ('{sql(norm(n))}', '{sql(i)}', '{sql(a)}', {q})" for n, i, a, q in pendentes)}
)
SELECT l.ingrediente, count(*) AS drinks_que_usam,
       CASE
         WHEN pr.id IS NOT NULL THEN 'cadastrado em ' || pr."unidadeMedida" || ' — falta o volume da embalagem'
         ELSE 'nao existe no cadastro'
       END AS motivo
  FROM linha l
  LEFT JOIN "Produto" pr ON pr.ativo AND {NORM.format(c='pr.nome')} = l.chave_produto
 WHERE NOT EXISTS (
   SELECT 1 FROM "Produto" p2
    WHERE p2.ativo AND {NORM.format(c='p2.nome')} = l.chave_produto
      AND upper(btrim(p2."unidadeMedida")) IN {UNIDADES}
 )
 GROUP BY l.ingrediente, 3
 ORDER BY 2 DESC, 1;
""",
    encoding="utf-8",
)

print(f"{len(drinks)} drinks, {len(linhas)} linhas de ingrediente, {len(apelido)} pares.")
