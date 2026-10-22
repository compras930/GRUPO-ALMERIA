// Cadastra os produtos do Wine Garden que ficaram sem casar.
//
//   npx tsx prisma/scripts/wine-garden/gerar-cadastro-wg.ts <nao-reconhecidos.csv> <teknisa.csv> [--por=codigo|nome] [saida.sql]
//
// NÃO toca no banco.
//
// DOIS CAMINHOS, E A ESCOLHA NÃO É DE ESTILO. O app casa a linha de compra por
// CÓDIGO antes de tentar o nome. Qual caminho vale depende de um fato do
// banco: se as 679 linhas já gravadas guardaram `codigoBruto`.
//
//   --por=codigo  Um produto por CÓDIGO, com `codigoTeknisa` preenchido. O
//                 nome deixa de importar, e os pares "(COMPRA)" / sem sufixo
//                 — que são o MESMO produto renomeado — colapsam num só.
//
//   --por=nome    Um produto por NOME EXATO, sem código. É o que resta quando
//                 a carga não mandou código: o casamento é por nome+unidade, e
//                 cada grafia precisa do seu próprio produto, duplicatas
//                 inclusive. Pior, mas funciona.
//
// A DIFERENÇA EM NÚMEROS: 288 produtos por nome contra 285 por código, porque
// três códigos atendem dois nomes cada. Três produtos a menos não parece
// muito; o que importa é que, por código, a PRÓXIMA grafia nova do fornecedor
// casa sozinha em vez de virar o 680º não reconhecido.
//
// A UNIDADE passa por `normalizarUnidade` do app, não por uma cópia da regra:
// uma linha em PCT vira CX, e produto cadastrado com "PCT" cru nunca casa.
// A CATEGORIA é o `grupo` do Teknisa, canonizado como as de venda.
import { readFileSync, writeFileSync } from "node:fs";
import { normalizarUnidade } from "../../../src/lib/resolucao-produto-compra";
import { categoriaCanonicaPura } from "../../../src/lib/categoria-venda";

const sql = (s: string) => `'${s.replace(/'/g, "''")}'`;
const nfd = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

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

const args = process.argv.slice(2);
const flag = args.find((a) => a.startsWith("--por="));
const porCodigo = (flag?.split("=")[1] ?? "codigo") === "codigo";
const [faltandoCsv, teknisaCsv] = args.filter((a) => !a.startsWith("--"));
const saida = args.filter((a) => !a.startsWith("--"))[2]
  ?? `prisma/scripts/wine-garden/3-cadastro-${porCodigo ? "por-codigo" : "por-nome"}.sql`;
if (!faltandoCsv || !teknisaCsv) {
  console.error("uso: ... <nao-reconhecidos.csv> <teknisa.csv> [--por=codigo|nome] [saida.sql]");
  process.exit(1);
}

// O Teknisa, indexado por (nome, unidade) como a linha foi gravada.
const tek = new Map<string, Record<string, string>>();
for (const r of lerCsv(readFileSync(teknisaCsv, "utf-8"))) {
  const k = `${nfd(r.nome).replace(/\s+/g, " ").trim()}|||${r.unidade.trim().toUpperCase()}`;
  if (!tek.has(k)) tek.set(k, r);
}

type Novo = {
  nome: string; unidade: string; unidadeBruta: string;
  codigo: string | null; grupo: string; categoria: string; valor: number; linhas: number;
};

const semOrigem: Novo[] = [];
const novos: Novo[] = [];
for (const f of lerCsv(readFileSync(faltandoCsv, "utf-8"))) {
  const nome = f.nome.replace(/\s+/g, " ").trim();
  const k = `${nfd(nome)}|||${f.unidadeMedida.trim().toUpperCase()}`;
  const t = tek.get(k);
  const grupo = t?.grupo?.trim() ?? "";
  const item: Novo = {
    nome,
    unidade: normalizarUnidade(f.unidadeMedida),
    unidadeBruta: f.unidadeMedida.trim().toUpperCase(),
    codigo: t?.codigo?.trim() || null,
    grupo,
    categoria: categoriaCanonicaPura(grupo) ?? "SEM GRUPO",
    valor: Number(f.valor_total || 0),
    linhas: Number(f.linhas || 0),
  };
  (t ? novos : semOrigem).push(item);
}

// Por CÓDIGO, um produto por código: fica o nome que mais vendeu, porque é o
// que o fornecedor usa hoje e o que alguém reconhece na tela.
let finais = novos;
if (porCodigo) {
  const porCod = new Map<string, Novo[]>();
  for (const n of novos) {
    const c = n.codigo!;
    porCod.set(c, [...(porCod.get(c) ?? []), n]);
  }
  finais = [...porCod.values()].map((lista) => {
    const ordenada = [...lista].sort((a, b) => b.valor - a.valor);
    const principal = ordenada[0];
    // O valor do grupo inteiro vai no vencedor: ele representa todas as
    // grafias agora, e o comentário tem que dizer o tamanho real.
    return { ...principal, valor: lista.reduce((s, x) => s + x.valor, 0), linhas: lista.reduce((s, x) => s + x.linhas, 0) };
  });
}

// Duas linhas com a mesma chave de casamento viram dois produtos e um deles
// fica sem preço para sempre, calado. Se aparecer, é decisão humana.
const chave = (n: Novo) => `${n.nome.toLowerCase()}|||${n.unidade}`;
const porChave = new Map<string, Novo[]>();
for (const n of finais) porChave.set(chave(n), [...(porChave.get(chave(n)) ?? []), n]);
const colisoes = [...porChave.values()].filter((v) => v.length > 1);
if (colisoes.length) {
  console.error(`${colisoes.length} colisão(ões) de nome+unidade — resolva antes:`);
  for (const c of colisoes) console.error("  " + c.map((x) => `${x.nome} [${x.unidade}]`).join(" / "));
  process.exit(1);
}

const brl = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const categorias = [...new Set(finais.map((n) => n.categoria))].sort(
  (a, b) =>
    finais.filter((n) => n.categoria === b).reduce((s, n) => s + n.valor, 0) -
    finais.filter((n) => n.categoria === a).reduce((s, n) => s + n.valor, 0)
);

const linhasSql: string[] = [];
categorias.forEach((cat) => {
  const doGrupo = finais.filter((n) => n.categoria === cat).sort((a, b) => b.valor - a.valor);
  linhasSql.push(`  -- ${cat}: ${doGrupo.length} produtos, R$ ${brl(doGrupo.reduce((s, n) => s + n.valor, 0))}`);
  for (const n of doGrupo) {
    const cod = porCodigo && n.codigo ? sql(n.codigo) : "NULL";
    const nota = n.unidadeBruta !== n.unidade ? ` · nota em ${n.unidadeBruta}` : "";
    linhasSql.push(
      `  (${sql(n.nome)}, ${sql(n.unidade)}, ${sql(n.categoria)}, ${cod})` +
        `@@-- R$ ${brl(n.valor)}${nota}`
    );
  }
});
// A vírgula ANTES do comentário. Dentro dele vira texto, e o INSERT quebra.
const corpo = linhasSql.map((l, i) => {
  if (!l.includes("@@")) return l;
  const ultimo = linhasSql.slice(i + 1).every((x) => !x.includes("@@"));
  const [a, b] = l.split("@@");
  return a + (ultimo ? "" : ",") + "  " + b;
});

const total = finais.reduce((s, n) => s + n.valor, 0);
writeFileSync(
  saida,
  `-- Cadastro dos produtos do Wine Garden que não casaram.
-- GERADO por prisma/scripts/wine-garden/gerar-cadastro-wg.ts --por=${porCodigo ? "codigo" : "nome"}.
--
-- ${finais.length} produtos, R$ ${brl(total)} de compra.
${semOrigem.length ? `--
-- ${semOrigem.length} produtos ficaram de FORA (R$ ${brl(semOrigem.reduce((s, n) => s + n.valor, 0))}): o nome
-- está no banco mas não no export do Teknisa do período, então não há código
-- nem grupo para eles. Quase todos são compra anterior a 01/08. Ficam para uma
-- segunda rodada com o export mais largo:
${semOrigem.sort((a, b) => b.valor - a.valor).map((n) => `--   R$ ${brl(n.valor).padStart(10)}  ${n.nome} [${n.unidadeBruta}]`).join("\n")}
` : ""}--
-- ${porCodigo
    ? `CASA POR CÓDIGO. Cada produto nasce com \`codigoTeknisa\`, e o nome deixa de
-- importar para o casamento. Os pares "(COMPRA)" / sem sufixo — que são o MESMO
-- produto renomeado pelo fornecedor — colapsaram num produto só, com o nome que
-- mais vendeu.`
    : `CASA POR NOME. A carga não gravou código, então o casamento é por
-- nome+unidade e cada grafia precisa do seu produto — duplicatas inclusive.
-- Funciona, mas a próxima grafia nova do fornecedor volta como não reconhecida.`}
--
-- A UNIDADE foi normalizada pelo app (PCT vira CX, e por aí). O comentário
-- avisa quando a nota veio com outra unidade que a cadastrada.
--
-- A CATEGORIA é o grupo do Teknisa. Repare que nem todo grupo é insumo de
-- prato: DESCARTAVEIS, LIMPEZA, UTILIDADE PUBLICA, ATIVO IMOBILIZADO,
-- EMBALAGENS e INATIVOS são dinheiro real que NÃO vira ficha nem contagem
-- semanal. Comente o bloco que não quiser cadastrar agora.
--
-- Por categoria:
${categorias
  .map((c) => {
    const l = finais.filter((n) => n.categoria === c);
    return `--   ${c.padEnd(30)} ${String(l.length).padStart(3)}  R$ ${brl(l.reduce((s, n) => s + n.valor, 0)).padStart(12)}`;
  })
  .join("\n")}

BEGIN;

INSERT INTO "Produto" (id, nome, "unidadeMedida", categoria, "codigoTeknisa", ativo, "criadoEm")
SELECT gen_random_uuid()::text, v.nome, v.unidade, v.categoria, v.codigo, true, now()
FROM (VALUES
${corpo.join("\n")}
) AS v(nome, unidade, categoria, codigo)
-- Não duplica: nem por nome+unidade (o índice que já existe ignora caixa) nem
-- por código. Rodar duas vezes não cria nada.
WHERE NOT EXISTS (
    SELECT 1 FROM "Produto" p
    WHERE lower(btrim(p.nome)) = lower(btrim(v.nome)) AND p."unidadeMedida" = v.unidade
  )
  AND (v.codigo IS NULL OR NOT EXISTS (
    SELECT 1 FROM "Produto" p WHERE p."codigoTeknisa" = v.codigo
  ));

COMMIT;

-- CONFERÊNCIA: ${finais.length} produtos novos, por categoria.
SELECT p.categoria, count(*) AS produtos, count(p."codigoTeknisa") AS com_codigo
FROM "Produto" p
WHERE lower(btrim(p.nome)) IN (${finais.map((n) => sql(n.nome.toLowerCase())).join(", ")})
GROUP BY p.categoria
ORDER BY produtos DESC;
`
);

console.log(`${finais.length} produtos (${porCodigo ? "por código" : "por nome"}) · R$ ${brl(total)} -> ${saida}`);
if (semOrigem.length) console.log(`  ${semOrigem.length} fora, sem código no export (R$ ${brl(semOrigem.reduce((s, n) => s + n.valor, 0))})`);
for (const c of categorias) {
  const l = finais.filter((n) => n.categoria === c);
  console.log(`  ${c.padEnd(30)} ${String(l.length).padStart(3)}  R$ ${brl(l.reduce((s, n) => s + n.valor, 0)).padStart(12)}`);
}
