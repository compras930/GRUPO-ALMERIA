// Gera o SQL que preenche `valorVendido` nas semanas que entraram antes de o
// campo existir, a partir do export de vendas do XMenu.
//
//   npx tsx prisma/scripts/beira-lago/gerar-valor-vendido.ts <csv> [prefixo-saida]
//
// O script NÃO toca no banco.
//
// POR QUE UPDATE E NÃO REENVIO. A venda não tem chave por linha: a identidade
// é o período, e reenviar a semana devolve 409. Para reenviar seria preciso
// apagar a VendaSemanal — e com ela iriam a baixa de estoque e o pedido que
// aquela carga gerou. Corrigir o valor no lugar não mexe em nada disso.
//
// A CORRESPONDÊNCIA É PELO CÓDIGO, dentro da semana. Nome não serve aqui pelo
// mesmo motivo de sempre, e o código é o que as duas pontas têm: a linha
// gravada guarda `codigoBruto`, o export traz `codigo`.
//
// UM ARQUIVO POR SEMANA, de propósito. O console do Neon trunca consulta
// grande — e trunca calado, respondendo "executed successfully" com metade
// dos dados de fora. Já aconteceu com o cadastro de produtos. Cada semana sai
// em ~12 KB, bem abaixo do limite.
import { readFileSync, writeFileSync } from "node:fs";

const sql = (s: string) => `'${s.replace(/'/g, "''")}'`;

function lerCsv(texto: string): Record<string, string>[] {
  const linhas: string[][] = []; let campo = ""; let atual: string[] = []; let asp = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (asp) { if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else asp = false; } else campo += c; }
    else if (c === '"') asp = true;
    else if (c === ",") { atual.push(campo); campo = ""; }
    else if (c === "\n") { atual.push(campo); linhas.push(atual); atual = []; campo = ""; }
    else if (c !== "\r") campo += c;
  }
  if (campo || atual.length) { atual.push(campo); linhas.push(atual); }
  const [cab, ...r] = linhas;
  return r.filter((l) => l.some((c) => c !== "")).map((l) => Object.fromEntries(cab.map((h, i) => [h.trim(), l[i] ?? ""])));
}

/** As semanas como foram carregadas no app. */
const SEMANAS: [string, string][] = [
  ["2026-10-01", "2026-10-05"],
  ["2026-10-06", "2026-10-12"],
  ["2026-10-13", "2026-10-19"],
  ["2026-10-20", "2026-10-20"],
];

const [, , caminhoCsv, prefixo = "prisma/scripts/beira-lago/12-valor-vendido"] = process.argv;
if (!caminhoCsv) {
  console.error("uso: npx tsx prisma/scripts/beira-lago/gerar-valor-vendido.ts <csv> [prefixo-saida]");
  process.exit(1);
}

const linhas = lerCsv(readFileSync(caminhoCsv, "utf-8"));
const brl = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

SEMANAS.forEach(([de, ate], n) => {
  // Inclui tudo que o export traz, "TESTE IMPRESSORAS " (R$ 0,01) junto: a
  // linha existe no app, e deixá-la de fora não a apagaria — deixaria
  // `valorVendido` nulo nela, fazendo a semana cair de volta na estimativa por
  // um centavo e a conferência acusar sem_valor = 1. Esse centavo é, aliás,
  // toda a diferença entre o total daqui e o do painel nas semanas 1 e 3.
  const daSemana = linhas.filter((l) => l.data >= de && l.data <= ate);
  const porCodigo = new Map<string, number>();
  for (const l of daSemana) {
    const c = l.codigo.trim();
    porCodigo.set(c, (porCodigo.get(c) ?? 0) + Number(l.valor_total_vendido));
  }
  const total = [...porCodigo.values()].reduce((s, v) => s + v, 0);
  const valores = [...porCodigo]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([codigo, valor], i, arr) => `  (${sql(codigo)}, ${valor.toFixed(2)})` + (i < arr.length - 1 ? "," : ""));

  const arquivo = `${prefixo}-${String(n + 1).padStart(2, "0")}-${de.slice(5).replace("-", "")}.sql`;
  writeFileSync(arquivo, `-- Preenche \`valorVendido\` na semana de ${de} a ${ate}.
-- GERADO por prisma/scripts/beira-lago/gerar-valor-vendido.ts.
--
-- ${porCodigo.size} itens · R$ ${brl(total)} no XMenu.
--
-- Essa semana entrou antes de a rota aceitar \`valorTotal\`, então o
-- faturamento dela está sendo ESTIMADO por quantidade × preço cadastrado — e
-- estimar erra sempre no mesmo sentido, porque cardápio sobe e cadastro fica
-- parado. No mês inteiro a diferença é de R$ 11.192 (0,88%), toda para baixo,
-- o que INFLA todo CMV: o faturamento é o denominador.
--
-- Casa pelo CÓDIGO dentro da semana — a linha gravada guarda \`codigoBruto\` e
-- o export traz \`codigo\`. Nome não serve, pelo motivo de sempre.
--
-- Só escreve onde \`valorVendido\` está NULO: rodar duas vezes não muda nada, e
-- linha que já veio com valor declarado pela origem não é sobrescrita por
-- este arquivo, que é mais velho que ela.

BEGIN;

UPDATE "ItemVendaSemanal" i
   SET "valorVendido" = v.valor
  FROM (VALUES
${valores.join("\n")}
  ) AS v(codigo, valor)
 WHERE i."codigoBruto" = v.codigo
   AND i."valorVendido" IS NULL
   AND i."vendaSemanalId" = (
     SELECT vs.id FROM "VendaSemanal" vs
     JOIN "Unidade" u ON u.id = vs."unidadeId"
     WHERE u.nome = 'Beira Lago'
       AND vs."periodoInicio" = DATE '${de}'
       AND vs."periodoFim" = DATE '${ate}'
   );

COMMIT;

-- CONFERÊNCIA: faturamento da semana. Tem que dar R$ ${brl(total)} — ou um
-- pouquinho menos, se algum código existir no export e não no app (é o caso
-- conhecido da semana de 13 a 19: a linha "TESTE IMPRESSORAS " de 15/10 só
-- está no export, então essa semana fecha em R$ 403.360,63, um centavo
-- abaixo). Diferença maior que centavos não é isso: me diga quanto deu.
--
-- "sem_valor" tem que ser 0. Se sobrar, é linha que o app tem e o export não
-- — me diga qual.
SELECT count(*) AS linhas,
       count(*) FILTER (WHERE i."valorVendido" IS NULL) AS sem_valor,
       round(sum(COALESCE(i."valorVendido", i."quantidadeVendida" * COALESCE(iv."precoVenda", 0)))::numeric, 2) AS faturamento
FROM "ItemVendaSemanal" i
JOIN "VendaSemanal" vs ON vs.id = i."vendaSemanalId"
JOIN "Unidade" u ON u.id = vs."unidadeId"
LEFT JOIN "ItemVenda" iv ON iv.id = i."itemVendaId"
WHERE u.nome = 'Beira Lago'
  AND vs."periodoInicio" = DATE '${de}'
  AND vs."periodoFim" = DATE '${ate}';
`);
  const kb = (Buffer.byteLength(readFileSync(arquivo)) / 1024).toFixed(1);
  console.log(`${de} a ${ate}: ${String(porCodigo.size).padStart(3)} itens · R$ ${brl(total).padStart(12)} -> ${arquivo} (${kb} KB)`);
});
