#!/usr/bin/env python3
"""Gera o SQL que importa as fichas técnicas do Beira Lago.

   /usr/local/bin/python3.13 -I prisma/scripts/fichas-beira-lago/gerar-import.py \
       fichas.json prisma/scripts/fichas-beira-lago [pares.csv]

`pares.csv` é opcional, duas colunas sem cabeçalho:

    INSUMO DA FICHA;NOME DO PRODUTO NO CADASTRO

É a resposta humana ao SQL de candidatos — "PIMENTA DO REINO" é a moída de
500 g, e não a em grãos. Sem ele, entram só os insumos que casam por nome.

ESCREVE EM PARTES: o import inteiro passa de 140 KB e o console do Neon trunca
script grande sem avisar. Cada parte cabe folgada e elas rodam na ordem do
nome do arquivo.

AS QUATRO REGRAS DESTE IMPORT, e por quê:

1. A IDENTIDADE DA FICHA É O NOME DA ABA. Em 75 abas o campo "Item:" não bate
   com o nome da aba, e em 17 delas ele é o nome de OUTRA ficha — alguém
   duplicou a aba e não trocou o campo. Usar o "Item:" criaria receita com
   nome errado e faria a sub-receita apontar para o prato errado, em silêncio
   e com custo plausível.

2. NÃO TOCA EM FICHA QUE JÁ EXISTE. Receita com o mesmo nome na casa fica como
   está. Pode ser ficha escrita à mão, com correção que a planilha não tem;
   sobrescrever apagaria o trabalho de outra pessoa sem perguntar.

3. INGREDIENTE QUE NÃO RESOLVEU NÃO É GRAVADO, e a ficha entra incompleta. É
   deliberado: ficha com 6 de 8 ingredientes dá custo baixo e convincente, que
   é pior que custo nenhum. Por isso a conferência lista toda ficha incompleta.

4. UNIDADE TEM QUE SER COMPATÍVEL. A planilha mede em Kg/L. Produto cadastrado
   em UND ou CX não recebe "0,2" — 0,2 caixa de burrata não quer dizer nada, e
   gravar isso daria custo várias vezes maior ou menor sem avisar.
"""
import csv
import hashlib
import json
import re
import sys
import unicodedata

if len(sys.argv) < 3:
    sys.exit("uso: gerar-import.py <fichas.json> <pasta-de-saida> [pares.csv]")

CASA = "Beira Lago"
POR_PARTE = 300  # linhas de ingrediente por arquivo

fichas = json.load(open(sys.argv[1], encoding="utf-8"))["fichas"]
SAIDA = sys.argv[2].rstrip("/")

pares: dict[str, str] = {}
if len(sys.argv) > 3:
    with open(sys.argv[3], encoding="utf-8-sig") as fh:
        for linha in csv.reader(fh, delimiter=";"):
            if len(linha) >= 2 and linha[0].strip() and linha[1].strip():
                pares[linha[0].strip().upper()] = linha[1].strip()


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
UNIDADES_DE_PESO = "('KG', 'G', 'LT', 'L', 'ML')"

validas = [f for f in fichas if f["rendimento"]]
sem_rendimento = [f for f in fichas if not f["rendimento"]]
rec_id = {f["chave"]: ident("rec", CASA, f["chave"]) for f in validas}

partes: list[tuple[str, str]] = []

# ---------------------------------------------------------------- parte 1
cab = [
    "-- Fichas técnicas do Beira Lago — PARTE 1 de N: as fichas.",
    f"-- {len(validas)} fichas. GERADO; não editar à mão.",
    "--",
    "-- FAÇA UM BRANCH NO NEON ANTES (Branches > Create branch).",
    "-- Seguro rodar duas vezes: id derivado do nome, e nada é sobrescrito.",
]
if sem_rendimento:
    cab.append("--")
    cab.append("-- FORA DO IMPORT por falta de rendimento (sem ele não há custo por porção):")
    cab += [f"--   {f['nome']}" for f in sem_rendimento]

linhas = [
    f"    ('{rec_id[f['chave']]}', '{sql(f['nome'])}', {f['rendimento']}, "
    f"'{sql(f['unidade'] or 'Kg')}', '{sql(f['chave'])}')"
    for f in validas
]
parte1 = "\n".join(
    cab
    + [
        "",
        "BEGIN;",
        "",
        'INSERT INTO "Receita" ("id", "unidadeId", "nome", "rendimentoQtd", "rendimentoUnidade", "criadoEm", "atualizadoEm")',
        "SELECT v.id, u.id, v.nome, v.rend, v.un, now(), now()",
        '  FROM "Unidade" u, (VALUES',
        ",\n".join(linhas),
        "  ) AS v(id, nome, rend, un, chave)",
        f" WHERE u.nome = '{sql(CASA)}'",
        "   AND NOT EXISTS (",
        '     SELECT 1 FROM "Receita" r',
        '      WHERE r."unidadeId" = u.id AND ' + NORM.format(c="r.nome") + " = v.chave",
        "   );",
        "",
        "COMMIT;",
        "",
        "-- Conferência: quantas fichas desta planilha existem agora.",
        'SELECT count(*) AS fichas_no_app FROM "Receita" r WHERE r.id IN (',
        ",\n".join(f"  '{rec_id[f['chave']]}'" for f in validas),
        ");",
    ]
)
partes.append(("3a-fichas.sql", parte1))

# ------------------------------------------------------- partes seguintes
todas_linhas = []
for f in validas:
    for n, ing in enumerate(f["ingredientes"], start=1):
        alvo = pares.get(ing["chave"], "")
        chave_produto = norm(alvo) if alvo else ing["chave"]
        sub = ing.get("subreceita", "")
        todas_linhas.append(
            f"    ('{ident('ing', CASA, f['chave'], str(n))}', '{rec_id[f['chave']]}', "
            f"'{sql(chave_produto)}', '{sql(sub)}', {ing['quantidade']})"
        )

blocos = [todas_linhas[i : i + POR_PARTE] for i in range(0, len(todas_linhas), POR_PARTE)]
for n, bloco in enumerate(blocos, start=1):
    corpo = [
        f"-- Fichas do Beira Lago — ingredientes, parte {n} de {len(blocos)}.",
        "-- Rodar depois de 3a-fichas.sql. Pode rodar na ordem que for, e",
        "-- pode repetir qualquer parte: cada linha é gravada por id próprio.",
        "",
        "BEGIN;",
        "",
    ]
    if n == 1:
        corpo += [
            "-- Limpa os ingredientes SÓ das fichas desta planilha: rodar de novo",
            "-- regrava, em vez de duplicar. Ficha de outra origem não é tocada.",
            'DELETE FROM "IngredienteReceita" WHERE "receitaId" IN (',
            ",\n".join(f"  '{rec_id[f['chave']]}'" for f in validas),
            ");",
            "",
        ]
    corpo += [
        'INSERT INTO "IngredienteReceita" ("id", "receitaId", "produtoId", "subReceitaId", "quantidade", "unidadeMedida")',
        # DISTINCT ON: o cadastro tem produto homônimo — "CONHAQUE DOMECQ 1LT"
        # existe duas vezes, e o mesmo vale para outros oito. Sem isto o join
        # devolve duas linhas para o mesmo ingrediente e a segunda estoura na
        # chave primária, derrubando a carga inteira. Fica o de menor id, que é
        # o mais antigo: é o que as outras telas já referenciam.
        "SELECT DISTINCT ON (v.id)",
        "       v.id, v.receita, pr.id, sub.id, v.quantidade,",
        "       coalesce(pr.\"unidadeMedida\", 'KG')",
        "  FROM (VALUES",
        ",\n".join(bloco),
        "  ) AS v(id, receita, chave_produto, chave_sub, quantidade)",
        f"  JOIN \"Unidade\" u ON u.nome = '{sql(CASA)}'",
        "  LEFT JOIN \"Produto\" pr ON v.chave_sub = ''",
        "                        AND pr.ativo",
        f"                        AND {NORM.format(c='pr.nome')} = v.chave_produto",
        f'                        AND upper(btrim(pr."unidadeMedida")) IN {UNIDADES_DE_PESO}',
        "  LEFT JOIN \"Receita\" sub ON v.chave_sub <> ''",
        '                         AND sub."unidadeId" = u.id',
        "                         AND " + NORM.format(c="sub.nome") + " = v.chave_sub",
        " WHERE (pr.id IS NOT NULL OR sub.id IS NOT NULL)",
        '   AND EXISTS (SELECT 1 FROM "Receita" r WHERE r.id = v.receita)',
        " ORDER BY v.id, pr.id, sub.id",
        # CADA PARTE É IDEMPOTENTE SOZINHA.
        #
        # Antes só a parte 1 era: ela tinha o DELETE. Rodar a parte 4 duas
        # vezes — o que acontece quando alguém perde a conta no meio de seis
        # arquivos — estourava na chave primária e derrubava a carga.
        # Protocolo que só funciona se executado na ordem exata, sem repetir
        # nenhum passo, é protocolo que vai falhar.
        'ON CONFLICT ("id") DO UPDATE',
        '   SET "receitaId" = EXCLUDED."receitaId",',
        '       "produtoId" = EXCLUDED."produtoId",',
        '       "subReceitaId" = EXCLUDED."subReceitaId",',
        '       "quantidade" = EXCLUDED."quantidade",',
        '       "unidadeMedida" = EXCLUDED."unidadeMedida";',
        "",
        "COMMIT;",
    ]
    partes.append((f"3{chr(ord('b') + n - 1)}-ingredientes-{n}.sql", "\n".join(corpo)))

# -------------------------------------------------------------- conferência
esperado = ",\n".join(
    f"  ('{rec_id[f['chave']]}', '{sql(f['nome'])}', {len(f['ingredientes'])})" for f in validas
)
conf = "\n".join(
    [
        "-- Fichas do Beira Lago — conferência. SÓ LEITURA, rodar por último.",
        "",
        "-- 1. FICHA INCOMPLETA: entrou com menos ingredientes do que a planilha",
        "--    tem. É a lista que importa — custo baixo e convincente é pior que",
        "--    custo nenhum. A coluna `faltam` é quantos não resolveram.",
        "WITH esperado(id, nome, quantos) AS (VALUES",
        esperado,
        ")",
        "SELECT e.nome, e.quantos AS na_planilha,",
        '       (SELECT count(*) FROM "IngredienteReceita" i WHERE i."receitaId" = e.id) AS gravados,',
        '       e.quantos - (SELECT count(*) FROM "IngredienteReceita" i WHERE i."receitaId" = e.id) AS faltam',
        "  FROM esperado e",
        '  JOIN "Receita" r ON r.id = e.id',
        ' WHERE (SELECT count(*) FROM "IngredienteReceita" i WHERE i."receitaId" = e.id) < e.quantos',
        " ORDER BY faltam DESC, e.nome",
        " LIMIT 80;",
        "",
        "-- 2. O resumo: fichas, ingredientes e quantas ficaram completas.",
        "WITH esperado(id, quantos) AS (VALUES",
        ",\n".join(f"  ('{rec_id[f['chave']]}', {len(f['ingredientes'])})" for f in validas),
        ")",
        "SELECT count(*) AS fichas,",
        '       sum((SELECT count(*) FROM "IngredienteReceita" i WHERE i."receitaId" = e.id)) AS ingredientes_gravados,',
        "       sum(e.quantos) AS ingredientes_na_planilha,",
        '       count(*) FILTER (WHERE (SELECT count(*) FROM "IngredienteReceita" i WHERE i."receitaId" = e.id) = e.quantos) AS fichas_completas',
        "  FROM esperado e",
        '  JOIN "Receita" r ON r.id = e.id;',
    ]
)
partes.append(("3z-conferencia.sql", conf))

for nome, conteudo in partes:
    caminho = f"{SAIDA}/{nome}"
    with open(caminho, "w", encoding="utf-8") as fh:
        fh.write(conteudo.replace("PARTE 1 de N", f"PARTE 1 de {len(partes)}") + "\n")
    print(f"{caminho}  ({len(conteudo) // 1024} KB)", file=sys.stderr)
