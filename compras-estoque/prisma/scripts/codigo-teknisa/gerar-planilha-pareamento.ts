// Cruza as linhas de compra que não casaram (exportadas de ItemNotaCompra)
// contra o catálogo de Produto sem código, e monta a planilha de conferência.
//
// COMO USAR
//   npx tsx prisma/scripts/codigo-teknisa/gerar-planilha-pareamento.ts \
//       <nao-reconhecidos.csv> <catalogo.csv> [saida.xlsx]
//
// Os dois CSV saem do Neon, das consultas em 2-exportar-nao-reconhecidos.sql
// e da lista de Produto sem codigoTeknisa.
//
// O QUE ELE FAZ, e o que NÃO faz. Ele PROPÕE pares e mede a confiança; quem
// decide é gente. Nenhuma saída deste script grava nada — o produto dele é uma
// planilha pra conferir. O princípio é o mesmo dos pares do PDV: casar por
// aproximação de texto sem revisão é como se grava preço no produto errado.
//
// A classificação em faixas existe porque 275 decisões seguidas ninguém
// aguenta. Separando por confiança, a maior parte vira leitura rápida de
// confirmação e sobra um punhado de casos que exigem pensar.
import { readFileSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";

// --------------------------------------------------------------------------
// Normalização
// --------------------------------------------------------------------------

/**
 * Tira acento. O catálogo escreve "FILÉ DE PEITO DE FRANGO" e o Teknisa manda
 * "FILE DE PEITO DE FRANGO KG" — mesma palavra, e `chaveComparacao` (que só
 * faz lowercase) não junta as duas. É a diferença mais barata de resolver
 * neste levantamento inteiro.
 */
function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const SINONIMO_UNIDADE: Record<string, string> = { UN: "UND", UNIDADE: "UND", UNI: "UND", UNID: "UND", PC: "UND", L: "LT" };
const un = (u: string) => SINONIMO_UNIDADE[u.trim().toUpperCase()] ?? u.trim().toUpperCase();

/** Palavras que só descrevem a embalagem/origem da compra, não o produto. */
const RUIDO = new Set(["COMPRA", "KG", "LT", "L", "UN", "UND", "UNID", "UNIDADE", "GR", "G", "ML", "CX", "FD", "PC", "PT", "BD", "BG", "GA", "LA", "BB", "BBL", "GF", "FT", "RL", "BOB", "PR", "DE", "DA", "DO", "E", "C", "S", "P"]);

/**
 * Corta a desinência de gênero/número. "ALCATRA BOVINA (COMPRA)" no Teknisa é
 * "ALCATRA BOVINO KG" no catálogo — a mesma carne, escrita no outro gênero.
 * É tosco como radical de português, mas é aplicado dos dois lados igual, e
 * aqui ele só SUGERE: quem confirma é gente.
 */
function radical(t: string): string {
  return t.length >= 5 ? t.replace(/(?:[AO]S?|S)$/, "") : t;
}

function tokens(nome: string): string[] {
  return semAcento(nome)
    .toUpperCase()
    .replace(/\([^)]*\)/g, " ")         // "(COMPRA)", "(IFOOD)"
    // "S/SAL" é SEM SAL e "C/ CABO" é COM CABO. Sem isto, o "S" e o "C" viram
    // ruído e o cruzador sugere "RODO COM CABO" pra "RODO SEM CABO" — o
    // oposto exato. Tem que virar palavra antes de partir em tokens.
    .replace(/\bS\s*\//g, " SEM ")
    .replace(/\bC\s*\//g, " COM ")
    .replace(/[^A-Z0-9]+/g, " ")        // pontuação, barra, vírgula
    .split(" ")
    .filter((t) => t && !RUIDO.has(t) && !/^\d+(X\d+)?$/.test(t)) // "5X2", "100", "330"
    .map(radical);
}

function chave(nome: string): string {
  return tokens(nome).join(" ");
}

/** Dice sobre conjuntos: 2·|A∩B| / (|A|+|B|). 1 = mesmos elementos. */
function dice(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let comuns = 0;
  for (const t of a) if (b.has(t)) comuns++;
  return (2 * comuns) / (a.size + b.size);
}

function trigramas(s: string): Set<string> {
  const t = ` ${s} `;
  const out = new Set<string>();
  for (let i = 0; i + 3 <= t.length; i++) out.add(t.slice(i, i + 3));
  return out;
}

/**
 * Comparação por token pega "ALCATRA BOVINA" x "ALCATRA BOVINO". Não pega
 * "MOZZARELLA" x "QUEIJO MOZZARELA" nem "CHORIZO CANTIMPLALO" x "CHORIZO
 * CANTIPALO": ali a diferença é DENTRO da palavra, letra trocada ou dobrada.
 * Trigrama pega essas. Fica com desconto porque erra mais — palavra parecida
 * nem sempre é a mesma coisa —, então empata pra baixo contra um acerto de
 * token, e nunca sozinho decide nada: cai na planilha pra gente olhar.
 */
function similaridade(aTok: string[], bTok: string[], aStr: string, bStr: string): number {
  return Math.max(dice(new Set(aTok), new Set(bTok)), dice(trigramas(aStr), trigramas(bStr)) * 0.9);
}

// --------------------------------------------------------------------------
// CSV (o do Neon vem com aspas em tudo e vírgula como separador)
// --------------------------------------------------------------------------
function lerCsv(caminho: string): Record<string, string>[] {
  const linhas = readFileSync(caminho, "utf8").split(/\r?\n/).filter((l) => l.trim() !== "");
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
  const cabecalho = partir(linhas[0]);
  return linhas.slice(1).map((l) => Object.fromEntries(partir(l).map((v, i) => [cabecalho[i], v])));
}

// --------------------------------------------------------------------------
// Tipo — pra priorizar, não pra decidir
//
// 275 decisões seguidas ninguém faz com atenção até o fim. Só o INSUMO mexe no
// CMV: é o que entra em ficha técnica. REVENDA (vinho, cerveja, refrigerante)
// tem margem própria e precisa do custo, mas não de ficha. EMBALAGEM e LIMPEZA
// não entram em ficha nenhuma — são custo de operação. FUNCIONARIO é refeição
// de equipe: custo real, que não é CMV de venda.
//
// A classificação é por palavra-chave e erra. Ela ordena a planilha; não
// decide nada.
// --------------------------------------------------------------------------
const PALAVRAS_TIPO: [RegExp, string][] = [
  [/FUNCIONARIO|FUNCIONÁRIO/i, "4 funcionario"],
  [/DETERGENTE|DESINFETANTE|ALCOOL 70|AGUA SANITARIA|SACTIF|SUMA |MAX DET|RODO |VASSOURA|PANO |ESPONJA|PULVERIZADOR|HIGIENIZADOR|SECANTE|PASTILHA RATIONAL|CABO MADEIRA|PA PARA LIXO|ENXAGUANTE/i, "5 limpeza"],
  [/EMBALAGEM|SACO |SACOLA|POTE |TAMPA |BANDEJA|CAIXA PAPELAO|GUARDANAPO|CANUDO|DISCO ISOPOR|BB PIC|DIVISORIA|PAPEL |LUVA |TOUCA|AVENTAL|GARRAFA TRANSP|KIT GARFO|FIO DENTAL|PLASTICO FILME/i, "3 embalagem"],
  [/CERVEJA|CORONA|CORONITA|SPATEN|STELLA|BUDWEISEN|CHOPP|COCA COLA|GUARANA|AGUA TONICA|AGUA PRATA|ACQUISSIMA|RED BULL|ENERGETICO|H2O |GATORADE|TODDYNHO|SUCO |LICOR|VODKA|TEQUILA|CAMPARI|APEROL|ESPUMANTE|CAVE |SAKE|VERMOUTH|WINE|CHARDONNAY|MALBEC|CRIANZA|PRIMITIVO|CARMENERE|SANGIOVESE|TINTO|ROSSO|ROSE |BRUT|BOMBONIERE|BARRA PROTEINA|MENTOS|KINDER|CAFE EM GRAO|TUILE|BRUTTI|MIX DE COOKIE|SLICE CAKE|FATIA BOLO|CONG\. PIZZA/i, "2 revenda"],
];

function tipoDe(nome: string): string {
  for (const [re, tipo] of PALAVRAS_TIPO) if (re.test(nome)) return tipo;
  return "1 insumo";
}

type Candidato = { nome: string; unidade: string; score: number; mesmaUnidade: boolean };

function main() {
  const [arqCompras, arqCatalogo, saida = "pareamento-codigo-teknisa.xlsx"] = process.argv.slice(2);
  if (!arqCompras || !arqCatalogo) {
    console.error("uso: gerar-planilha-pareamento.ts <nao-reconhecidos.csv> <catalogo.csv> [saida.xlsx]");
    process.exit(1);
  }

  const compras = lerCsv(arqCompras);
  const catalogo = lerCsv(arqCatalogo).map((p) => ({
    nome: p.nome,
    unidade: un(p.unidade),
    ativo: p.ativo === "t",
    tokens: tokens(p.nome),
    chave: chave(p.nome),
  }));

  // Índice por chave normalizada. Lista, não valor único: se dois produtos
  // diferentes colapsam na mesma chave (ex.: só o acento os separava), isso é
  // ambiguidade e precisa de gente — nunca escolher um dos dois no escuro.
  const porChave = new Map<string, typeof catalogo>();
  for (const p of catalogo) {
    const lista = porChave.get(p.chave) ?? [];
    lista.push(p);
    porChave.set(p.chave, lista);
  }

  const linhas = compras.map((c) => {
    const nomeTeknisa = c.nome_no_teknisa;
    const unidadeTeknisa = un(c.unidade);
    const tk = tokens(nomeTeknisa);
    const ch = chave(nomeTeknisa);

    const exatos = porChave.get(ch) ?? [];
    let candidatos: Candidato[];
    let faixa: string;

    if (exatos.length === 1) {
      const p = exatos[0];
      candidatos = [{ nome: p.nome, unidade: p.unidade, score: 1, mesmaUnidade: p.unidade === unidadeTeknisa }];
      faixa = candidatos[0].mesmaUnidade ? "A - nome idêntico" : "B - nome idêntico, unidade diferente";
    } else if (exatos.length > 1) {
      candidatos = exatos.map((p) => ({ nome: p.nome, unidade: p.unidade, score: 1, mesmaUnidade: p.unidade === unidadeTeknisa }));
      faixa = "C - mais de um produto com esse nome";
    } else {
      candidatos = catalogo
        .map((p) => ({
          nome: p.nome,
          unidade: p.unidade,
          score: similaridade(tk, p.tokens, ch, p.chave),
          mesmaUnidade: p.unidade === unidadeTeknisa,
        }))
        .filter((x) => x.score >= 0.5)
        .sort((a, b) => b.score - a.score || Number(b.mesmaUnidade) - Number(a.mesmaUnidade))
        .slice(0, 3);
      faixa =
        candidatos.length === 0 ? "E - sem candidato (produto novo?)"
        : candidatos[0].score >= 0.8 ? "C - parecido, confirmar"
        : "D - parecido de longe";
    }

    return {
      tipo: tipoDe(nomeTeknisa),
      faixa,
      codigo_teknisa: c.codigo_teknisa,
      nome_no_teknisa: nomeTeknisa,
      unidade: unidadeTeknisa,
      casas: c.casas,
      preco_unitario: Number(c.preco_unitario),
      sugestao: candidatos[0]?.nome ?? "",
      unidade_da_sugestao: candidatos[0]?.unidade ?? "",
      semelhanca: candidatos[0] ? Number(candidatos[0].score.toFixed(2)) : "",
      outras_opcoes: candidatos.slice(1).map((x) => `${x.nome} (${x.unidade})`).join(" | "),
      // Faixa A é diferença só de acento/caixa — vem marcada, pra ser lida e
      // não digitada. Todo o resto nasce em branco: é decisão de gente.
      confirma: faixa.startsWith("A") ? "sim" : "",
      se_nao_qual_produto: "",
    };
  });

  linhas.sort(
    (a, b) =>
      a.tipo.localeCompare(b.tipo) ||
      a.faixa.localeCompare(b.faixa) ||
      a.nome_no_teknisa.localeCompare(b.nome_no_teknisa)
  );

  console.log(`${linhas.length} códigos do Teknisa sem produto, contra ${catalogo.length} produtos sem código.\n`);
  const cruz = new Map<string, number>();
  for (const l of linhas) cruz.set(`${l.tipo}\t${l.faixa}`, (cruz.get(`${l.tipo}\t${l.faixa}`) ?? 0) + 1);
  let tipoAtual = "";
  for (const [k, n] of [...cruz.entries()].sort()) {
    const [tipo, faixa] = k.split("\t");
    if (tipo !== tipoAtual) {
      const total = linhas.filter((l) => l.tipo === tipo).length;
      console.log(`\n${tipo}  (${total})`);
      tipoAtual = tipo;
    }
    console.log(`  ${String(n).padStart(4)}  ${faixa}`);
  }

  const ws = XLSX.utils.json_to_sheet(linhas);
  ws["!cols"] = [{ wch: 14 }, { wch: 34 }, { wch: 15 }, { wch: 50 }, { wch: 8 }, { wch: 20 }, { wch: 12 }, { wch: 45 }, { wch: 10 }, { wch: 11 }, { wch: 60 }, { wch: 10 }, { wch: 40 }];
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: linhas.length, c: 12 } }) };
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "pareamento");
  writeFileSync(saida, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  console.log(`\n${saida}`);
}

main();
