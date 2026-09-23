// Gera o SQL das rodadas GERAIS de pareamento — as que não são de vinho.
//
//   npx tsx prisma/scripts/pareamento-vinhos/gerar-sql-geral.ts \
//       <planilha.xlsx> <catalogo.csv> [saida.sql]
//
// Rode conferir-respostas.ts ANTES.
//
// POR QUE ESTE SCRIPT EXISTE SEPARADO DE gerar-sql.ts. O gerador dos vinhos é
// preso ao Wine Garden em três lugares (preço, receita e item de venda) porque
// lá a rodada inteira era de uma casa só e a carta era o ponto. A rodada geral
// é o contrário: `Produto.codigoTeknisa` é único e GLOBAL, então o mesmo código
// atende as cinco casas, e uma linha pareada aqui conserta a compra de todas.
// Forçar a casa aqui gravaria preço em uma despensa e deixaria as outras sem.
//
// E não há carta: insumo de cozinha não vira ficha sozinho — a ficha é decisão
// do chef, item por item. Por isso os passos 5 e 6 dos vinhos não existem aqui.
//
// O QUE O SQL FAZ, em ordem:
//   1. cria os produtos novos
//   2. grava o código do Teknisa nos produtos que já existiam
//   3. religa as linhas de compra que estavam sem produto
//   4. grava preço atual e histórico, POR DESPENSA, da compra mais recente
//
// PASSO 3 É O QUE MUITA GENTE ESQUECE. Criar o produto não faz a compra velha
// casar sozinha: as linhas já estão em ItemNotaCompra com produtoId nulo, e a
// chave de idempotência impede recarregar o workflow pra refazer o casamento.
// Sem religar, o produto nasceria sem compra nenhuma — e sem preço.
//
// TUDO IDEMPOTENTE. Os ids saem de hash do código do Teknisa, os INSERT caem em
// ON CONFLICT e os UPDATE são guardados por "só se ainda estiver nulo". Rodar
// duas vezes não duplica nada.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";

/** Id estável e curto, no formato dos cuid do projeto (25 caracteres). */
const idDe = (prefixo: string, semente: string) =>
  prefixo + createHash("md5").update(semente).digest("hex").slice(0, 25 - prefixo.length);

const txt = (v: unknown) => String(v ?? "").trim();
const sql = (s: unknown) => `'${String(s).replace(/'/g, "''")}'`;

function lerCsv(caminho: string): Record<string, string>[] {
  const linhas = readFileSync(caminho, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "" && !l.trimStart().startsWith("#"));
  const partir = (linha: string): string[] => {
    const out: string[] = [];
    let atual = "";
    let dentro = false;
    for (let i = 0; i < linha.length; i++) {
      const c = linha[i];
      if (c === '"') {
        if (dentro && linha[i + 1] === '"') { atual += '"'; i++; }
        else dentro = !dentro;
      } else if (c === "," && !dentro) { out.push(atual); atual = ""; }
      else atual += c;
    }
    out.push(atual);
    return out;
  };
  const cab = partir(linhas[0]).map((h) => h.trim());
  return linhas.slice(1).map((l) => Object.fromEntries(partir(l).map((v, i) => [cab[i], v])));
}

// Linhas recusadas nesta rodada, com o motivo. Ficam FORA do SQL e visíveis no
// relatório — silenciar uma decisão pendente é como ela vira dado errado.
const EXCLUIR_CODIGO = new Map<string, string>();

function main() {
  const [arqXlsx, arqCatalogo, saida = "prisma/scripts/pareamento-vinhos/aplicar-geral.sql"] =
    process.argv.slice(2);
  if (!arqXlsx || !arqCatalogo) {
    console.error("uso: gerar-sql-geral.ts <planilha.xlsx> <catalogo.csv> [saida.sql]");
    process.exit(1);
  }

  const wb = XLSX.read(readFileSync(arqXlsx), { type: "buffer" });
  const aba = (n: string) =>
    wb.Sheets[n] ? XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[n], { defval: "" }) : [];
  const decisoes = [...aba("vinhos"), ...aba("outros")].filter((r) => txt(r.decisao));

  const catalogo = lerCsv(arqCatalogo);
  const porNomeUnidade = new Map<string, Record<string, string>>();
  for (const p of catalogo) porNomeUnidade.set(`${p.nome.toUpperCase()}|||${p.unidade}`, p);

  const criar: { id: string; nome: string; unidade: string; codigo: string; valor: number }[] = [];
  const ligar: { id: string; nome: string; codigo: string; valor: number }[] = [];
  const recusadas: string[] = [];
  /** código do Teknisa -> id do Produto que vai respondê-lo */
  const produtoDoCodigo = new Map<string, string>();

  for (const r of decisoes) {
    const codigo = txt(r.codigo_teknisa);
    const valor = Number(r.valor_comprado) || 0;
    const motivo = EXCLUIR_CODIGO.get(codigo);
    if (motivo) { recusadas.push(`${txt(r.nome_no_teknisa)} (${codigo}): ${motivo}`); continue; }

    const d = txt(r.decisao).toLowerCase();
    if (d === "descartar") continue;

    if (d === "criar") {
      criar.push({
        id: idDe("pge", `produto|${codigo}`),
        nome: txt(r.nome_ao_criar),
        unidade: txt(r.unidade_ao_criar).toUpperCase(),
        codigo,
        valor,
      });
      produtoDoCodigo.set(codigo, criar[criar.length - 1].id);
    } else if (d === "ligar") {
      const nome = txt(r.produto_para_ligar);
      const unidade = txt(r.un_sugestao) || txt(r.unidade_ao_criar);
      const p = porNomeUnidade.get(`${nome.toUpperCase()}|||${unidade}`);
      if (!p) {
        recusadas.push(`${txt(r.nome_no_teknisa)} (${codigo}): produto "${nome}" (${unidade}) não achado no catálogo`);
        continue;
      }
      ligar.push({ id: p.id, nome: p.nome, codigo, valor });
      produtoDoCodigo.set(codigo, p.id);
    }
  }

  if (produtoDoCodigo.size === 0) {
    console.error("nenhuma decisão aproveitável na planilha — nada a gerar");
    process.exit(1);
  }

  const codigos = [...produtoDoCodigo.keys()].map(sql).join(", ");
  const partes: string[] = [];
  const p = (s: string) => partes.push(s);
  const real = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const total = [...criar, ...ligar].reduce((s, x) => s + x.valor, 0);

  p(`-- Rodada geral de pareamento — gerado por gerar-sql-geral.ts, não editar à mão.`);
  p(`--`);
  p(`-- ${criar.length} produtos novos, ${ligar.length} códigos gravados em produtos existentes.`);
  p(`-- ${total > 0 ? real(total) + " de compra passam a ser reconhecidos." : ""}`);
  p(`-- ${recusadas.length} linha(s) recusada(s), listadas no fim.`);
  p(`--`);
  p(`-- Vale para TODAS as casas: codigoTeknisa é único e global, então cada código`);
  p(`-- pareado aqui conserta a compra de quem quer que tenha comprado aquele item.`);
  p(`--`);
  p(`-- IDEMPOTENTE: ids derivados por hash, INSERT com ON CONFLICT e UPDATE`);
  p(`-- guardado por "só se ainda estiver nulo". Rodar duas vezes não duplica nada.`);
  p(`--`);
  p(`-- Rode um passo de cada vez no editor do Neon, conferindo entre eles.`);
  p("");

  p("-- ---------------------------------------------------------------------------");
  p(`-- PASSO 1 — Criar os ${criar.length} produtos novos.`);
  p("-- ---------------------------------------------------------------------------");
  if (criar.length) {
    p(`INSERT INTO "Produto" (id, nome, "unidadeMedida", "codigoTeknisa", ativo, "criadoEm")`);
    p("VALUES");
    p(criar.map((c) => `  (${sql(c.id)}, ${sql(c.nome)}, ${sql(c.unidade)}, ${sql(c.codigo)}, true, now())`).join(",\n"));
    p("ON CONFLICT DO NOTHING;");
  } else {
    p("-- nenhum produto novo nesta rodada.");
  }
  p("");

  p("-- ---------------------------------------------------------------------------");
  p(`-- PASSO 2 — Gravar o código nos ${ligar.length} produtos que já existiam.`);
  p("--");
  p("-- Só onde o código ainda é nulo. Produto que já declara um código não é");
  p("-- sobrescrito: dois códigos para o mesmo item é o gargalo estrutural que");
  p("-- CodigoCompraProduto vai resolver, não coisa de sobrescrever no escuro.");
  p("-- ---------------------------------------------------------------------------");
  if (ligar.length) {
    p(`UPDATE "Produto" p SET "codigoTeknisa" = v.codigo`);
    p("FROM (VALUES");
    p(ligar.map((l) => `  (${sql(l.id)}, ${sql(l.codigo)})`).join(",\n"));
    p(") AS v(id, codigo)");
    p(`WHERE p.id = v.id AND p."codigoTeknisa" IS NULL;`);
  } else {
    p("-- nenhum código a gravar nesta rodada.");
  }
  p("");

  p("-- ---------------------------------------------------------------------------");
  p("-- PASSO 3 — Religar as linhas de compra que ficaram sem produto.");
  p("--");
  p("-- Criar o produto não faz a compra velha casar sozinha. As linhas já estão");
  p("-- em ItemNotaCompra com produtoId nulo, e a chave de idempotência impede");
  p("-- recarregar o workflow pra refazer o casamento.");
  p("--");
  p("-- Casa por codigoBruto, que é o código exato que veio na nota.");
  p("-- ---------------------------------------------------------------------------");
  p(`UPDATE "ItemNotaCompra" i SET "produtoId" = p.id`);
  p(`FROM "Produto" p`);
  p(`WHERE i."produtoId" IS NULL`);
  p(`  AND i."codigoBruto" = p."codigoTeknisa"`);
  p(`  AND p."codigoTeknisa" IN (${codigos});`);
  p("");

  p("-- ---------------------------------------------------------------------------");
  p("-- PASSO 4 — Preço atual e histórico, POR DESPENSA, da compra mais recente.");
  p("--");
  p("-- Uma linha por (despensa, produto): o mesmo item comprado por duas casas");
  p("-- tem dois preços, e é assim que o app lê custo. O preço sai do próprio");
  p("-- ItemNotaCompra religado no passo 3, não da planilha — tem que ser o que a");
  p("-- nota disse, não uma média calculada por mim.");
  p("--");
  p("-- A despensa é COALESCE(estoqueEmId, id): casa que guarda estoque em outra");
  p("-- (o CPD das casas do XMenu) tem preço na despensa, não na casa.");
  p("-- ---------------------------------------------------------------------------");
  p(`WITH ultima AS (`);
  p(`  SELECT DISTINCT ON (COALESCE(u."estoqueEmId", u.id), i."produtoId")`);
  p(`         COALESCE(u."estoqueEmId", u.id) AS "unidadeId",`);
  p(`         i."produtoId", i."precoUnitNovo" AS preco, i."dataCompra"`);
  p(`  FROM "ItemNotaCompra" i`);
  p(`  JOIN "NotaCompra" n ON n.id = i."notaCompraId"`);
  p(`  JOIN "Unidade"    u ON u.id = n."unidadeId"`);
  p(`  JOIN "Produto"    p ON p.id = i."produtoId"`);
  p(`  WHERE p."codigoTeknisa" IN (${codigos})`);
  p(`    AND i."precoUnitNovo" > 0`);
  p(`  ORDER BY COALESCE(u."estoqueEmId", u.id), i."produtoId", i."dataCompra" DESC, i.id`);
  p(`)`);
  p(`INSERT INTO "PrecoAtualProduto" (id, "unidadeId", "produtoId", preco, "dataCompra", "atualizadoEm")`);
  p(`SELECT 'prge' || left(md5(u."unidadeId" || u."produtoId"), 21),`);
  p(`       u."unidadeId", u."produtoId", u.preco, u."dataCompra", now()`);
  p(`FROM ultima u`);
  p(`ON CONFLICT ("unidadeId", "produtoId") DO UPDATE`);
  p(`  SET preco = EXCLUDED.preco, "dataCompra" = EXCLUDED."dataCompra", "atualizadoEm" = now();`);
  p("");
  p("-- O histórico, para o relatório de variação de preço.");
  p(`INSERT INTO "HistoricoPrecoProduto" (id, "unidadeId", "produtoId", preco, origem, "origemId", "dataCompra", "criadoEm")`);
  p(`SELECT 'hge' || left(md5(pa."unidadeId" || pa."produtoId"), 22),`);
  p(`       pa."unidadeId", pa."produtoId", pa.preco,`);
  p(`       'NOTA_COMPRA', 'pareamento-geral', pa."dataCompra", now()`);
  p(`FROM "PrecoAtualProduto" pa`);
  p(`JOIN "Produto" p ON p.id = pa."produtoId"`);
  p(`WHERE p."codigoTeknisa" IN (${codigos})`);
  p(`ON CONFLICT (id) DO NOTHING;`);
  p("");

  p("-- ---------------------------------------------------------------------------");
  p("-- VERIFICAÇÃO");
  p("-- ---------------------------------------------------------------------------");
  p(`-- 1) Os produtos desta rodada: preço por casa. Nenhum pode ficar sem preço —`);
  p(`--    produto sem preço é custo zero, que é pior que produto sem pareamento.`);
  p(`SELECT p.nome, p."unidadeMedida", p."codigoTeknisa",`);
  p(`       u.nome AS despensa, round(pa.preco::numeric, 2) AS preco, pa."dataCompra"::date`);
  p(`FROM "Produto" p`);
  p(`LEFT JOIN "PrecoAtualProduto" pa ON pa."produtoId" = p.id`);
  p(`LEFT JOIN "Unidade" u ON u.id = pa."unidadeId"`);
  p(`WHERE p."codigoTeknisa" IN (${codigos})`);
  p(`ORDER BY p.nome, u.nome;`);
  p("");
  p(`-- 2) O reconhecimento de cada casa depois da rodada.`);
  p(`SELECT u.nome AS casa,`);
  p(`       count(*) AS linhas,`);
  p(`       count(i."produtoId") AS reconhecidas,`);
  p(`       round(100.0 * count(i."produtoId") / nullif(count(*), 0), 1) AS pct,`);
  p(`       round(sum(i."valorTotal")::numeric, 2) AS comprado,`);
  p(`       round(sum(i."valorTotal") FILTER (WHERE i."produtoId" IS NOT NULL)::numeric, 2) AS reconhecido`);
  p(`FROM "ItemNotaCompra" i`);
  p(`JOIN "NotaCompra" n ON n.id = i."notaCompraId"`);
  p(`JOIN "Unidade" u ON u.id = n."unidadeId"`);
  p(`GROUP BY u.nome`);
  p(`ORDER BY u.nome;`);
  p("");

  if (recusadas.length) {
    p("-- ---------------------------------------------------------------------------");
    p(`-- ${recusadas.length} LINHA(S) FORA DESTA RODADA — precisam de decisão:`);
    for (const r of recusadas) p(`--   * ${r}`);
    p("-- ---------------------------------------------------------------------------");
  }

  writeFileSync(saida, partes.join("\n") + "\n");

  // ------------------------------------------------------------- relatório
  console.log(`${criar.length} produtos a criar`);
  for (const c of criar) console.log(`   + ${c.nome} (${c.unidade})  ${real(c.valor)}`);
  console.log(`${ligar.length} códigos a gravar em produtos existentes`);
  for (const l of ligar) console.log(`   = ${l.nome}  ${real(l.valor)}`);
  console.log(`${real(total)} de compra passam a ser reconhecidos`);
  if (recusadas.length) {
    console.log(`\n${recusadas.length} recusada(s):`);
    for (const r of recusadas) console.log("  ·", r);
  }
  console.log(`\nSQL em ${saida}`);
}

main();
