// Reproduz a primeira carga de vendas do Beira Lago e prova que o
// reprocessamento resolve sem baixar estoque em dobro.
//
//   DATABASE_URL=postgresql://.../banco_de_teste \
//     npx tsx prisma/scripts/_provar-reprocessamento-vendas.ts
//
// NUNCA rode contra produção.
import { PrismaClient } from "@prisma/client";
import { processarVendaSemanal, VendaSemanalDuplicadaError } from "@/lib/venda-semanal";
import { reprocessarVendasNaoReconhecidas } from "@/lib/reprocessar-vendas";
import { N8N_SERVICE_USER_EMAIL } from "@/lib/constants";

const prisma = new PrismaClient();
const CASA = "Casa de vendas";

async function estado(produtoId: string) {
  const s = await prisma.estoqueSaldo.findFirst({ where: { produtoId } });
  const m = await prisma.movimentoEstoque.count({ where: { produtoId, tipo: "SAIDA_CONSUMO" } });
  const semItem = await prisma.itemVendaSemanal.count({ where: { itemVendaId: null } });
  return { saldo: s?.quantidade ?? 0, movimentos: m, semItem };
}

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
  const massa = await prisma.produto.create({ data: { nome: "MASSA", unidadeMedida: "KG" } });
  await prisma.estoqueSaldo.create({ data: { unidadeId: u.id, produtoId: massa.id, quantidade: 100 } });
  const ficha = await prisma.receita.create({
    data: { unidadeId: u.id, nome: "FICHA SPAG", ingredientes: { create: [{ produtoId: massa.id, quantidade: 0.2, unidadeMedida: "KG" }] } },
  });
  // Só UM item cadastrado, com código — como no Beira Lago, onde 29 de 231 casaram.
  await prisma.itemVenda.create({
    data: { unidadeId: u.id, tipo: "PRATO", nome: "SPAGHETTI", precoVenda: 58, codigoPdv: "111", receitaId: ficha.id },
  });

  const itens = [
    { nome: "SPAGHETTI", codigo: "111", quantidadeVendida: 10 },
    { nome: "TIRAMISU", codigo: "222", quantidadeVendida: 39 },
  ];

  const c1 = await processarVendaSemanal(CASA, "2026-10-13", "2026-10-19", itens, servico.id);
  const e1 = await estado(massa.id);
  console.log(`1. carga:  casadosPorCodigo=${c1.casadosPorCodigo} casadosPorNome=${c1.casadosPorNome} naoReconhecidos=${c1.naoReconhecidos.length}  saldo=${e1.saldo}  linhas sem item=${e1.semItem}`);

  // 2. Reenviar a mesma semana: 409 — e e por isso que o reprocessamento existe.
  let deu409 = false;
  try { await processarVendaSemanal(CASA, "2026-10-13", "2026-10-19", itens, servico.id); }
  catch (e) { deu409 = e instanceof VendaSemanalDuplicadaError; }
  console.log(`2. reenvio da mesma semana: ${deu409 ? "recusado (409)" : "NAO recusado"}`);

  // 3. Agora o TIRAMISU e cadastrado, com ficha.
  const ficha2 = await prisma.receita.create({
    data: { unidadeId: u.id, nome: "FICHA TIRA", ingredientes: { create: [{ produtoId: massa.id, quantidade: 0.05, unidadeMedida: "KG" }] } },
  });
  await prisma.itemVenda.create({
    data: { unidadeId: u.id, tipo: "PRATO", nome: "Tiramisù da casa", precoVenda: 32, codigoPdv: "222", receitaId: ficha2.id },
  });

  const r1 = await reprocessarVendasNaoReconhecidas(CASA);
  const e2 = await estado(massa.id);
  console.log(`3. reprocessamento: casadas=${r1.linhasCasadas} (codigo ${r1.casadosPorCodigo}, nome ${r1.casadosPorNome})  saldo=${e2.saldo}  linhas sem item=${e2.semItem}`);

  const r2 = await reprocessarVendasNaoReconhecidas(CASA);
  const e3 = await estado(massa.id);
  console.log(`4. reprocessar de novo: casadas=${r2.linhasCasadas}  saldo=${e3.saldo}  <- tem que continuar ${e2.saldo}`);

  // TODAS as baixas — da carga e do reprocessamento — tem que estar carimbadas
  // com o fim do periodo da venda, nunca com a hora em que a carga rodou.
  const movs = await prisma.movimentoEstoque.findMany({ where: { produtoId: massa.id, tipo: "SAIDA_CONSUMO" }, select: { criadoEm: true } });

  const falhas: string[] = [];
  if (c1.casadosPorCodigo !== 1) falhas.push(`a carga devia casar 1, casou ${c1.casadosPorCodigo}`);
  if (e1.saldo !== 98) falhas.push(`saldo apos a carga devia ser 98 (100 - 10x0,2), e ${e1.saldo}`);
  if (e1.semItem !== 1) falhas.push(`devia sobrar 1 linha sem item, sobraram ${e1.semItem}`);
  if (!deu409) falhas.push("reenviar a mesma semana devia ser recusado");
  if (r1.linhasCasadas !== 1) falhas.push(`o reprocessamento devia casar 1, casou ${r1.linhasCasadas}`);
  if (Math.abs(e2.saldo - 96.05) > 1e-9) falhas.push(`saldo apos reprocessar devia ser 96,05 (98 - 39x0,05), e ${e2.saldo}`);
  if (e2.semItem !== 0) falhas.push(`nao devia sobrar linha sem item, sobraram ${e2.semItem}`);
  if (r2.linhasCasadas !== 0) falhas.push(`nao havia o que casar, casou ${r2.linhasCasadas}`);
  if (Math.abs(e3.saldo - e2.saldo) > 1e-9) falhas.push(`DOBROU: saldo foi de ${e2.saldo} para ${e3.saldo}`);
  const foraDaData = movs.filter((m) => m.criadoEm.toISOString().slice(0, 10) !== "2026-10-19");
  if (movs.length !== 2) falhas.push(`deviam existir 2 baixas (carga e reprocessamento), existem ${movs.length}`);
  if (foraDaData.length > 0) {
    falhas.push(`${foraDaData.length} baixa(s) carimbada(s) com a hora da carga em vez do fim do periodo: ${foraDaData.map((m) => m.criadoEm.toISOString().slice(0, 10)).join(", ")}`);
  }

  console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nOK");
  for (const f of falhas) console.log("  ✗", f);
  await prisma.$disconnect();
  if (falhas.length) process.exit(1);
}
main();
