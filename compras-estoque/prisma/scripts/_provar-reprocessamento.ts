// Reproduz o que aconteceu no Beira Lago e prova que o reprocessamento resolve
// sem somar estoque em dobro.
//
//   DATABASE_URL=postgresql://.../banco_de_teste \
//     npx tsx prisma/scripts/_provar-reprocessamento.ts
//
// NUNCA rode contra produção.
//
// A SEQUÊNCIA: carga com o produto NÃO cadastrado -> linha fica presa (produto
// nulo, chave ocupada) -> recarga da MESMA carga não resolve (é o bug) ->
// cadastra o produto -> reprocessa -> entra -> reprocessa DE NOVO -> não soma.
import { PrismaClient } from "@prisma/client";
import { processarNotaCompra } from "@/lib/nota-compra";
import { reprocessarNaoReconhecidos } from "@/lib/reprocessar-nao-reconhecidos";
import { N8N_SERVICE_USER_EMAIL } from "@/lib/constants";

const prisma = new PrismaClient();
const CASA = "Casa do reprocessamento";
const NOME = "FARINHA PANKO 1KG";

const itens = [
  { nome: NOME, unidadeMedida: "KG", preco: 17.68, quantidade: 10, valorTotal: 176.8, dataCompra: "2026-10-05", chave: "XMENU|1|1" },
  { nome: NOME, unidadeMedida: "KG", preco: 18.00, quantidade: 5, valorTotal: 90.0, dataCompra: "2026-10-12", chave: "XMENU|2|1" },
];

async function estado() {
  const p = await prisma.produto.findFirst({ where: { nome: NOME } });
  if (!p) return { saldo: 0, movimentos: 0, semProduto: await prisma.itemNotaCompra.count({ where: { produtoId: null } }) };
  const s = await prisma.estoqueSaldo.findFirst({ where: { produtoId: p.id } });
  return {
    saldo: s?.quantidade ?? 0,
    movimentos: await prisma.movimentoEstoque.count({ where: { produtoId: p.id, tipo: "ENTRADA_NOTA" } }),
    semProduto: await prisma.itemNotaCompra.count({ where: { produtoId: null } }),
  };
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
  await prisma.unidade.upsert({ where: { nome: CASA }, update: {}, create: { nome: CASA } });

  const falhas: string[] = [];

  // 1. Carga com o produto AINDA NÃO cadastrado.
  const c1 = await processarNotaCompra(CASA, "carga 1", itens, servico.id, false);
  const e1 = await estado();
  console.log(`1. carga sem o produto:     naoReconhecidos=${(c1.naoReconhecidos as any[]).length}  linhas sem produto=${e1.semProduto}  saldo=${e1.saldo}`);
  if (e1.semProduto !== 2) falhas.push(`as 2 linhas deviam ficar gravadas sem produto, ficaram ${e1.semProduto}`);

  // 2. A MESMA carga de novo — é o que não funciona, e é o motivo da rota.
  const c2 = await processarNotaCompra(CASA, "carga 2 (igual)", itens, servico.id, false);
  const e2 = await estado();
  console.log(`2. recarga igual:           jaCarregadas=${c2.linhasJaCarregadas}  casadasPorNome=${c2.casadosPorNome}  saldo=${e2.saldo}`);
  if (c2.linhasJaCarregadas !== 2) falhas.push(`a recarga devia pular as 2, pulou ${c2.linhasJaCarregadas}`);

  // 3. Agora o produto existe.
  await prisma.produto.create({ data: { nome: NOME, unidadeMedida: "KG" } });

  // 4. Recarga DEPOIS do cadastro: continua não resolvendo. É o bug, provado.
  const c3 = await processarNotaCompra(CASA, "carga 3 (pos-cadastro)", itens, servico.id, false);
  const e3 = await estado();
  console.log(`3. recarga pos-cadastro:    casadasPorNome=${c3.casadosPorNome}  saldo=${e3.saldo}   <- o bug: nada entrou`);
  if (e3.saldo !== 0) falhas.push(`recarga pos-cadastro nao devia mexer em saldo, deu ${e3.saldo}`);

  // 5. Reprocessamento.
  const r1 = await reprocessarNaoReconhecidos(CASA, servico.id);
  const e4 = await estado();
  console.log(`4. reprocessamento:         reenviadas=${r1.linhasReenviadas}  casadasPorNome=${r1.carga?.casadosPorNome}  saldo=${e4.saldo}  movimentos=${e4.movimentos}`);
  if (e4.saldo !== 15) falhas.push(`saldo devia ser 15 (10+5), deu ${e4.saldo}`);
  if (e4.movimentos !== 2) falhas.push(`deviam existir 2 movimentos (duas datas), existem ${e4.movimentos}`);
  if (e4.semProduto !== 0) falhas.push(`nao devia sobrar linha sem produto, sobraram ${e4.semProduto}`);

  // 6. Reprocessar DE NOVO: nao pode somar nada. É a pergunta do usuário.
  const r2 = await reprocessarNaoReconhecidos(CASA, servico.id);
  const e5 = await estado();
  console.log(`5. reprocessar de novo:     reenviadas=${r2.linhasReenviadas}  saldo=${e5.saldo}   <- tem que continuar 15`);
  if (e5.saldo !== 15) falhas.push(`DOBROU: saldo foi de 15 para ${e5.saldo}`);
  if (r2.linhasReenviadas !== 0) falhas.push(`nao havia o que reenviar, reenviou ${r2.linhasReenviadas}`);

  // 7. E a carga original mais uma vez, por garantia.
  await processarNotaCompra(CASA, "carga 4", itens, servico.id, false);
  const e6 = await estado();
  console.log(`6. carga original de novo:  saldo=${e6.saldo}   <- tem que continuar 15`);
  if (e6.saldo !== 15) falhas.push(`DOBROU na recarga: saldo foi para ${e6.saldo}`);

  console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nOK");
  for (const f of falhas) console.log("  ✗", f);
  await prisma.$disconnect();
  if (falhas.length) process.exit(1);
}
main();
