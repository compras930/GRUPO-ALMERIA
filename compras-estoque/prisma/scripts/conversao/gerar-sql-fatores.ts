// Gera o SQL que grava os fatores de conversão, a partir da planilha
// respondida pelo setor de compras.
//
//   npx tsx prisma/scripts/conversao/gerar-sql-fatores.ts <fatores.xlsx> [saida.sql]
//
// AS CORREÇÕES ABAIXO NÃO SÃO PALPITE. Depois de preenchida, cada fator foi
// conferido contra o preço: converte o valor da nota e compara com o preço já
// cadastrado. Seis não fechavam — cinco produziriam preço 10x menor (salsa a
// R$ 2,50 o quilo em vez de R$ 26,80) e um produziria 6x maior. A razão entre
// os dois preços é o que falta: 0,09 é o maço de salsa, 25 são os pães de
// queijo por quilo. Confirmadas pelo setor de compras antes de entrar aqui.
import { readFileSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";

const CORRIGIDO: Record<string, { fator: number; obs: string }> = {
  "PÃO DE QUEIJO": { fator: 25, obs: "25 unidades por quilo — deduzido da razão de preço e confirmado" },
  SALSA: { fator: 0.09, obs: "maço de ~90 g — deduzido da razão de preço e confirmado" },
  CEBOLETE: { fator: 0.09, obs: "maço de ~90 g — deduzido da razão de preço e confirmado" },
  ALECRIM: { fator: 0.07, obs: "maço de ~70 g — deduzido da razão de preço e confirmado" },
  "Hortelã": { fator: 0.11, obs: "maço de ~110 g — deduzido da razão de preço e confirmado" },
  "AZEITE EXTRA VIRGEM": { fator: 3, obs: "garrafa de 3 litros; cadastro passa a ser LT" },
};

const sql = (s: unknown) => `'${String(s).replace(/'/g, "''")}'`;

function main() {
  const [arq, saida = "prisma/scripts/conversao/aplicar-fatores.sql"] = process.argv.slice(2);
  const wb = XLSX.readFile(arq);
  const linhas = XLSX.utils
    .sheet_to_json<Record<string, any>>(wb.Sheets[wb.SheetNames[0]], { defval: "" })
    .map((x) => {
      const c = CORRIGIDO[x.produto];
      return {
        produto: String(x.produto),
        un: String(x.unidade_na_compra),
        fator: c ? c.fator : Number(x.fator_confirmado),
        obs: c ? c.obs : String(x.observacao || "").trim(),
      };
    })
    .filter((l) => l.fator > 0);

  const vals = linhas
    .map((l) => `  (${[sql(l.produto), sql(l.un), l.fator, l.obs ? sql(l.obs) : "NULL"].join(", ")})`)
    .join(",\n");

  const texto = [
    "-- Fatores de conversão entre embalagem de compra e unidade do produto.",
    "-- Respondidos pelo setor de compras em 18/09/2026 e conferidos contra o preço.",
    "--",
    "-- SEIS RESPOSTAS FORAM CORRIGIDAS NA CONFERÊNCIA. Cinco vinham com fator 1 e",
    "-- produziriam preço 10x menor — salsa a R$ 2,50 o quilo em vez de R$ 26,80, o",
    "-- que deixaria toda ficha com salsa barata demais. A razão entre o preço da",
    "-- nota e o preço cadastrado reconstrói o que faltava: 0,09 é o maço de salsa,",
    "-- 25 são os pães de queijo por quilo. Não é adivinhação — é a única leitura em",
    "-- que os dois números fecham.",
    "--",
    "-- O AZEITE mudou de unidade. A própria observação dizia que a medida devia ser",
    "-- em litro, e com fator 1 em KG entraria R$ 135,26 o quilo, que é o preço da",
    "-- garrafa de 3 litros.",
    "--",
    "-- O IOGURTE é o caso invertido: o fator 0,17 está certo (pote de 170 g) e o",
    "-- preço cadastrado de R$ 3,60 o quilo é que é impossível. Corrigido no passo 3,",
    "-- porque a trava de salto recusaria a correção justamente por ser grande.",
    "--",
    "-- Idempotente. Rode os três passos juntos.",
    "",
    "-- ---------------------------------------------------------------------------",
    "-- 1) Azeite passa a LT, pra que o fator 3 signifique 3 litros.",
    "--",
    "-- As fichas que usam azeite tinham a quantidade em KG e passam a lê-la em LT.",
    "-- Com densidade 0,91 o custo dessas linhas cai ~9% — e fica mais certo do que",
    "-- estava, porque o que entrava antes era o preço da garrafa inteira.",
    "-- ---------------------------------------------------------------------------",
    "UPDATE \"Produto\" SET \"unidadeMedida\" = 'LT'",
    "WHERE nome = 'AZEITE EXTRA VIRGEM' AND \"unidadeMedida\" = 'KG'",
    "  AND NOT EXISTS (SELECT 1 FROM \"Produto\" x WHERE x.nome = 'AZEITE EXTRA VIRGEM' AND x.\"unidadeMedida\" = 'LT');",
    "",
    "-- ---------------------------------------------------------------------------",
    `-- 2) Os ${linhas.length} fatores.`,
    "-- ---------------------------------------------------------------------------",
    'INSERT INTO "ConversaoUnidadeCompra" (id, "produtoId", "unidadeCompra", fator, observacao)',
    "SELECT 'cnv' || left(md5(p.id || v.un), 22), p.id, v.un, v.fator, v.obs",
    "FROM (VALUES",
    vals,
    ") AS v(produto, un, fator, obs)",
    'JOIN "Produto" p ON p.nome = v.produto',
    'ON CONFLICT ("produtoId", "unidadeCompra") DO UPDATE',
    "  SET fator = EXCLUDED.fator, observacao = EXCLUDED.observacao;",
    "",
    "-- ---------------------------------------------------------------------------",
    "-- 3) Iogurte: R$ 3,90 o pote de 170 g = R$ 22,94 o quilo.",
    "-- ---------------------------------------------------------------------------",
    'UPDATE "PrecoAtualProduto" pa SET preco = 22.94, "dataCompra" = now()',
    'FROM "Produto" p WHERE p.id = pa."produtoId" AND p.nome = \'IOGURTE NATURAL\';',
    "",
    "-- ---------------------------------------------------------------------------",
    `-- VERIFICAÇÃO. Esperado: ${linhas.length} conversões, azeite em LT.`,
    "-- ---------------------------------------------------------------------------",
    'SELECT count(*) AS conversoes FROM "ConversaoUnidadeCompra";',
    "",
    'SELECT p.nome, p."unidadeMedida" AS un_produto, c."unidadeCompra" AS un_compra, c.fator',
    'FROM "ConversaoUnidadeCompra" c JOIN "Produto" p ON p.id = c."produtoId"',
    "ORDER BY p.nome;",
    "",
  ].join("\n");

  writeFileSync(saida, texto);
  console.log(`${linhas.length} fatores -> ${saida}`);
  for (const l of linhas.filter((x) => CORRIGIDO[x.produto])) {
    console.log(`  corrigido na conferência: ${l.produto.padEnd(22)} fator ${l.fator}`);
  }
}

main();
