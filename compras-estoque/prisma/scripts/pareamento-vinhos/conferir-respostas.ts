// Confere a planilha preenchida ANTES de gerar qualquer SQL.
//
//   npx tsx prisma/scripts/pareamento-vinhos/conferir-respostas.ts \
//       <planilha-preenchida.xlsx> <catalogo.csv> <carta.csv>
//
// POR QUE ISTO EXISTE SEPARADO DO GERADOR. Em 18/09 o SQL de pareamento foi
// gerado e rodado direto: morreu no meio, em Produto_nome_unidadeMedida_key,
// com três colisões que ninguém tinha olhado. Metade das linhas tinha entrado,
// a outra não, e descobrir o que faltava deu mais trabalho que a conferência
// teria dado.
//
// Aqui nada é gerado enquanto houver ERRO. Aviso não trava — é coisa pra ler.
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";

const UNIDADES_VALIDAS = new Set(["KG", "LT", "UND", "CX"]);

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

const txt = (v: unknown) => String(v ?? "").trim();
/** A planilha pode devolver "0,2" ou "0.2" conforme o locale de quem editou. */
const num = (v: unknown) => Number(txt(v).replace(",", "."));

function main() {
  const [arqXlsx, arqCatalogo, arqCarta] = process.argv.slice(2);
  if (!arqXlsx || !arqCatalogo || !arqCarta) {
    console.error("uso: conferir-respostas.ts <planilha.xlsx> <catalogo.csv> <carta.csv>");
    process.exit(1);
  }

  const wb = XLSX.readFile(arqXlsx);
  const aba = (n: string) => XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[n], { defval: "" });
  const vinhos = aba("vinhos");
  const outros = aba("outros");
  const carta = aba("carta-vinhos");

  const catalogo = lerCsv(arqCatalogo);
  const porNomeUnidade = new Map(catalogo.map((p) => [`${p.nome}|||${p.unidade}`, p]));
  const porNomeSemCase = new Map<string, typeof catalogo[0]>();
  for (const p of catalogo) porNomeSemCase.set(`${p.nome.toUpperCase()}|||${p.unidade}`, p);
  const codigosDoCatalogo = new Map(catalogo.filter((p) => txt(p.codigo)).map((p) => [txt(p.codigo), p]));

  const erros: string[] = [];
  const avisos: string[] = [];

  // ---------------------------------------------------------------- decisões
  const decididas = [...vinhos, ...outros].filter((r) => txt(r.decisao));
  const criar = decididas.filter((r) => txt(r.decisao).toLowerCase() === "criar");
  const ligar = decididas.filter((r) => txt(r.decisao).toLowerCase() === "ligar");

  for (const r of decididas) {
    const d = txt(r.decisao).toLowerCase();
    if (!["criar", "ligar", "descartar"].includes(d)) {
      erros.push(`decisão "${r.decisao}" não é criar/ligar/descartar — ${r.nome_no_teknisa}`);
    }
  }

  // LIGAR: o produto tem que existir, e não pode já ter OUTRO código.
  for (const r of ligar) {
    const nome = txt(r.produto_para_ligar);
    if (!nome) {
      erros.push(`ligar sem produto_para_ligar — ${r.nome_no_teknisa} (${r.codigo_teknisa})`);
      continue;
    }
    const un = txt(r.un_sugestao) || txt(r.unidade_ao_criar);
    const p = porNomeUnidade.get(`${nome}|||${un}`) ?? porNomeSemCase.get(`${nome.toUpperCase()}|||${un}`);
    if (!p) {
      erros.push(`ligar em produto que não existe no catálogo: "${nome}" (${un}) — ${r.nome_no_teknisa}`);
      continue;
    }
    const codigoAtual = txt(p.codigo);
    if (codigoAtual && codigoAtual !== txt(r.codigo_teknisa)) {
      erros.push(
        `"${p.nome}" já tem o código ${codigoAtual}; gravar ${r.codigo_teknisa} sobrescreveria o pareamento existente — ${r.nome_no_teknisa}`
      );
    }
  }

  // CRIAR: nome e unidade válidos, sem colidir com o catálogo nem entre si.
  const vistos = new Map<string, string>();
  for (const r of criar) {
    const nome = txt(r.nome_ao_criar);
    const un = txt(r.unidade_ao_criar).toUpperCase();
    if (!nome) { erros.push(`criar sem nome_ao_criar — ${r.nome_no_teknisa} (${r.codigo_teknisa})`); continue; }
    if (!UNIDADES_VALIDAS.has(un)) {
      erros.push(`criar com unidade "${un || "(vazia)"}" — só existe KG, LT, UND, CX — ${nome}`);
      continue;
    }
    const chave = `${nome.toUpperCase()}|||${un}`;
    const jaNoCatalogo = porNomeSemCase.get(chave);
    if (jaNoCatalogo) {
      erros.push(`criar "${nome}" (${un}) mas já existe "${jaNoCatalogo.nome}" no catálogo — seria duplicata`);
    }
    const antes = vistos.get(chave);
    if (antes) erros.push(`dois códigos querem criar o mesmo produto "${nome}" (${un}): ${antes} e ${r.codigo_teknisa}`);
    else vistos.set(chave, txt(r.codigo_teknisa));
  }

  // Dois códigos apontando para o MESMO produto existente. Só um cabe:
  // codigoTeknisa é único e singular, então o segundo UPDATE não acontece e
  // aquela compra fica sem casar, sem reclamar de nada. Apareceu de verdade
  // com "LE PETIT RONAN BY CLIENET" e "RONAN BY CLINET" ligados ambos em
  // "Ronan by Clinet AOC Bordeaux" — são dois vinhos, o segundo rótulo e o
  // principal, e R$ 822 de compra iam sumir do reconhecimento.
  const alvoDoLigar = new Map<string, { codigo: string; nome: string }[]>();
  for (const r of ligar) {
    const nome = txt(r.produto_para_ligar);
    if (!nome) continue;
    const lista = alvoDoLigar.get(nome.toUpperCase()) ?? [];
    lista.push({ codigo: txt(r.codigo_teknisa), nome: txt(r.nome_no_teknisa) });
    alvoDoLigar.set(nome.toUpperCase(), lista);
  }
  for (const [alvo, quem] of alvoDoLigar) {
    if (quem.length > 1) {
      erros.push(
        `${quem.length} códigos ligados no mesmo produto "${alvo}": ${quem.map((q) => `${q.codigo} (${q.nome})`).join(" e ")} — só um cabe, o resto fica sem casar`
      );
    }
  }

  // Código do Teknisa repetido entre decisões, ou já usado por outro produto.
  const porCodigo = new Map<string, string>();
  for (const r of decididas) {
    const c = txt(r.codigo_teknisa);
    if (!c) { erros.push(`linha decidida sem código do Teknisa — ${r.nome_no_teknisa}`); continue; }
    if (porCodigo.has(c)) erros.push(`código ${c} aparece duas vezes nas decisões`);
    porCodigo.set(c, txt(r.nome_no_teknisa));
    const dono = codigosDoCatalogo.get(c);
    if (dono && txt(r.decisao).toLowerCase() === "criar") {
      erros.push(`criar produto para o código ${c}, mas ele já é de "${dono.nome}" — CONFLITO`);
    }
  }

  // ------------------------------------------------------------------ carta
  const cartaPreenchida = carta.filter((r) => txt(r.garrafas_por_venda) !== "");

  // Duas vendas de nomes DIFERENTES apontando para a mesma compra. O
  // casamento carta↔compra é por semelhança, e semelhança erra: "Brunello di
  // Montalcino Pian delle Vigne" (venda R$ 1.484) casou com a compra do
  // "Pian delle Vigne Rosso di Montalcino" (R$ 319,55) — mesma vinícola,
  // vinhos diferentes, e o Brunello nem foi comprado no período. O custo do
  // irmão barato deixaria o CMV bonito e errado.
  //
  // Mesmo nome repetido não é problema: é a carta com linha duplicada, ou taça
  // e garrafa do mesmo vinho.
  const vendasPorCodigo = new Map<string, Set<string>>();
  for (const r of cartaPreenchida) {
    if (txt(r.ja_tem_ficha)) continue;
    const cod = txt(r.codigo_teknisa);
    if (!cod) continue;
    const s = vendasPorCodigo.get(cod) ?? new Set<string>();
    s.add(txt(r.nome_na_carta));
    vendasPorCodigo.set(cod, s);
  }
  for (const [cod, nomes] of vendasPorCodigo) {
    if (nomes.size > 1) {
      erros.push(`a compra ${cod} foi casada com vendas de nomes diferentes: ${[...nomes].map((n) => `"${n}"`).join(" e ")} — no máximo uma está certa`);
    }
  }
  for (const r of cartaPreenchida) {
    const q = num(r.garrafas_por_venda);
    const nome = txt(r.nome_na_carta);
    if (!Number.isFinite(q) || q <= 0) {
      erros.push(`quantidade inválida "${r.garrafas_por_venda}" — ${nome}`);
      continue;
    }
    if (q > 1) avisos.push(`${nome}: ${q} garrafas por venda — confirmar que não é engano`);
    if (txt(r.ja_tem_ficha)) {
      avisos.push(`${nome} já tem ficha e veio preenchido — vai ser IGNORADO, ficha existente não é tocada`);
      continue;
    }
    const cod = txt(r.codigo_teknisa);
    if (!cod) { erros.push(`${nome} tem quantidade mas nenhuma compra correspondente — sem Produto não há custo`); continue; }
    if (!porCodigo.has(cod)) {
      erros.push(`${nome} aponta para o código ${cod}, que não foi decidido na aba vinhos/outros`);
    }
    // Custo resultante: dá pra conferir contra o preço de venda.
    const custo = num(r.custo_da_garrafa) * q;
    const venda = num(r.preco_venda);
    if (custo > 0 && venda > 0) {
      const cmv = custo / venda;
      if (cmv > 0.9) erros.push(`${nome}: custo R$ ${custo.toFixed(2)} contra venda R$ ${venda} = CMV ${(cmv * 100).toFixed(0)}% — impossível`);
      else if (cmv > 0.6) avisos.push(`${nome}: CMV ${(cmv * 100).toFixed(0)}% (custo R$ ${custo.toFixed(2)}, venda R$ ${venda}) — alto, conferir`);
      else if (cmv < 0.08) avisos.push(`${nome}: CMV ${(cmv * 100).toFixed(0)}% — baixo demais, conferir a quantidade`);
    }
  }

  // ----------------------------------------------------------------- relato
  console.log(`decisões: ${criar.length} criar, ${ligar.length} ligar, ${decididas.length - criar.length - ligar.length} descartar`);
  console.log(`carta: ${cartaPreenchida.length} vendas com quantidade`);
  console.log(`\n${erros.length} ERRO(S)${erros.length ? " — nada é gerado enquanto existirem" : ""}`);
  for (const e of erros) console.log("  ✗", e);
  console.log(`\n${avisos.length} aviso(s) — ler, não travam`);
  for (const a of avisos) console.log("  ·", a);

  if (erros.length) process.exit(1);
}

main();
