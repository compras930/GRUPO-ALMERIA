// Prova, contra um banco de verdade, que o movimento de entrada nasce com a
// DATA DA NOTA, e não com a hora em que a carga rodou.
//
//   DATABASE_URL=postgresql://.../banco_de_teste \
//     npx tsx prisma/scripts/_provar-data-do-movimento.ts
//
// NUNCA rode contra produção: o script escreve nota, preço e estoque.
//
// POR QUE ISTO IMPORTA. `criadoEm` do MovimentoEstoque é o campo que
// calcularConsumoPuro usa pra decidir se a entrada caiu entre duas contagens
// (src/lib/consumo.ts). Carimbado com `now()`, nota que chega atrasada entra na
// semana da CARGA, não na semana da COMPRA: some de um período e aparece no
// outro. Num CMV mensal ninguém vê; no semanal do Beira Lago, troca o resultado
// de duas semanas de uma vez.
//
// POR QUE NÃO É VITEST. A gravação mora dentro de processarNotaCompra, que abre
// transação e escreve em seis tabelas. Não há núcleo puro pra chamar — o jeito
// honesto é rodar a carga e olhar a linha gravada.
import { PrismaClient } from "@prisma/client";
import { processarNotaCompra } from "@/lib/nota-compra";
import { N8N_SERVICE_USER_EMAIL } from "@/lib/constants";

const prisma = new PrismaClient();

const CASA = "Casa de teste data";
const PRODUTO = "PRODUTO DA DATA";

// Duas notas de DATAS DIFERENTES para o MESMO produto, mais uma terceira linha
// na mesma data da primeira — essa tem que SOMAR na mesma linha de movimento,
// não virar uma terceira.
const itens = [
  { nome: PRODUTO, unidadeMedida: "KG", preco: 10, dataCompra: "2026-08-03", quantidade: 5, valorTotal: 50, chave: "d-1" },
  { nome: PRODUTO, unidadeMedida: "KG", preco: 10, dataCompra: "2026-08-03", quantidade: 2, valorTotal: 20, chave: "d-2" },
  { nome: PRODUTO, unidadeMedida: "KG", preco: 10, dataCompra: "2026-08-17", quantidade: 4, valorTotal: 40, chave: "d-3" },
];

const soData = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  if (!/teste|test|local/i.test(process.env.DATABASE_URL ?? "")) {
    console.error("recusado: DATABASE_URL não parece um banco de teste");
    process.exit(1);
  }

  const servico = await prisma.usuario.upsert({
    where: { email: N8N_SERVICE_USER_EMAIL },
    update: {},
    create: { nome: "n8n", email: N8N_SERVICE_USER_EMAIL, senhaHash: "x", papel: "ADMIN" },
  });
  const unidade = await prisma.unidade.upsert({ where: { nome: CASA }, update: {}, create: { nome: CASA } });
  const produto = await prisma.produto.upsert({
    where: { nome_unidadeMedida: { nome: PRODUTO, unidadeMedida: "KG" } },
    update: {},
    create: { nome: PRODUTO, unidadeMedida: "KG" },
  });

  // Limpa resíduo de execução anterior para o script poder rodar duas vezes.
  await prisma.movimentoEstoque.deleteMany({ where: { unidadeId: unidade.id, produtoId: produto.id } });
  await prisma.estoqueSaldo.deleteMany({ where: { unidadeId: unidade.id, produtoId: produto.id } });
  await prisma.itemNotaCompra.deleteMany({ where: { chaveOrigem: { in: ["d-1", "d-2", "d-3"] } } });

  const antesDaCarga = new Date();
  const r = await processarNotaCompra(CASA, "prova-data", itens, servico.id, false);

  const movimentos = await prisma.movimentoEstoque.findMany({
    where: { unidadeId: unidade.id, produtoId: produto.id, tipo: "ENTRADA_NOTA" },
    orderBy: { criadoEm: "asc" },
    select: { criadoEm: true, quantidade: true },
  });
  const saldo = await prisma.estoqueSaldo.findFirst({ where: { unidadeId: unidade.id, produtoId: produto.id } });

  console.log(`carga: entradas=${r.entradasDeEstoque.produtos} produto(s)`);
  console.log(`saldo: ${saldo?.quantidade ?? 0}  (esperado 11 = 5 + 2 + 4)`);
  for (const m of movimentos) console.log(`movimento: ${soData(m.criadoEm)}  qtd ${m.quantidade}`);

  const falhas: string[] = [];
  if ((saldo?.quantidade ?? 0) !== 11) falhas.push(`saldo devia ser 11, é ${saldo?.quantidade ?? 0}`);
  if (movimentos.length !== 2) {
    falhas.push(`devia haver 2 movimentos (uma data cada), há ${movimentos.length}`);
  } else {
    const [a, b] = movimentos;
    if (soData(a.criadoEm) !== "2026-08-03") falhas.push(`1º movimento devia ser 2026-08-03, é ${soData(a.criadoEm)}`);
    if (soData(b.criadoEm) !== "2026-08-17") falhas.push(`2º movimento devia ser 2026-08-17, é ${soData(b.criadoEm)}`);
    if (a.quantidade !== 7) falhas.push(`as duas linhas do dia 03 deviam somar 7, somaram ${a.quantidade}`);
    if (b.quantidade !== 4) falhas.push(`a linha do dia 17 devia ser 4, é ${b.quantidade}`);
  }
  // A trava que pega o bug antigo de frente: nenhum movimento pode estar
  // carimbado com a hora da carga.
  if (movimentos.some((m) => m.criadoEm >= antesDaCarga)) {
    falhas.push("há movimento carimbado com a hora da carga, não com a data da nota");
  }

  console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nOK");
  for (const f of falhas) console.log("  ✗", f);

  await prisma.$disconnect();
  if (falhas.length) process.exit(1);
}

main();
