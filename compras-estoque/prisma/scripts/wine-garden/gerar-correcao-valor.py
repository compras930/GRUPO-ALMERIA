"""Gera o UPDATE que corrige o valor da venda de outubro do Wine Garden.

POR QUE UM GERADOR, e não SQL escrito à mão: são 306 pares código/valor. Lista
digitada é lista com um dígito trocado que ninguém acha — e aqui um dígito
trocado vira faturamento errado numa casa inteira.

O QUE ACONTECEU. A carga de 04/11 19:09 entrou com o valor CHEIO (Faturamento,
antes do desconto): R$ 663.889,27. O certo é o líquido sem acréscimo —
R$ 661.351,59 —, que é o que o painel e o financeiro usam.

POR QUE CORRIGIR E NÃO REENVIAR. A carga baixou estoque (90 movimentos) e
abriu o pedido de compra nº 9. Nada disso depende do VALOR: baixa de estoque
sai da quantidade e da ficha. Apagar a venda deixaria o estoque baixado sem a
venda que o justifica, e exigiria desfazer saldo a saldo. A única coisa errada
é o dinheiro, então só o dinheiro muda.

Uso:
    python3 -I prisma/scripts/wine-garden/gerar-correcao-valor.py \\
        <csv com codigo,valor_liquido> prisma/scripts/wine-garden/8-corrigir-valor-outubro.sql
"""

import csv
import sys

ESPERADO = 661351.59
CABECALHO = '''-- Corrige o valor da venda de outubro do Wine Garden.
-- GERADO por prisma/scripts/wine-garden/gerar-correcao-valor.py — não edite à mão.
--
-- A carga de 04/11 19:09 (id cmw2hqym30078jqwxwgcuii03) entrou com o valor
-- CHEIO, antes do desconto: R$ 663.889,27 em 306 itens. O certo é o líquido
-- sem acréscimo, R$ 661.351,59 — o mesmo número do painel e do financeiro.
-- Diferença: R$ 2.537,68.
--
-- SÓ O VALOR MUDA. Quantidade, casamento de item, baixa de estoque e o pedido
-- em rascunho estão certos e não dependem do dinheiro: a baixa sai da
-- quantidade e da ficha. Por isso não apagamos e reenviamos — apagar deixaria
-- o estoque baixado sem a venda que o justifica.
--
-- CASA PELO CÓDIGO gravado em cada linha (`codigoBruto`), não pelo nome. Os
-- 306 códigos do arquivo são únicos e são os mesmos que entraram.
--
-- Rode os três passos na ordem. O 1 e o 3 só leem.
'''


def main(csv_path, saida):
    linhas = [x for x in csv.DictReader(open(csv_path, encoding="utf-8")) if x.get("codigo")]
    pares = [(x["codigo"].strip(), float(x["valor_liquido"])) for x in linhas]

    codigos = {c for c, _ in pares}
    if len(codigos) != len(pares):
        raise SystemExit(f"código repetido no arquivo: {len(pares)} linhas, {len(codigos)} códigos")
    soma = round(sum(v for _, v in pares), 2)
    if abs(soma - ESPERADO) > 0.005:
        raise SystemExit(f"a soma deu {soma:,.2f} e o esperado é {ESPERADO:,.2f} — não gerei nada")

    valores = ",\n  ".join(f"('{c}', {v:.2f})" for c, v in pares)

    sql = f"""{CABECALHO}
-- =====================================================================
-- PASSO 1 — ANTES. Esperado: 306 itens, R$ 663.889,27.
-- =====================================================================
SELECT 'antes' AS quando, count(*) AS itens,
       round(sum(ivs."valorVendido")::numeric, 2) AS soma
FROM "ItemVendaSemanal" ivs
JOIN "VendaSemanal" vs ON vs.id = ivs."vendaSemanalId"
JOIN "Unidade" u ON u.id = vs."unidadeId"
WHERE u.nome = 'Wine Garden'
  AND vs."periodoInicio" < DATE '2026-11-01'
  AND vs."periodoFim" >= DATE '2026-10-01';

-- =====================================================================
-- PASSO 2 — O CONSERTO. Um comando só. Esperado: UPDATE {len(pares)}.
--
-- Se vier menos de {len(pares)}, PARE: algum código do arquivo não existe na
-- carga, e aí o recorte não é o mesmo. Não rode de novo — me avise.
--
-- Rodar duas vezes não faz mal: grava o mesmo valor.
-- =====================================================================
UPDATE "ItemVendaSemanal" ivs
   SET "valorVendido" = v.valor
  FROM (VALUES
  {valores}
) AS v(codigo, valor),
       "VendaSemanal" vs,
       "Unidade" u
 WHERE vs.id = ivs."vendaSemanalId"
   AND u.id = vs."unidadeId"
   AND u.nome = 'Wine Garden'
   AND vs."periodoInicio" < DATE '2026-11-01'
   AND vs."periodoFim" >= DATE '2026-10-01'
   AND btrim(COALESCE(ivs."codigoBruto", '')) = v.codigo;

-- =====================================================================
-- PASSO 3 — DEPOIS. Esperado: 306 itens, R$ 661.351,59, nenhum sem valor.
-- =====================================================================
SELECT 'depois' AS quando, count(*) AS itens,
       round(sum(ivs."valorVendido")::numeric, 2) AS soma,
       count(*) FILTER (WHERE ivs."valorVendido" IS NULL) AS sem_valor
FROM "ItemVendaSemanal" ivs
JOIN "VendaSemanal" vs ON vs.id = ivs."vendaSemanalId"
JOIN "Unidade" u ON u.id = vs."unidadeId"
WHERE u.nome = 'Wine Garden'
  AND vs."periodoInicio" < DATE '2026-11-01'
  AND vs."periodoFim" >= DATE '2026-10-01';
"""
    open(saida, "w", encoding="utf-8").write(sql)
    print(f"{len(pares)} códigos, soma {soma:,.2f} -> {saida}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
