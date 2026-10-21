// Duas provas sobre a carga de venda sob concorrência:
//
//   1. Quando a transação falha, NADA fica gravado — nem a VendaSemanal, nem
//      a baixa de estoque, nem o pedido. É o que responde "posso reenviar sem
//      esbarrar no 409?": pode, porque não sobrou nada.
//
//   2. Duas cargas simultâneas que tocam os MESMOS produtos passam as duas.
//      É o que a ordem estável de bloqueio compra (ordem-de-bloqueio.ts).
//
//   DATABASE_URL=postgresql://.../banco_de_teste \
//     npx tsx prisma/scripts/_provar-rollback-venda.ts
//
// Em 21/10 três semanas do Beira Lago foram enviadas juntas: a de 20/10 passou
// e as de 01–05 e 06–12 morreram com "deadlock detected" no upsert de
// EstoqueSaldo.
import { PrismaClient } from "@prisma/client";
import { processarVendaSemanal } from "@/lib/venda-semanal";
import { N8N_SERVICE_USER_EMAIL } from "@/lib/constants";

const prisma = new PrismaClient();
const CASA = "Casa do rollback";
const QUANTOS_PRODUTOS = 12;

async function main() {
  if (!/teste|test|local/i.test(process.env.DATABASE_URL ?? "")) {
    console.error("recusado: DATABASE_URL não parece um banco de teste");
    process.exit(1);
  }
  const falhas: string[] = [];
  const servico = await prisma.usuario.upsert({
    where: { email: N8N_SERVICE_USER_EMAIL }, update: {},
    create: { nome: "n8n", email: N8N_SERVICE_USER_EMAIL, senhaHash: "x", papel: "ADMIN" },
  });
  const u = await prisma.unidade.upsert({ where: { nome: CASA }, update: {}, create: { nome: CASA } });

  // ---------------------------------------------------------------- prova 1
  const antes = {
    vendas: await prisma.vendaSemanal.count(),
    movimentos: await prisma.movimentoEstoque.count(),
  };
  let estourou = false;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.vendaSemanal.create({
        data: { unidadeId: u.id, periodoInicio: new Date("2026-10-01"), periodoFim: new Date("2026-10-05"), importadoPorId: servico.id },
      });
      // ...e morre depois de já ter escrito, que é o caso do deadlock.
      throw new Error("deadlock detected");
    });
  } catch {
    estourou = true;
  }
  const depois = {
    vendas: await prisma.vendaSemanal.count(),
    movimentos: await prisma.movimentoEstoque.count(),
  };
  console.log(`1. transacao que morre depois de escrever: vendas ${antes.vendas} -> ${depois.vendas}`);
  if (!estourou) falhas.push("a transacao devia ter estourado");
  if (depois.vendas !== antes.vendas) falhas.push(`VendaSemanal ficou gravada: ${antes.vendas} -> ${depois.vendas}`);
  if (depois.movimentos !== antes.movimentos) falhas.push("MovimentoEstoque ficou gravado");

  // ---------------------------------------------------------------- prova 2
  const produtos = [];
  for (let n = 0; n < QUANTOS_PRODUTOS; n++) {
    const p = await prisma.produto.create({ data: { nome: `INSUMO ${n}`, unidadeMedida: "KG" } });
    await prisma.estoqueSaldo.create({ data: { unidadeId: u.id, produtoId: p.id, quantidade: 1000 } });
    produtos.push(p);
  }
  // Duas fichas com os MESMOS insumos em ordens opostas: é o que fazia as duas
  // cargas pegarem as linhas em sentidos contrários.
  const fichaA = await prisma.receita.create({
    data: { unidadeId: u.id, nome: "FICHA A",
      ingredientes: { create: produtos.map((p) => ({ produtoId: p.id, quantidade: 1, unidadeMedida: "KG" })) } },
  });
  const fichaB = await prisma.receita.create({
    data: { unidadeId: u.id, nome: "FICHA B",
      ingredientes: { create: [...produtos].reverse().map((p) => ({ produtoId: p.id, quantidade: 1, unidadeMedida: "KG" })) } },
  });
  await prisma.itemVenda.create({ data: { unidadeId: u.id, tipo: "PRATO", nome: "A", precoVenda: 10, codigoPdv: "A", receitaId: fichaA.id } });
  await prisma.itemVenda.create({ data: { unidadeId: u.id, tipo: "PRATO", nome: "B", precoVenda: 10, codigoPdv: "B", receitaId: fichaB.id } });

  const resultados = await Promise.allSettled([
    processarVendaSemanal(CASA, "2026-11-02", "2026-11-08", [{ nome: "A", codigo: "A", quantidadeVendida: 5, valorTotal: 50 }], servico.id),
    processarVendaSemanal(CASA, "2026-11-09", "2026-11-15", [{ nome: "B", codigo: "B", quantidadeVendida: 5, valorTotal: 50 }], servico.id),
  ]);
  const quebrou = resultados.filter((r) => r.status === "rejected");
  console.log(`2. duas cargas simultaneas nos mesmos ${QUANTOS_PRODUTOS} produtos: ${resultados.length - quebrou.length}/2 passaram`);
  for (const r of quebrou) console.log("   erro:", String((r as PromiseRejectedResult).reason?.message).slice(0, 80));
  if (quebrou.length > 0) falhas.push(`${quebrou.length} das 2 cargas simultaneas falharam`);

  const saldo = await prisma.estoqueSaldo.findFirst({ where: { produtoId: produtos[0].id } });
  console.log(`   saldo do primeiro insumo: ${saldo?.quantidade}  (esperado 990 = 1000 - 5 - 5)`);
  if (saldo?.quantidade !== 990) falhas.push(`saldo devia ser 990, e ${saldo?.quantidade}`);

  console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nOK");
  for (const f of falhas) console.log("  ✗", f);
  await prisma.$disconnect();
  if (falhas.length) process.exit(1);
}
main();
