// Prova que o faturamento passa a ser o DECLARADO pela origem, e que a linha
// sem valor continua sendo estimada pelo preço cadastrado.
//
//   DATABASE_URL=postgresql://.../banco_de_teste \
//     npx tsx prisma/scripts/_provar-faturamento-declarado.ts
//
// Os números são os reais do Beira Lago: FILETTO DI MANZO cadastrado a R$ 155
// quando o cardápio já cobrava R$ 175, e a garrafa de cortesia lançada a
// R$ 0,01 que o recálculo valorizava a R$ 400.
import { PrismaClient } from "@prisma/client";
import { processarVendaSemanal } from "@/lib/venda-semanal";
import { faturamentoDaLinhaPura } from "@/lib/faturamento";
import { N8N_SERVICE_USER_EMAIL } from "@/lib/constants";

const prisma = new PrismaClient();
const CASA = "Casa do faturamento";

async function main() {
  if (!/teste|test|local/i.test(process.env.DATABASE_URL ?? "")) {
    console.error("recusado: DATABASE_URL não parece um banco de teste");
    process.exit(1);
  }
  const servico = await prisma.usuario.upsert({
    where: { email: N8N_SERVICE_USER_EMAIL }, update: {},
    create: { nome: "n8n", email: N8N_SERVICE_USER_EMAIL, senhaHash: "x", papel: "ADMIN" },
  });
  const u = await prisma.unidade.upsert({ where: { nome: CASA }, update: {}, create: { nome: CASA } });
  await prisma.itemVenda.create({
    data: { unidadeId: u.id, tipo: "PRATO", nome: "Filetto di Manzo", precoVenda: 155, codigoPdv: "F1" },
  });
  await prisma.itemVenda.create({
    data: { unidadeId: u.id, tipo: "VINHO", nome: "Marques de Borba", precoVenda: 400, codigoPdv: "V1" },
  });
  await prisma.itemVenda.create({
    data: { unidadeId: u.id, tipo: "PRATO", nome: "Couvert", precoVenda: 21, codigoPdv: "C1" },
  });

  await processarVendaSemanal(CASA, "2026-10-13", "2026-10-19", [
    // cardápio já cobra 175; o cadastro ficou em 155
    { nome: "Filetto di Manzo", codigo: "F1", quantidadeVendida: 81, valorTotal: 14175 },
    // cortesia: 3 garrafas a R$ 0,01
    { nome: "Marques de Borba", codigo: "V1", quantidadeVendida: 3, valorTotal: 0.03 },
    // origem antiga: manda só quantidade
    { nome: "Couvert", codigo: "C1", quantidadeVendida: 50 },
  ], servico.id);

  const linhas = await prisma.itemVendaSemanal.findMany({
    where: { vendaSemanal: { unidadeId: u.id } },
    select: { nomeBruto: true, quantidadeVendida: true, valorVendido: true, itemVenda: { select: { precoVenda: true } } },
  });
  let declarado = 0, recalculado = 0;
  for (const l of linhas) {
    declarado += faturamentoDaLinhaPura({
      quantidadeVendida: l.quantidadeVendida, valorVendido: l.valorVendido, precoVenda: l.itemVenda?.precoVenda,
    });
    recalculado += l.quantidadeVendida * (l.itemVenda?.precoVenda ?? 0);
    console.log(`  ${l.nomeBruto.padEnd(20)} qtd ${String(l.quantidadeVendida).padStart(5)}  declarado ${l.valorVendido ?? "—"}`);
  }
  console.log(`\nfaturamento DECLARADO   R$ ${declarado.toFixed(2)}`);
  console.log(`faturamento recalculado R$ ${recalculado.toFixed(2)}   <- o jeito antigo`);

  const falhas: string[] = [];
  // 14175 + 0,03 + (50 x 21) = 15225,03
  if (Math.abs(declarado - 15225.03) > 0.001) falhas.push(`declarado devia ser 15.225,03, deu ${declarado}`);
  // 81x155 + 3x400 + 50x21 = 12555 + 1200 + 1050 = 14805
  if (Math.abs(recalculado - 14805) > 0.001) falhas.push(`recalculado devia ser 14.805, deu ${recalculado}`);
  if (declarado <= recalculado) falhas.push("o recalculo devia SUBESTIMAR o faturamento neste cenario");
  const semValor = linhas.filter((l) => l.valorVendido == null);
  if (semValor.length !== 1 || semValor[0].nomeBruto !== "Couvert") {
    falhas.push(`só o Couvert devia ficar sem valor declarado; ficaram ${semValor.map((l) => l.nomeBruto).join(", ")}`);
  }
  console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nOK");
  for (const f of falhas) console.log("  ✗", f);
  await prisma.$disconnect();
  if (falhas.length) process.exit(1);
}
main();
