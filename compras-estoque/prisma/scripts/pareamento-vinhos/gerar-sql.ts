// Gera o SQL da rodada de vinhos do Wine Garden, a partir da planilha
// respondida e conferida.
//
//   npx tsx prisma/scripts/pareamento-vinhos/gerar-sql.ts \
//       <planilha.xlsx> <catalogo.csv> <carta.csv> [saida.sql]
//
// Rode conferir-respostas.ts ANTES. Este script assume que as decisões já
// passaram pela conferência e só recusa as linhas explicitamente excluídas.
//
// O QUE O SQL FAZ, em ordem:
//   1. cria os produtos novos
//   2. grava o código do Teknisa nos produtos que já existiam
//   3. religa as linhas de compra que estavam sem produto
//   4. grava preço atual e histórico a partir da compra mais recente de cada um
//   5. cria as receitas (uma garrafa, ou a fração da taça)
//   6. amarra cada receita no seu item de venda
//
// PASSO 3 É O QUE MUITA GENTE ESQUECE. Criar o produto não faz a compra velha
// casar sozinha: as linhas já estão gravadas em ItemNotaCompra com produtoId
// nulo, e a chave de idempotência impede recarregar o workflow pra refazer o
// casamento. Sem religar, os vinhos teriam produto, receita e ficha — e custo
// ZERO, porque nunca teriam recebido preço.
//
// TUDO IDEMPOTENTE. Os ids são derivados por hash do código do Teknisa e do id
// do item de venda, então rodar duas vezes não duplica nada: os INSERT caem em
// ON CONFLICT DO NOTHING e os UPDATE são guardados por "só se ainda estiver
// nulo". Nenhuma ficha existente é tocada.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";

const CASA = "Wine Garden";

/** Id estável e curto, no formato dos cuid do projeto. */
const idDe = (prefixo: string, semente: string) =>
  prefixo + createHash("md5").update(semente).digest("hex").slice(0, 22);

const txt = (v: unknown) => String(v ?? "").trim();
const num = (v: unknown) => Number(txt(v).replace(",", "."));
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
const EXCLUIR_CODIGO = new Map<string, string>([
  ["900001000727", "Poggio Marù: o produto já tem o código 900001000785. Dois códigos do Teknisa para o mesmo vinho — decidir qual é o vigente antes de sobrescrever."],
  ["900001000640", "Le Petit Ronan by Clinet: ligado no mesmo produto que RONAN BY CLINET (900001000754). São dois vinhos — o segundo rótulo e o principal —, e codigoTeknisa é único: um dos dois ficaria sem casar. Provavelmente é produto novo."],
]);
const EXCLUIR_VENDA = new Map<string, string>([
  ["Jerez Marqués del Real Tesoro Fino (50 ml)", "marcado 0,2 (150 ml) numa dose de 50 ml — a fração de 750 ml seria 0,067. A 0,2 o custo dá R$ 31,58 contra venda de R$ 22."],
  ["Brunello di Montalcino Pian delle Vigne", "casou por semelhança com a compra do PIAN DELLE VIGNE ROSSO DI MONTALCINO (R$ 319,55). Brunello e Rosso são vinhos diferentes da mesma vinícola, e o Brunello não foi comprado no período — ficaria com o custo do irmão barato e CMV de 22%, bonito e errado."],
  ["Marques de Borba - Vinhas Velhas DOC", "a R$ 0,2 de garrafa o custo é R$ 107,86 e a venda é R$ 81 — CMV 133%. A garrafa custa R$ 539,31; nenhuma fração razoável fecha. Preço de carta ou de compra precisa ser revisto."],
]);

function main() {
  const [arqXlsx, arqCatalogo, arqCarta, saida = "prisma/scripts/pareamento-vinhos/aplicar-vinhos.sql"] =
    process.argv.slice(2);
  if (!arqXlsx || !arqCatalogo || !arqCarta) {
    console.error("uso: gerar-sql.ts <planilha.xlsx> <catalogo.csv> <carta.csv> [saida.sql]");
    process.exit(1);
  }

  const wb = XLSX.readFile(arqXlsx);
  const aba = (n: string) => XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[n], { defval: "" });
  const decisoes = [...aba("vinhos"), ...aba("outros")].filter((r) => txt(r.decisao));
  const cartaXlsx = aba("carta-vinhos");

  const catalogo = lerCsv(arqCatalogo);
  const carta = lerCsv(arqCarta);

  const porNomeUnidade = new Map<string, Record<string, string>>();
  for (const p of catalogo) {
    porNomeUnidade.set(`${p.nome.toUpperCase()}|||${p.unidade}`, p);
  }

  // --------------------------------------------------------------- produtos
  const criar: { id: string; nome: string; unidade: string; codigo: string }[] = [];
  const ligar: { id: string; nome: string; codigo: string }[] = [];
  const recusadas: string[] = [];
  /** código do Teknisa -> id do Produto que vai respondê-lo */
  const produtoDoCodigo = new Map<string, string>();

  for (const r of decisoes) {
    const codigo = txt(r.codigo_teknisa);
    const motivo = EXCLUIR_CODIGO.get(codigo);
    if (motivo) { recusadas.push(`${txt(r.nome_no_teknisa)} (${codigo}): ${motivo}`); continue; }

    const d = txt(r.decisao).toLowerCase();
    if (d === "descartar") continue;

    if (d === "criar") {
      const nome = txt(r.nome_ao_criar);
      const unidade = txt(r.unidade_ao_criar).toUpperCase();
      const id = idDe("pwg", `produto|${codigo}`);
      criar.push({ id, nome, unidade, codigo });
      produtoDoCodigo.set(codigo, id);
    } else if (d === "ligar") {
      const nome = txt(r.produto_para_ligar);
      const unidade = txt(r.un_sugestao) || txt(r.unidade_ao_criar);
      const p = porNomeUnidade.get(`${nome.toUpperCase()}|||${unidade}`);
      if (!p) { recusadas.push(`${txt(r.nome_no_teknisa)} (${codigo}): produto "${nome}" (${unidade}) não achado no catálogo`); continue; }
      ligar.push({ id: p.id, nome: p.nome, codigo });
      produtoDoCodigo.set(codigo, p.id);
    }
  }

  // ----------------------------------------------------------------- carta
  // A planilha não carrega o id do ItemVenda, então o casamento é por
  // (nome, preço). Nomes se repetem na carta — "Chablis Maurice Lecestre"
  // aparece como taça e como garrafa —, mas nome+preço separa os dois. Onde
  // nem isso separa (duas linhas idênticas de "Herdade do Peso Sossego"), as
  // linhas são iguais em tudo e emparelhar em ordem dá no mesmo. O contador
  // abaixo garante que as duas listas têm a mesma quantidade de cada par.
  const idsPorNomePreco = new Map<string, string[]>();
  for (const v of carta) {
    const k = `${txt(v.nome)}|||${num(v.preco_venda)}`;
    const lista = idsPorNomePreco.get(k) ?? [];
    lista.push(txt(v.id));
    idsPorNomePreco.set(k, lista);
  }

  const receitas: {
    itemVendaId: string; nome: string; produtoId: string; quantidade: number;
    unidade: string; custo: number; venda: number;
  }[] = [];

  for (const r of cartaXlsx) {
    const nome = txt(r.nome_na_carta);
    if (txt(r.ja_tem_ficha)) continue;
    const q = num(r.garrafas_por_venda);
    if (!q) continue;

    const motivo = EXCLUIR_VENDA.get(nome);
    if (motivo) { recusadas.push(`${nome}: ${motivo}`); continue; }

    const codigo = txt(r.codigo_teknisa);
    const produtoId = produtoDoCodigo.get(codigo);
    if (!produtoId) {
      recusadas.push(`${nome}: o código ${codigo || "(nenhum)"} não tem produto nesta rodada — sem produto não há custo`);
      continue;
    }

    const k = `${nome}|||${num(r.preco_venda)}`;
    const fila = idsPorNomePreco.get(k);
    if (!fila || fila.length === 0) {
      recusadas.push(`${nome} (R$ ${r.preco_venda}): não achei o item de venda correspondente na carta exportada`);
      continue;
    }
    const itemVendaId = fila.shift()!;

    const linhaDecisao = decisoes.find((d) => txt(d.codigo_teknisa) === codigo);
    const unidade = txt(linhaDecisao?.unidade_ao_criar) || txt(linhaDecisao?.un_sugestao) || "UND";

    receitas.push({
      itemVendaId, nome, produtoId, quantidade: q, unidade,
      custo: num(r.custo_da_garrafa) * q,
      venda: num(r.preco_venda),
    });
  }

  // ------------------------------------------------- receitas, agrupadas
  // "Receita" tem UNIQUE (unidadeId, nome), e isso morde de duas formas que só
  // apareceram ao rodar o SQL contra o schema de verdade:
  //
  //   - o mesmo vinho vendido como taça E como garrafa gera dois ItemVenda de
  //     nome idêntico. Duas receitas com o mesmo nome: uma some no ON CONFLICT
  //     e o ingrediente dela quebra na chave estrangeira.
  //   - a carta tem linhas repetidas ("Herdade do Peso Sossego" duas vezes,
  //     mesmo preço). Ali as duas vendas são a mesma coisa.
  //
  // A receita passa a ser por (produto, quantidade), não por item de venda:
  // vendas iguais dividem a mesma receita, e formatos diferentes ganham nomes
  // diferentes. Um ItemVenda aponta pra receita do seu grupo.
  const grupos = new Map<string, { nomeBase: string; produtoId: string; quantidade: number; unidade: string; itens: typeof receitas }>();
  for (const r of receitas) {
    const k = `${r.produtoId}|||${r.quantidade}`;
    const g = grupos.get(k) ?? { nomeBase: r.nome, produtoId: r.produtoId, quantidade: r.quantidade, unidade: r.unidade, itens: [] };
    g.itens.push(r);
    grupos.set(k, g);
  }

  const gruposPorNome = new Map<string, number>();
  for (const g of grupos.values()) gruposPorNome.set(g.nomeBase, (gruposPorNome.get(g.nomeBase) ?? 0) + 1);

  const comoServe = (q: number) => (q === 1 ? "garrafa" : q < 1 ? "taça" : `${q}x`);
  const nomesUsados = new Set<string>();
  const receitasFinais = [...grupos.values()].map((g) => {
    let nome = gruposPorNome.get(g.nomeBase)! > 1 ? `${g.nomeBase} (${comoServe(g.quantidade)})` : g.nomeBase;
    // Cinto e suspensório: se ainda assim repetir, desempata pela quantidade.
    if (nomesUsados.has(nome)) nome = `${g.nomeBase} (${g.quantidade})`;
    nomesUsados.add(nome);
    return { ...g, nome, id: idDe("rwg", `receita|${g.produtoId}|${g.quantidade}`) };
  });

  const nomesDistintos = new Set(receitasFinais.map((r) => r.nome));
  if (nomesDistintos.size !== receitasFinais.length) {
    console.error("ERRO: nomes de receita repetidos depois do desempate — corrigir antes de gerar.");
    process.exit(1);
  }

  // ------------------------------------------------------------------- SQL
  const partes: string[] = [];
  const p = (s: string) => partes.push(s);

  p(`-- Rodada de vinhos do Wine Garden — gerado de ${arqXlsx.split("/").pop()}`);
  p(`--`);
  p(`-- ${criar.length} produtos criados, ${ligar.length} códigos gravados em produtos existentes,`);
  p(`-- ${receitas.length} receitas de venda. ${recusadas.length} linha(s) recusada(s), listadas no fim.`);
  p(`--`);
  p(`-- IDEMPOTENTE: ids derivados por hash, INSERT com ON CONFLICT DO NOTHING e`);
  p(`-- UPDATE guardado por "só se ainda estiver nulo". Rodar duas vezes não duplica`);
  p(`-- nada e não toca em ficha que já existe.`);
  p(`--`);
  p(`-- Rode um passo de cada vez no editor do Neon, conferindo entre eles.`);
  p("");

  p("-- ---------------------------------------------------------------------------");
  p(`-- PASSO 1 — Criar os ${criar.length} produtos novos.`);
  p("-- ---------------------------------------------------------------------------");
  p(`INSERT INTO "Produto" (id, nome, "unidadeMedida", "codigoTeknisa", ativo, "criadoEm")`);
  p("VALUES");
  p(criar.map((c) => `  (${sql(c.id)}, ${sql(c.nome)}, ${sql(c.unidade)}, ${sql(c.codigo)}, true, now())`).join(",\n"));
  p("ON CONFLICT DO NOTHING;");
  p("");

  p("-- ---------------------------------------------------------------------------");
  p(`-- PASSO 2 — Gravar o código nos ${ligar.length} produtos que já existiam.`);
  p("--");
  p("-- Só onde o código ainda é nulo. Produto que já declara um código não é");
  p("-- sobrescrito: dois códigos para o mesmo item é decisão de gente, e a");
  p("-- conferência recusa a linha antes de chegar aqui.");
  p("-- ---------------------------------------------------------------------------");
  p(`UPDATE "Produto" p SET "codigoTeknisa" = v.codigo`);
  p("FROM (VALUES");
  p(ligar.map((l) => `  (${sql(l.id)}, ${sql(l.codigo)})`).join(",\n"));
  p(") AS v(id, codigo)");
  p(`WHERE p.id = v.id AND p."codigoTeknisa" IS NULL;`);
  p("");

  p("-- ---------------------------------------------------------------------------");
  p("-- PASSO 3 — Religar as linhas de compra que ficaram sem produto.");
  p("--");
  p("-- Criar o produto não faz a compra velha casar sozinha. As linhas já estão");
  p("-- em ItemNotaCompra com produtoId nulo, e a chave de idempotência impede");
  p("-- recarregar o workflow pra refazer o casamento. Sem este passo os vinhos");
  p("-- teriam ficha e custo ZERO.");
  p("--");
  p("-- Casa por codigoBruto, que é o código exato que veio na nota.");
  p("-- ---------------------------------------------------------------------------");
  p(`UPDATE "ItemNotaCompra" i SET "produtoId" = p.id`);
  p(`FROM "Produto" p`);
  p(`WHERE i."produtoId" IS NULL`);
  p(`  AND i."codigoBruto" = p."codigoTeknisa"`);
  p(`  AND p."codigoTeknisa" IN (${[...produtoDoCodigo.keys()].map(sql).join(", ")});`);
  p("");

  p("-- ---------------------------------------------------------------------------");
  p("-- PASSO 4 — Preço atual e histórico, da compra MAIS RECENTE de cada produto.");
  p("--");
  p("-- Sai do próprio ItemNotaCompra religado no passo 3, não da planilha: o");
  p("-- preço tem que ser o que a nota disse, não uma média que eu calculei.");
  p("-- ---------------------------------------------------------------------------");
  p(`WITH despensa AS (`);
  p(`  SELECT COALESCE(u."estoqueEmId", u.id) AS id FROM "Unidade" u WHERE u.nome = ${sql(CASA)}`);
  p(`), ultima AS (`);
  p(`  SELECT DISTINCT ON (i."produtoId")`);
  p(`         i."produtoId", i."precoUnitNovo" AS preco, i."dataCompra"`);
  p(`  FROM "ItemNotaCompra" i`);
  p(`  JOIN "NotaCompra" n ON n.id = i."notaCompraId"`);
  p(`  JOIN despensa d ON d.id = n."unidadeId"`);
  p(`  JOIN "Produto" p ON p.id = i."produtoId"`);
  p(`  WHERE p."codigoTeknisa" IN (${[...produtoDoCodigo.keys()].map(sql).join(", ")})`);
  p(`    AND i."precoUnitNovo" > 0`);
  p(`  ORDER BY i."produtoId", i."dataCompra" DESC, i.id`);
  p(`)`);
  p(`INSERT INTO "PrecoAtualProduto" (id, "unidadeId", "produtoId", preco, "dataCompra", "atualizadoEm")`);
  p(`SELECT 'prwg' || left(md5(d.id || u."produtoId"), 21), d.id, u."produtoId", u.preco, u."dataCompra", now()`);
  p(`FROM ultima u CROSS JOIN despensa d`);
  p(`ON CONFLICT ("unidadeId", "produtoId") DO UPDATE`);
  p(`  SET preco = EXCLUDED.preco, "dataCompra" = EXCLUDED."dataCompra", "atualizadoEm" = now();`);
  p("");
  p("-- O histórico, para o relatório de variação de preço.");
  p(`WITH despensa AS (`);
  p(`  SELECT COALESCE(u."estoqueEmId", u.id) AS id FROM "Unidade" u WHERE u.nome = ${sql(CASA)}`);
  p(`)`);
  p(`INSERT INTO "HistoricoPrecoProduto" (id, "unidadeId", "produtoId", preco, origem, "origemId", "dataCompra", "criadoEm")`);
  p(`SELECT 'hvwg' || left(md5(pa."produtoId"), 21), pa."unidadeId", pa."produtoId", pa.preco,`);
  p(`       'NOTA_COMPRA', 'pareamento-vinhos-wine-garden', pa."dataCompra", now()`);
  p(`FROM "PrecoAtualProduto" pa JOIN despensa d ON d.id = pa."unidadeId"`);
  p(`JOIN "Produto" p ON p.id = pa."produtoId"`);
  p(`WHERE p."codigoTeknisa" IN (${[...produtoDoCodigo.keys()].map(sql).join(", ")})`);
  p(`ON CONFLICT (id) DO NOTHING;`);
  p("");

  p("-- ---------------------------------------------------------------------------");
  p(`-- PASSO 5 — As ${receitasFinais.length} receitas, para ${receitas.length} itens de venda.`);
  p("--");
  p("-- Uma receita por (produto, quantidade), não por item de venda: \"Receita\"");
  p("-- tem UNIQUE (unidadeId, nome), e o mesmo vinho vendido como taça e como");
  p("-- garrafa gera dois itens de venda de nome idêntico. Sem isto, uma das duas");
  p("-- receitas some no ON CONFLICT e o ingrediente dela quebra na FK — foi o que");
  p("-- aconteceu ao rodar a primeira versão deste SQL contra o schema de verdade.");
  p("-- Quando o mesmo vinho tem dois formatos, o nome ganha o sufixo; vendas");
  p("-- idênticas dividem a mesma receita.");
  p("--");
  p("-- rendimentoQtd fica NULO de propósito: sem rendimento, explodirReceitaPura");
  p("-- trata a receita como 1 unidade e o custo é quantidade x preço — que é");
  p("-- exatamente o que se quer aqui (ver src/lib/receita.ts:78).");
  p("-- ---------------------------------------------------------------------------");
  p(`WITH casa AS (SELECT id FROM "Unidade" WHERE nome = ${sql(CASA)})`);
  p(`INSERT INTO "Receita" (id, "unidadeId", nome, "criadoEm", "atualizadoEm")`);
  p(`SELECT v.id, casa.id, v.nome, now(), now() FROM (VALUES`);
  p(receitasFinais.map((r) => `  (${sql(r.id)}, ${sql(r.nome)})`).join(",\n"));
  p(`) AS v(id, nome) CROSS JOIN casa`);
  p(`ON CONFLICT DO NOTHING;`);
  p("");
  p(`INSERT INTO "IngredienteReceita" (id, "receitaId", "produtoId", quantidade, "unidadeMedida")`);
  p("VALUES");
  p(receitasFinais.map((r) =>
    `  (${sql(idDe("iwg", `ing|${r.produtoId}|${r.quantidade}`))}, ${sql(r.id)}, ${sql(r.produtoId)}, ${r.quantidade}, ${sql(r.unidade)})`
  ).join(",\n"));
  p("ON CONFLICT DO NOTHING;");
  p("");

  p("-- ---------------------------------------------------------------------------");
  p(`-- PASSO 6 — Amarrar os ${receitas.length} itens de venda nas suas receitas.`);
  p("--");
  p("-- Só onde ainda não há ficha. Ficha existente nunca é sobrescrita.");
  p("-- ---------------------------------------------------------------------------");
  p(`UPDATE "ItemVenda" iv SET "receitaId" = v."receitaId", "atualizadoEm" = now()`);
  p("FROM (VALUES");
  p(receitasFinais.flatMap((r) => r.itens.map((i) => `  (${sql(i.itemVendaId)}, ${sql(r.id)})`)).join(",\n"));
  p(`) AS v("itemVendaId", "receitaId")`);
  p(`WHERE iv.id = v."itemVendaId" AND iv."receitaId" IS NULL;`);
  p("");

  p("-- ---------------------------------------------------------------------------");
  p("-- VERIFICAÇÃO");
  p("-- ---------------------------------------------------------------------------");
  p(`-- 1) Quanto da compra do Wine Garden passou a ser reconhecida.`);
  p(`SELECT count(*) AS linhas, count(i."produtoId") AS reconhecidas,`);
  p(`       round(100.0 * count(i."produtoId") / nullif(count(*), 0), 1) AS pct,`);
  p(`       round(sum(i."valorTotal") FILTER (WHERE i."produtoId" IS NOT NULL)::numeric, 2) AS valor_reconhecido`);
  p(`FROM "ItemNotaCompra" i`);
  p(`JOIN "NotaCompra" n ON n.id = i."notaCompraId"`);
  p(`JOIN "Unidade" u ON u.id = n."unidadeId"`);
  p(`WHERE u.nome = ${sql(CASA)};`);
  p("");
  p(`-- 2) O CMV de cada vinho que ganhou ficha. Esperado: nada acima de 60%,`);
  p(`--    nada em zero. Zero significa produto sem preço — investigar.`);
  p(`SELECT iv.nome, iv."precoVenda", round(ir.quantidade::numeric, 3) AS garrafas,`);
  p(`       round(pa.preco::numeric, 2) AS preco_garrafa,`);
  p(`       round((ir.quantidade * pa.preco)::numeric, 2) AS custo,`);
  p(`       round((100.0 * ir.quantidade * pa.preco / nullif(iv."precoVenda", 0))::numeric, 1) AS cmv_pct`);
  p(`FROM "ItemVenda" iv`);
  p(`JOIN "Receita" r ON r.id = iv."receitaId"`);
  p(`JOIN "IngredienteReceita" ir ON ir."receitaId" = r.id`);
  p(`LEFT JOIN "PrecoAtualProduto" pa ON pa."produtoId" = ir."produtoId"`);
  p(`  AND pa."unidadeId" = (SELECT COALESCE(u."estoqueEmId", u.id) FROM "Unidade" u WHERE u.nome = ${sql(CASA)})`);
  p(`WHERE r.id LIKE 'rwg%'`);
  p(`ORDER BY cmv_pct DESC NULLS FIRST;`);
  p("");

  if (recusadas.length) {
    p("-- ---------------------------------------------------------------------------");
    p(`-- ${recusadas.length} LINHA(S) FORA DESTA RODADA — precisam de decisão:`);
    for (const r of recusadas) p(`--   * ${r}`);
    p("-- ---------------------------------------------------------------------------");
  }

  writeFileSync(saida, partes.join("\n") + "\n");

  // ------------------------------------------------------------- relatório
  const real = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  console.log(`${criar.length} produtos a criar`);
  console.log(`${ligar.length} códigos a gravar em produtos existentes`);
  console.log(`${receitas.length} receitas (${receitas.filter((r) => r.quantidade === 1).length} garrafa, ${receitas.filter((r) => r.quantidade !== 1).length} fração)`);
  const comCmv = receitas.filter((r) => r.custo > 0 && r.venda > 0).map((r) => ({ ...r, cmv: r.custo / r.venda }));
  comCmv.sort((a, b) => b.cmv - a.cmv);
  if (comCmv.length) {
    const media = comCmv.reduce((s, r) => s + r.cmv, 0) / comCmv.length;
    console.log(`\nCMV previsto: média ${(media * 100).toFixed(0)}%, pior ${(comCmv[0].cmv * 100).toFixed(0)}%, melhor ${(comCmv[comCmv.length - 1].cmv * 100).toFixed(0)}%`);
    console.log("\nos 5 mais altos:");
    for (const r of comCmv.slice(0, 5)) {
      console.log(`  ${(r.cmv * 100).toFixed(0).padStart(3)}%  ${r.nome.padEnd(48)} custo ${real(r.custo).padStart(12)}  venda ${real(r.venda)}`);
    }
  }
  if (recusadas.length) {
    console.log(`\n${recusadas.length} fora desta rodada:`);
    for (const r of recusadas) console.log(`  * ${r}`);
  }
  console.log(`\n${saida}`);
}

main();
