// Monta a planilha de contagem a partir do CSV da curva A (uma aba por bloco).
//
//   npx tsx prisma/scripts/contagem/gerar-planilha-contagem.ts <curva-a.csv> [saida.xlsx]
//
// A CONTAGEM É CEGA, de propósito: a planilha NÃO mostra o saldo do sistema.
//
// Quem conta olhando o número esperado tende a confirmar o número esperado —
// escreve 12 porque viu 12, não porque contou 12. O valor inteiro deste
// trabalho está na diferença entre o que o sistema acha e o que existe na
// prateleira; mostrar a resposta antes destrói a medida. O saldo do sistema
// aparece depois, na tela que recebe a contagem.
//
// Uma aba por bloco porque a rotação é semanal: a pessoa abre a aba da semana
// e conta 19 itens, sem procurar quais são os dela no meio de 76.
import { readFileSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";

/**
 * Classificação grosseira, só pra quem conta saber o que está pegando — e pra
 * separar depois o que entra no CMV do que é custo de operação. Embalagem e
 * limpeza são estoque de verdade e valem contagem, mas não são insumo de
 * cozinha e não entram na conta do prato.
 */
const NAO_E_COZINHA =
  /TAMPA|SACO |SACOLA|EMBALAGEM|POTE |GUARDANAPO|PAPEL TOALHA|PANO MULTIUSO|PLASTICO FILME|DETERGENTE|ALCOOL 70|MAX DET|SECANTE|PASTILHA RATIONAL|BOBINA|LUVA |TOUCA|AVENTAL|DISCO ISOPOR|CANUDO|BB PIC|DIVISORIA/i;

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
    console.error("uso: gerar-planilha-contagem.ts <curva-a.csv> [saida.xlsx]");
    process.exit(1);
  }
  const itens = lerCsv(arq);
  const wb = XLSX.utils.book_new();

  for (const bloco of [1, 2, 3, 4]) {
    const doBloco = itens
      .filter((i) => Number(i.bloco) === bloco)
      .sort((a, b) => a.produto.localeCompare(b.produto)); // ordem alfabética: quem conta procura pelo nome, não pelo valor

    const linhas = [
      ["CONTAGEM DE ESTOQUE — 104 Sul", "", "", "", ""],
      [`Bloco ${bloco} de 4`, `${doBloco.length} itens`, "", "", ""],
      ["Data:", "", "Contado por:", "", ""],
      ["", "", "", "", ""],
      ["#", "produto", "unidade", "quantidade contada", "observação"],
      ...doBloco.map((i, n) => [
        n + 1,
        i.produto,
        i.unidade,
        "",
        NAO_E_COZINHA.test(i.produto) ? "embalagem/limpeza" : "",
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(linhas);
    ws["!cols"] = [{ wch: 4 }, { wch: 52 }, { wch: 9 }, { wch: 20 }, { wch: 22 }];
    ws["!freeze"] = { xSplit: 0, ySplit: 5 };
    XLSX.utils.book_append_sheet(wb, ws, `Bloco ${bloco}`);
    console.log(`Bloco ${bloco}: ${doBloco.length} itens`);
  }

  writeFileSync(saida, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  console.log(`\n${saida}`);
}

main();
