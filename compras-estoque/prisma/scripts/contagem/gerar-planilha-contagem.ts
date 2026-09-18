// Monta a planilha de contagem a partir do CSV das curvas A e B
// (curva-abc-e-blocos.sql, consulta 2). Uma aba por semana do mês.
//
//   npx tsx prisma/scripts/contagem/gerar-planilha-contagem.ts <curva-a-e-b.csv> [saida.xlsx]
//
// A ROTAÇÃO. Curva A em dois grupos, curva B em quatro; a semana conta um de
// cada. Cada item da A cai de quinze em quinze dias e cada um da B, uma vez por
// mês — frequência seguindo valor, que é a razão de existir a curva.
//
//   semana 1: A1 + B1      semana 3: A1 + B3
//   semana 2: A2 + B2      semana 4: A2 + B4
//
// A CONTAGEM É CEGA, de propósito: a planilha NÃO mostra o saldo do sistema.
//
// Quem conta olhando o número esperado tende a confirmar o número esperado —
// escreve 12 porque viu 12, não porque contou 12. O valor inteiro deste
// trabalho está na diferença entre o que o sistema acha e o que existe na
// prateleira; mostrar a resposta antes destrói a medida. O saldo aparece
// depois, na tela que recebe a contagem.
import { readFileSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";

/**
 * Marca a bebida pronta na coluna de observação. Ela entra na contagem (é
 * estoque que some, e sumir bebida é caro) mas não entra no CMV de cozinha —
 * é revenda, com margem própria. Quem conta não precisa saber disso; quem lê o
 * resultado, sim.
 */
const REVENDA =
  /COCA COLA|GUARANA|AGUA TONICA|AGUA PRATA|ACQUISSIMA|RED BULL|ENERGETICO|H2O |GATORADE|TODDYNHO|CERVEJA|CORONA|SPATEN|STELLA|CHOPP|APEROL|APERITIVO|CAMPARI|VODKA|TEQUILA|ESPUMANTE|CHARDONNAY|MALBEC|CRIANZA|CARMENERE|WINE|LICOR|CUVEE|MASCARA DE FUEGO|MÁSCARA DE FUEGO/i;

/** semana -> [grupo da curva A, grupo da curva B] */
const SEMANAS: Record<number, [number, number]> = { 1: [1, 1], 2: [2, 2], 3: [1, 3], 4: [2, 4] };

function lerCsv(caminho: string): Record<string, string>[] {
  const linhas = readFileSync(caminho, "utf8").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
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
  const [arq, saida = "contagem-104-sul.xlsx"] = process.argv.slice(2);
  if (!arq) {
    console.error("uso: gerar-planilha-contagem.ts <curva-a-e-b.csv> [saida.xlsx]");
    process.exit(1);
  }
  const itens = lerCsv(arq);
  const wb = XLSX.utils.book_new();

  for (const semana of [1, 2, 3, 4]) {
    const [grupoA, grupoB] = SEMANAS[semana];
    const daSemana = itens
      .filter((i) => (i.classe === "A" && Number(i.grupo) === grupoA) || (i.classe === "B" && Number(i.grupo) === grupoB))
      // Ordem alfabética, e não por valor: quem conta procura pelo nome na
      // prateleira. A classe some da vista de propósito — saber que um item
      // "vale mais" convida a caprichar nele e correr nos outros.
      .sort((a, b) => a.produto.localeCompare(b.produto, "pt-BR"));

    const linhas = [
      ["CONTAGEM DE ESTOQUE — 104 Sul", "", "", "", ""],
      [`Semana ${semana}`, `${daSemana.length} itens`, "", "", ""],
      ["Data:", "", "Contado por:", "", ""],
      ["", "", "", "", ""],
      ["#", "produto", "unidade", "quantidade contada", "observação"],
      ...daSemana.map((i, n) => [n + 1, i.produto, i.unidade, "", REVENDA.test(i.produto) ? "revenda" : ""]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(linhas);
    ws["!cols"] = [{ wch: 4 }, { wch: 52 }, { wch: 9 }, { wch: 20 }, { wch: 22 }];
    ws["!freeze"] = { xSplit: 0, ySplit: 5 };
    XLSX.utils.book_append_sheet(wb, ws, `Semana ${semana}`);

    const valor = daSemana.reduce((s, i) => s + Number(i.valor_comprado || 0), 0);
    console.log(
      `Semana ${semana}: ${String(daSemana.length).padStart(2)} itens (A${grupoA} + B${grupoB})  R$ ${valor.toFixed(2)}`
    );
  }

  writeFileSync(saida, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  console.log(`\n${saida}`);
}

main();
