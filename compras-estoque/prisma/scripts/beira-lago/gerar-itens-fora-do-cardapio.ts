// Cadastra os itens de venda que saíram do cardápio antes de outubro.
//
//   npx tsx prisma/scripts/beira-lago/gerar-itens-fora-do-cardapio.ts <csv> [saida.sql]
//
// NÃO toca no banco: escreve um .sql para ser lido antes de rodar.
//
// POR QUE ELES EXISTEM. Agosto e setembro foram carregados depois de outubro,
// e o catálogo de itens de venda foi montado a partir do cardápio de OUTUBRO.
// Tudo que saiu de linha antes disso — 92 vinhos e 19 pratos e drinks — não
// tem onde casar. São R$ 117.782, 29% do que esses dois meses venderam.
//
// ENTRAM INATIVOS. `ativo = false` tira do seletor de perdas, da lista de
// fichas a escrever e de qualquer tela que ofereça escolher um item hoje —
// ninguém vai lançar perda de um prato que não existe mais. Mas a venda
// PASSADA casa do mesmo jeito, porque o casamento procura por código e não
// filtra por ativo. É exatamente o que se quer: o histórico fecha e o presente
// não fica poluído.
//
// O PREÇO SAI DA PRÓPRIA VENDA: valor ÷ quantidade. Não é chute nem tabela
// velha — é o que o cliente pagou de fato naqueles dois meses.
//
// A CATEGORIA É UM PALPITE MEU, e por isso este arquivo existe em vez de um
// INSERT direto. Ela vem do nome, por regra, e o nome nem sempre diz a cor do
// vinho. O SQL gerado traz a classificação linha a linha para conferência.
import { readFileSync, writeFileSync } from "node:fs";
import { categoriaCanonicaPura } from "../../../src/lib/categoria-venda";

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

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

/**
 * Tipo e categoria a partir do nome.
 *
 * A ORDEM DAS REGRAS É O ALGORITMO. "TAÇA CHANDON" é taça, não espumante;
 * "DOSE WHISKY" é dose, não whisky engarrafado. O rótulo de SERVIÇO vence o de
 * produto porque é ele que diz o que o cliente levou — e o que sai do estoque:
 * uma taça tira um quinto da garrafa, a garrafa tira a garrafa inteira.
 */
function classificar(nome: string): { tipo: "PRATO" | "BEBIDA" | "VINHO"; categoria: string } {
  const n = semAcento(nome);

  // 1. Serviço antes de produto.
  if (/^TACA /.test(n)) return { tipo: "VINHO", categoria: "TAÇA" };
  if (/^DOSE /.test(n)) return { tipo: "BEBIDA", categoria: "ALCOÓLICAS" };
  if (/^TAXA /.test(n)) return { tipo: "PRATO", categoria: "TAXAS" };

  // 2. Espumante e champanhe, pelo produtor — o nome raramente diz "espumante".
  if (/CHANDON|VEUVE CLICQUOT|RUINART|CAVA |PIPER HEIDSIECK|DEUTZ|PROSECCO|CHAMPAGNE|ESPUMANTE/.test(n)) {
    return { tipo: "VINHO", categoria: "ESPUMANTE" };
  }
  if (/ ROSE|ROSE |WHISPERING ANGEL|CALAFURIA/.test(n)) return { tipo: "VINHO", categoria: "ROSÉ" };

  // 3. Branco: casta, denominação ou a palavra. É mais confiável listar as
  //    castas brancas do que tentar adivinhar tinto — tinto é o que sobra.
  if (/BRANCO|BLANC|VIURA|ALBARINO|SAUVIGNON|FURMINT|AVESSO|ENCRUZADO|VERNACCIA|MUSCADET|POUILLY|GARNATXA BLANCA|CHARDONNAY|ALVARINHO|RIESLING|VERDEJO|FINO|AMONTILLADO|JEREZ BCO/.test(n)) {
    return { tipo: "VINHO", categoria: "BRANCOS" };
  }
  if (/PORTO |TAWNY|LATE HARVEST|SANDEMAN/.test(n)) {
    return { tipo: "VINHO", categoria: "SOBREMESA E FORTIFICADOS" };
  }

  // 4. Comida e sobremesa, por nome de prato.
  if (/TORTELLINI|FETTUCCINE|CALDEIRADA|RAVIOLI|FALAFEL|ANTEPASTO|PROTEINA ADICIONAL/.test(n)) {
    return { tipo: "PRATO", categoria: "PRINCIPAIS" };
  }
  if (/BOLO |TORTA |SOBREMESA|PISTACHE M/.test(n)) return { tipo: "PRATO", categoria: "SOBREMESAS" };

  // 5. Drink de coqueteleira: nome curto, sem país.
  if (/OLD FASHIONED|BOULEVARDIER|NEGRONI|ROSITA|MAGNO|VERMUTE TONICA|SBAGLIATO/.test(n)) {
    return { tipo: "BEBIDA", categoria: "ALCOÓLICAS" };
  }

  // 6. O resto é vinho tinto. É a aposta mais segura do conjunto: 70% da
  //    adega é tinto, e o erro aqui é de rótulo no painel, não de dinheiro —
  //    o faturamento fecha igual.
  return { tipo: "VINHO", categoria: "TINTOS" };
}

const [, , caminhoCsv, saida = "prisma/scripts/beira-lago/28-itens-fora-do-cardapio.sql"] = process.argv;
if (!caminhoCsv) {
  console.error("uso: npx tsx prisma/scripts/beira-lago/gerar-itens-fora-do-cardapio.ts <csv> [saida.sql]");
  process.exit(1);
}

type Item = {
  codigo: string; nome: string; preco: number; valor: number;
  tipo: string; categoria: string;
};

const itens: Item[] = lerCsv(readFileSync(caminhoCsv, "utf-8")).map((r) => {
  const nome = r.nome.trim().replace(/\s+/g, " ");
  const qtd = Number(r.qtd_agosto || 0) + Number(r.qtd_setembro || 0);
  const valor = Number(r.valor_total || 0);
  const c = classificar(nome);
  return {
    codigo: r.codigo.trim(),
    nome,
    // Preço médio dos dois meses. Quantidade zero não deveria acontecer (o
    // item veio da venda), mas se acontecer o preço sai zero em vez de NaN —
    // e NaN no banco é um erro que só aparece semanas depois.
    preco: qtd > 0 ? Number((valor / qtd).toFixed(2)) : 0,
    valor,
    tipo: c.tipo,
    categoria: categoriaCanonicaPura(c.categoria) ?? c.categoria,
  };
});

// Duas linhas com o mesmo (tipo, categoria, nome) quebram o unique do banco.
const porChave = new Map<string, Item[]>();
for (const i of itens) {
  const k = `${i.tipo}|||${i.categoria}|||${i.nome.toLowerCase()}`;
  porChave.set(k, [...(porChave.get(k) ?? []), i]);
}
const colisoes = [...porChave.values()].filter((v) => v.length > 1);
if (colisoes.length) {
  console.error(`${colisoes.length} colisão(ões) de tipo+categoria+nome — resolva antes:`);
  for (const c of colisoes) console.error("  " + c.map((x) => `${x.nome} (${x.codigo})`).join(" / "));
  process.exit(1);
}

const brl = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const porCategoria = [...new Set(itens.map((i) => i.categoria))].sort(
  (a, b) =>
    itens.filter((i) => i.categoria === b).reduce((s, i) => s + i.valor, 0) -
    itens.filter((i) => i.categoria === a).reduce((s, i) => s + i.valor, 0)
);

const valores = porCategoria.flatMap((cat) => {
  const doGrupo = itens.filter((i) => i.categoria === cat).sort((a, b) => b.valor - a.valor);
  return [
    `  -- ${cat}: ${doGrupo.length} itens, R$ ${brl(doGrupo.reduce((s, i) => s + i.valor, 0))}`,
    ...doGrupo.map(
      (i) =>
        `  (${sql(i.codigo)}, ${sql(i.nome)}, ${sql(i.tipo)}, ${sql(i.categoria)}, ${i.preco})` +
        `  -- vendeu R$ ${brl(i.valor)}`
    ),
  ];
});
// A vírgula vai ANTES do comentário; dentro dele viraria texto. Já custou caro.
const linhasValores = valores.map((l, n) => {
  if (l.trimStart().startsWith("--")) return l;
  const ultimo = valores.slice(n + 1).every((x) => x.trimStart().startsWith("--"));
  const [corpo, comentario] = l.split("  -- ");
  return corpo + (ultimo ? "" : ",") + (comentario ? `  -- ${comentario}` : "");
});

const total = itens.reduce((s, i) => s + i.valor, 0);
writeFileSync(
  saida,
  `-- Itens de venda que saíram do cardápio do Beira Lago antes de outubro.
-- GERADO por prisma/scripts/beira-lago/gerar-itens-fora-do-cardapio.ts.
--
-- ${itens.length} itens, R$ ${brl(total)} vendidos em agosto e setembro.
--
-- POR QUE FALTAVAM: o catálogo foi montado a partir do cardápio de OUTUBRO, e
-- agosto/setembro entraram depois. Tudo que saiu de linha antes disso não tem
-- onde casar.
--
-- ENTRAM INATIVOS (ativo = false). Isso os tira do seletor de perdas, da fila
-- de fichas e de qualquer tela que ofereça escolher um item hoje — ninguém vai
-- lançar perda de um prato que não existe mais. A venda PASSADA casa do mesmo
-- jeito, porque o casamento procura por CÓDIGO e não filtra por ativo.
--
-- O PREÇO É O MÉDIO DOS DOIS MESES: valor ÷ quantidade. Não é tabela velha, é
-- o que o cliente pagou.
--
-- A CATEGORIA É PALPITE MEU, por regra de nome, e é o que você precisa
-- conferir. O comentário de cada linha mostra quanto ela vendeu; o agrupamento
-- mostra em que balde ela caiu. Erro de categoria é erro de ROTULO no painel —
-- o faturamento fecha igual —, mas vinho branco em TINTOS incomoda.
--
-- Por categoria:
${porCategoria
  .map((c) => {
    const l = itens.filter((i) => i.categoria === c);
    return `--   ${c.padEnd(26)} ${String(l.length).padStart(3)} itens  R$ ${brl(l.reduce((s, i) => s + i.valor, 0)).padStart(12)}`;
  })
  .join("\n")}

BEGIN;

INSERT INTO "ItemVenda" (id, "unidadeId", tipo, categoria, nome, "precoVenda", "codigoPdv", ativo, "criadoEm", "atualizadoEm")
SELECT gen_random_uuid()::text, u.id, v.tipo, v.categoria, v.nome, v.preco, v.codigo, false, now(), now()
FROM (VALUES
${linhasValores.join("\n")}
) AS v(codigo, nome, tipo, categoria, preco)
CROSS JOIN "Unidade" u
WHERE u.nome = 'Beira Lago'
  -- Nunca duplica: se o código já existe nesta casa, pula. Rodar duas vezes
  -- não cria nada novo.
  AND NOT EXISTS (
    SELECT 1 FROM "ItemVenda" iv
    WHERE iv."unidadeId" = u.id AND iv."codigoPdv" = v.codigo
  );

COMMIT;

-- CONFERÊNCIA: tem que dar ${itens.length} itens novos, todos inativos.
SELECT iv.categoria, count(*) AS itens, count(*) FILTER (WHERE NOT iv.ativo) AS inativos
FROM "ItemVenda" iv
JOIN "Unidade" u ON u.id = iv."unidadeId" AND u.nome = 'Beira Lago'
WHERE iv."codigoPdv" IN (${itens.map((i) => sql(i.codigo)).join(", ")})
GROUP BY iv.categoria
ORDER BY itens DESC;
`
);

console.log(`${itens.length} itens · R$ ${brl(total)} -> ${saida}`);
for (const c of porCategoria) {
  const l = itens.filter((i) => i.categoria === c);
  console.log(`  ${c.padEnd(26)} ${String(l.length).padStart(3)} itens  R$ ${brl(l.reduce((s, i) => s + i.valor, 0)).padStart(12)}`);
}
