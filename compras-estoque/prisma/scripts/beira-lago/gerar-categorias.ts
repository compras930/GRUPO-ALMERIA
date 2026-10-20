// Gera o SQL que preenche Produto.categoria para TODOS os produtos do export
// do XMenu, não só os 393 que a carga cadastrou.
//
//   npx tsx prisma/scripts/beira-lago/gerar-categorias.ts <csv-do-export> [saida.sql]
//
// POR QUE ISTO É NECESSÁRIO PRO PAINEL. O painel de compras por categoria lê
// Produto.categoria. Os 393 nasceram com o grupo do XMenu; os outros ~170 do
// Beira Lago são produtos antigos, de antes da integração, e estão sem
// categoria — eles cairiam todos na linha "Sem categoria" e o painel diria
// pouco. A informação existe: é a coluna `grupo` do próprio export.
//
// Só preenche quem está VAZIO. Produto que já tem categoria fica como está —
// as outras três casas usam o mesmo catálogo, e o grupo do XMenu não manda nelas.
import { readFileSync, writeFileSync } from "node:fs";
import { normalizarUnidade } from "@/lib/resolucao-produto-compra";

const normalizarNome = (s: string) => s.trim().replace(/\s+/g, " ");
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

const [, , caminho, saida = "prisma/scripts/beira-lago/7-categorias.sql"] = process.argv;
if (!caminho) { console.error("uso: npx tsx prisma/scripts/beira-lago/gerar-categorias.ts <csv> [saida.sql]"); process.exit(1); }

// (nome|||unidade) -> grupo. Um produto com dois grupos diferentes no export
// seria ambíguo; o último vence e isso é reportado.
const porProduto = new Map<string, { nome: string; unidade: string; grupo: string; grupos: Set<string> }>();
for (const r of lerCsv(readFileSync(caminho, "utf-8"))) {
  const nome = normalizarNome(r.nome);
  const unidade = normalizarUnidade(r.unidade);
  const chave = `${nome.toLowerCase()}|||${unidade}`;
  const atual = porProduto.get(chave);
  if (atual) { atual.grupos.add(r.grupo.trim()); atual.grupo = r.grupo.trim(); }
  else porProduto.set(chave, { nome, unidade, grupo: r.grupo.trim(), grupos: new Set([r.grupo.trim()]) });
}
const todos = [...porProduto.values()];
const ambiguos = todos.filter((p) => p.grupos.size > 1);

const linhas = todos
  .sort((a, b) => a.grupo.localeCompare(b.grupo) || a.nome.localeCompare(b.nome))
  .map((p) => `  (${sql(p.nome)}, ${sql(p.unidade)}, ${sql(p.grupo)})`);

writeFileSync(saida, `-- Preenche Produto.categoria com o grupo do XMenu.
-- GERADO por prisma/scripts/beira-lago/gerar-categorias.ts.
--
-- ${todos.length} produtos do export. Só escreve onde a categoria está VAZIA:
-- produto que já tem categoria fica como está, porque as outras três casas
-- usam o mesmo catálogo e o grupo do XMenu não manda nelas.
--
-- Casa por nome + unidade, ignorando caixa e espaço sobrando — a mesma regra
-- do casamento de compra (src/lib/nome-normalizado.ts). A unidade vai
-- normalizada (PCT já é CX), como no cadastro.
${ambiguos.length ? `--\n-- ATENÇÃO: ${ambiguos.length} produto(s) aparecem com mais de um grupo no export;\n-- para esses vale o último. Confira depois:\n${ambiguos.map((a) => `--   ${a.nome} (${a.unidade}): ${[...a.grupos].join(" / ")}`).join("\n")}` : "-- Nenhum produto aparece com dois grupos diferentes no export."}

BEGIN;

UPDATE "Produto" p
   SET categoria = v.grupo
  FROM (VALUES
${linhas.join(",\n")}
  ) AS v(nome, unidade, grupo)
 WHERE lower(regexp_replace(btrim(p.nome), '\\s+', ' ', 'g')) = lower(v.nome)
   AND p."unidadeMedida" = v.unidade
   AND (p.categoria IS NULL OR btrim(p.categoria) = '');

COMMIT;

-- CONFERÊNCIA: quanto do gasto do Beira Lago ainda fica sem categoria.
-- O painel mostra isso como "Sem categoria"; aqui dá pra ver antes.
SELECT COALESCE(NULLIF(btrim(pr.categoria), ''), 'SEM CATEGORIA') AS categoria,
       count(DISTINCT pr.id) AS produtos,
       round(sum(COALESCE(i."valorTotal", 0))::numeric, 2) AS comprado
FROM "ItemNotaCompra" i
JOIN "NotaCompra" n ON n.id = i."notaCompraId"
JOIN "Unidade" u ON u.id = n."unidadeId"
LEFT JOIN "Produto" pr ON pr.id = i."produtoId"
WHERE u.nome = 'Beira Lago'
GROUP BY 1
ORDER BY comprado DESC;
`);

console.log(`${todos.length} produtos -> ${saida}`);
if (ambiguos.length) {
  console.log(`  ${ambiguos.length} com mais de um grupo no export:`);
  for (const a of ambiguos) console.log(`    ${a.nome} (${a.unidade}): ${[...a.grupos].join(" / ")}`);
}
