// Lê a planilha de pareamento PREENCHIDA e escreve o SQL de aplicação.
//
//   npx tsx prisma/scripts/codigo-teknisa/gerar-sql-pareamento.ts \
//       <pareamento-preenchido.xlsx> <catalogo.csv> <pasta-de-saida>
//
// Sai em três arquivos, pra rodar em ordem no SQL Editor do Neon:
//   3a-ligar-codigos.sql       — grava o código nos produtos que já existem
//   3b-criar-produtos.sql      — cria os que não existem, já com código
//   3c-unidades-a-decidir.csv  — o que ficou ligado mas com preço travado
//
// CADA ARQUIVO É UM COMANDO SÓ, com a lista inteira dentro de um VALUES. Não é
// estética: colar 112 UPDATEs seguidos no Neon já engoliu as primeiras linhas
// de um script antes neste projeto, e o resultado foi metade aplicada sem
// ninguém perceber. Um comando só ou aplica inteiro, ou dá erro de sintaxe e
// não aplica nada.
//
// Idempotente: `codigoTeknisa IS NULL` no UPDATE e id determinístico no
// INSERT. Rodar duas vezes não duplica nem sobrescreve.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const chave = (s: string) =>
  semAcento(String(s)).toUpperCase().replace(/\([^)]*\)/g, " ").replace(/[^A-Z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const sql = (s: string) => `'${String(s).replace(/'/g, "''")}'`;

/**
 * O cadastro só tem KG, LT, UND e CX (UNIDADES_MEDIDA). O Teknisa manda a
 * embalagem de compra: fardo, balde, galão, lata, garrafa, barril, fatia.
 *
 * Embalagem fechada vira CX e item avulso vira UND — não é conversão de
 * medida, é dizer "isto é vendido por pacote" ou "por peça". O preço segue
 * sendo o da embalagem, que é o que a nota traz.
 *
 * GR fica de fora de propósito. "CARPACCIO BOVINO 200G" em GR custa R$ 21,90 —
 * que é o preço do pacote de 200 g, não do grama. Mapear pra KG escreveria
 * R$ 21,90 o quilo; mapear pra UND esconde o peso. Fica sem tradução, aparece
 * no relatório e alguém decide.
 */
const UNIDADE_AO_CRIAR: Record<string, string> = {
  KG: "KG",
  LT: "LT", L: "LT",
  UN: "UND", UND: "UND", UNI: "UND", UNID: "UND", UNIDADE: "UND",
  GF: "UND", FT: "UND", BBL: "UND", RL: "UND", BOB: "UND", PR: "UND",
  CX: "CX", FD: "CX", LA: "CX", BD: "CX", GA: "CX", BB: "CX", PC: "CX", PT: "CX", BG: "CX",
};

function lerCsv(caminho: string): Record<string, string>[] {
  // Descarta comentário ANTES de escolher o cabeçalho. Sem isto, a primeira
  // linha de comentário de apelidos-pareamento.csv virava o cabeçalho, o mapa
  // de apelidos saía vazio e "PRESUNTO PARMA" viraria produto novo — a
  // duplicata que o arquivo de apelidos existe pra evitar.
  const linhas = readFileSync(caminho, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "" && !l.startsWith("#"));
  const partir = (linha: string): string[] => {
    const out: string[] = [];
    let atual = "";
    let dentro = false;
    for (let i = 0; i < linha.length; i++) {
      const c = linha[i];
      if (c === '"') {
        if (dentro && linha[i + 1] === '"') { atual += '"'; i++; } else dentro = !dentro;
      } else if (c === "," && !dentro) { out.push(atual); atual = ""; }
      else atual += c;
    }
    out.push(atual);
    return out;
  };
  const cab = partir(linhas[0]);
  return linhas.slice(1).map((l) => Object.fromEntries(partir(l).map((v, i) => [cab[i], v])));
}

function main() {
  const [arqPlanilha, arqCatalogo, pastaSaida = "."] = process.argv.slice(2);
  if (!arqPlanilha || !arqCatalogo) {
    console.error("uso: gerar-sql-pareamento.ts <preenchido.xlsx> <catalogo.csv> <pasta-saida>");
    process.exit(1);
  }
  mkdirSync(pastaSaida, { recursive: true });

  const catalogo = lerCsv(arqCatalogo).map((p) => ({ nome: p.nome, unidade: p.unidade }));
  const porChave = new Map<string, typeof catalogo>();
  for (const p of catalogo) {
    const k = chave(p.nome);
    porChave.set(k, [...(porChave.get(k) ?? []), p]);
  }

  // Apelidos confirmados pelo setor de compras (ver apelidos-pareamento.csv).
  const apelidos = new Map(
    lerCsv(join(__dirname, "apelidos-pareamento.csv"))
      .filter((a) => a.escrito_na_planilha && !a.escrito_na_planilha.startsWith("#"))
      .map((a) => [chave(a.escrito_na_planilha), a.nome_no_catalogo])
  );

  const wb = XLSX.readFile(arqPlanilha);
  const linhas = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[wb.SheetNames[0]], { defval: "" });

  const ligar: { nome: string; unidade: string; codigo: string; teknisa: string; unidadeTeknisa: string }[] = [];
  const criar: { nome: string; unidade: string; codigo: string; unidadeTeknisa: string }[] = [];
  const semTraducao: any[] = [];
  const pulados: string[] = [];

  for (const x of linhas) {
    const codigo = String(x.codigo_teknisa).trim();
    const unidadeTeknisa = String(x.unidade).trim().toUpperCase();
    const sim = String(x.confirma).trim().toLowerCase() === "sim";
    const correcaoBruta = String(x.se_nao_qual_produto).trim();
    const correcao = correcaoBruta ? apelidos.get(chave(correcaoBruta)) ?? correcaoBruta : "";

    // 1. Escreveu um nome: manda ele, tenha marcado sim ou não.
    if (correcao) {
      const achado = porChave.get(chave(correcao));
      if (achado?.length === 1) {
        ligar.push({ nome: achado[0].nome, unidade: achado[0].unidade, codigo, teknisa: x.nome_no_teknisa, unidadeTeknisa });
      } else {
        const u = UNIDADE_AO_CRIAR[unidadeTeknisa];
        if (u) criar.push({ nome: correcao, unidade: u, codigo, unidadeTeknisa });
        else semTraducao.push(x);
      }
      continue;
    }
    // 2. Aceitou a sugestão.
    if (sim && String(x.sugestao).trim()) {
      const achado = porChave.get(chave(x.sugestao));
      if (achado?.length === 1) {
        ligar.push({ nome: achado[0].nome, unidade: achado[0].unidade, codigo, teknisa: x.nome_no_teknisa, unidadeTeknisa });
        continue;
      }
    }
    // 3. "sim" numa linha sem candidato = é produto novo, com o nome do Teknisa.
    if (sim) {
      const u = UNIDADE_AO_CRIAR[unidadeTeknisa];
      if (u) criar.push({ nome: String(x.nome_no_teknisa).trim(), unidade: u, codigo, unidadeTeknisa });
      else semTraducao.push(x);
      continue;
    }
    // 4. "não" sem correção: ninguém disse o que é. Não se inventa.
    pulados.push(x.nome_no_teknisa);
  }

  // ------------------------------------------------------------------
  // Dois códigos pro mesmo produto
  //
  // `codigoTeknisa` é único: o produto carrega UM código. Mas o Teknisa
  // cadastra o mesmo insumo duas vezes — o de consumo ("AÇUCAR KG") e o de
  // compra ("AÇUCAR 6X5KG (COMPRA)") — e a planilha mandou os dois pro mesmo
  // produto do catálogo.
  //
  // Sem tratar, o UPDATE ... FROM com duas linhas casando o mesmo produto
  // grava uma delas em silêncio, escolhida pelo plano de execução. Fica o
  // código de consumo (o que tem a unidade do cadastro): é a linha cujo preço
  // vai poder entrar. O outro é reportado, não sumido.
  // ------------------------------------------------------------------
  const porProduto = new Map<string, typeof ligar>();
  for (const l of ligar) {
    const k = `${l.nome}|||${l.unidade}`;
    porProduto.set(k, [...(porProduto.get(k) ?? []), l]);
  }
  const ligarUnico: typeof ligar = [];
  const codigosDescartados: { produto: string; ficou: string; caiu: string[] }[] = [];
  for (const [, grupo] of porProduto) {
    if (grupo.length === 1) { ligarUnico.push(grupo[0]); continue; }
    // Critério 1: a unidade bate com a do cadastro — é a linha cujo preço vai
    // poder entrar. Critério 2, quando nenhuma bate: o nome SEM "(COMPRA)".
    // No Teknisa o sufixo "(COMPRA)" marca o cadastro de embalagem fechada;
    // sem ele é o de consumo, que é o que a ficha usa.
    const casaUnidade = (l: (typeof grupo)[number]) =>
      Number((UNIDADE_AO_CRIAR[l.unidadeTeknisa] ?? l.unidadeTeknisa) === l.unidade);
    const ehConsumo = (l: (typeof grupo)[number]) => Number(!/\(COMPRA\)/i.test(l.teknisa));
    const ordenado = [...grupo].sort((a, b) => casaUnidade(b) - casaUnidade(a) || ehConsumo(b) - ehConsumo(a));
    ligarUnico.push(ordenado[0]);
    codigosDescartados.push({
      produto: `${ordenado[0].nome} [${ordenado[0].unidade}]`,
      ficou: `${ordenado[0].teknisa} [${ordenado[0].unidadeTeknisa}]`,
      caiu: ordenado.slice(1).map((o) => `${o.teknisa} [${o.unidadeTeknisa}]`),
    });
  }
  ligar.length = 0;
  ligar.push(...ligarUnico);

  // Mesma colisão do outro lado: (nome, unidadeMedida) é único em Produto, e
  // duas linhas criando o mesmo nome derrubariam o INSERT inteiro.
  const vistos = new Set<string>();
  const criarUnico: typeof criar = [];
  const criacoesDescartadas: string[] = [];
  for (const c of criar) {
    const k = `${chave(c.nome)}|||${c.unidade}`;
    if (vistos.has(k)) { criacoesDescartadas.push(`${c.nome} [${c.unidade}] cod ${c.codigo}`); continue; }
    vistos.add(k);
    criarUnico.push(c);
  }
  criar.length = 0;
  criar.push(...criarUnico);

  const travados = ligar.filter((l) => l.unidade !== (UNIDADE_AO_CRIAR[l.unidadeTeknisa] ?? l.unidadeTeknisa));

  // ------------------------------------------------------------------ 3a
  const a = `-- PASSO 3a — grava o código do Teknisa nos produtos que JÁ EXISTEM.
-- ${ligar.length} produtos. Gerado de ${arqPlanilha.split("/").pop()}.
--
-- Um comando só, de propósito: ou aplica inteiro, ou dá erro e não aplica
-- nada. Idempotente — só escreve onde codigoTeknisa está nulo.
WITH par(nome, unidade, codigo) AS (VALUES
${ligar.map((l) => `  (${sql(l.nome)}, ${sql(l.unidade)}, ${sql(l.codigo)})`).join(",\n")}
)
UPDATE "Produto" p
SET "codigoTeknisa" = par.codigo
FROM par
WHERE p.nome = par.nome
  AND p."unidadeMedida" = par.unidade
  AND p."codigoTeknisa" IS NULL;

-- Esperado: ${ligar.length} (ou menos, se você já rodou antes).
SELECT count(*) AS produtos_com_codigo FROM "Produto" WHERE "codigoTeknisa" IS NOT NULL;
`;

  // ------------------------------------------------------------------ 3b
  const b = `-- PASSO 3b — cria os produtos que não existem no catálogo, já com código.
-- ${criar.length} produtos.
--
-- O id é determinístico ('tk' + código), então rodar duas vezes não duplica:
-- o ON CONFLICT ignora. Unidade traduzida pras quatro que o cadastro aceita
-- (KG, LT, UND, CX) — embalagem fechada vira CX, item avulso vira UND.
INSERT INTO "Produto" (id, nome, "unidadeMedida", "codigoTeknisa", ativo, "criadoEm")
VALUES
${criar.map((c) => `  ('tk${c.codigo}', ${sql(c.nome)}, ${sql(c.unidade)}, ${sql(c.codigo)}, true, now())`).join(",\n")}
ON CONFLICT (id) DO NOTHING;

-- Esperado: ${criar.length} criados.
SELECT count(*) AS criados_agora FROM "Produto" WHERE id LIKE 'tk%';
`;

  // ------------------------------------------------------------------ 3c
  const c = [
    "nome_no_teknisa,unidade_na_compra,produto_no_cadastro,unidade_no_cadastro",
    ...travados.map((t) => [t.teknisa, t.unidadeTeknisa, t.nome, t.unidade].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  writeFileSync(join(pastaSaida, "3a-ligar-codigos.sql"), a);
  writeFileSync(join(pastaSaida, "3b-criar-produtos.sql"), b);
  writeFileSync(join(pastaSaida, "3c-unidades-a-decidir.csv"), c + "\n");

  console.log(`ligar a produto existente : ${ligar.length}`);
  console.log(`criar produto novo        : ${criar.length}`);
  console.log(`preço travado por unidade : ${travados.length}  (ligam, mas o preço não entra até alguém decidir a unidade)`);
  console.log(`sem tradução de unidade   : ${semTraducao.length}${semTraducao.length ? "  -> " + semTraducao.map((x) => `${x.nome_no_teknisa} [${x.unidade}]`).join(", ") : ""}`);
  console.log(`marcado não, sem resposta : ${pulados.length}${pulados.length ? "  -> " + pulados.join(", ") : ""}`);
  if (codigosDescartados.length) {
    console.log(`\ndois códigos pro mesmo produto (${codigosDescartados.length}) — fica o de consumo:`);
    for (const d of codigosDescartados) console.log(`   ${d.produto}\n      fica: ${d.ficou}\n      cai : ${d.caiu.join(", ")}`);
  }
  if (criacoesDescartadas.length) {
    console.log(`\nprodutos novos repetidos, mantido o primeiro (${criacoesDescartadas.length}):`);
    for (const c of criacoesDescartadas) console.log(`   ${c}`);
  }
}

main();
