// Prova, contra um banco de verdade, que linha de compra SEM `chave` não soma
// saldo duas vezes — e que linha COM `chave` continua entrando.
//
//   DATABASE_URL=postgresql://.../banco_de_teste \
//     npx tsx prisma/scripts/_provar-entrada-sem-chave.ts
//
// NUNCA rode contra produção: o script escreve nota, preço e estoque.
//
// POR QUE ISTO NÃO É UM TESTE DE VITEST. A decisão mora dentro de
// processarNotaCompra, que abre transação e escreve em seis tabelas — não há
// núcleo puro pra chamar. O jeito honesto de provar é rodar a carga duas vezes
// e olhar o saldo.
//
// O QUE ELE PEGA. Até 23/09/2026 a condição da entrada de estoque não olhava
// `chaveOrigem`: o comentário de `ItemPrecoInput.chave` dizia que linha sem
// chave entrava "só pra preço", e o código deixava entrar estoque também. Como
// linha sem chave nunca é reconhecida como já carregada, cada reexecução
// somava tudo de novo. Apareceu ao levantar a integração do XMenu, que não tem
// essa coluna.
import { PrismaClient } from "@prisma/client";
import { processarNotaCompra } from "@/lib/nota-compra";
import { N8N_SERVICE_USER_EMAIL } from "@/lib/constants";

const prisma = new PrismaClient();

const CASA = "Casa de teste";
const item = (nome: string, chave: string | null) => ({
  nome,
  unidadeMedida: "KG",
  preco: 10,
  dataCompra: "2026-09-23",
  quantidade: 5,
  valorTotal: 50,
  chave,
});

async function saldo(nome: string) {
  const p = await prisma.produto.findFirst({ where: { nome } });
  const s = await prisma.estoqueSaldo.findFirst({ where: { produtoId: p!.id } });
  return s?.quantidade ?? 0;
}

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
  await prisma.unidade.upsert({ where: { nome: CASA }, update: {}, create: { nome: CASA } });
  for (const nome of ["COM CHAVE", "SEM CHAVE"]) {
    await prisma.produto.upsert({
      where: { nome_unidadeMedida: { nome, unidadeMedida: "KG" } },
      update: {},
      create: { nome, unidadeMedida: "KG" },
    });
  }

  const itens = [item("COM CHAVE", "k-1"), item("SEM CHAVE", null)];

  const r1 = await processarNotaCompra(CASA, "prova", itens, servico.id, false);
  const depois1 = { com: await saldo("COM CHAVE"), sem: await saldo("SEM CHAVE") };

  const r2 = await processarNotaCompra(CASA, "prova", itens, servico.id, false);
  const depois2 = { com: await saldo("COM CHAVE"), sem: await saldo("SEM CHAVE") };

  const linhas = [
    `carga 1: entradas=${r1.entradasDeEstoque.produtos} produto(s), sem chave=${r1.entradasSemChave.linhas} linha(s)`,
    `carga 2: jaCarregadas=${r2.linhasJaCarregadas}, entradas=${r2.entradasDeEstoque.produtos}, sem chave=${r2.entradasSemChave.linhas}`,
    `saldo COM CHAVE: ${depois1.com} -> ${depois2.com}  (esperado 5 -> 5, a chave pula a repetida)`,
    `saldo SEM CHAVE: ${depois1.sem} -> ${depois2.sem}  (esperado 0 -> 0, recusada por não ter identidade)`,
  ];
  for (const l of linhas) console.log(l);

  const falhas: string[] = [];
  if (depois1.com !== 5) falhas.push(`linha com chave devia entrar 5, entrou ${depois1.com}`);
  if (depois2.com !== 5) falhas.push(`linha com chave dobrou na recarga: ${depois2.com}`);
  if (depois1.sem !== 0) falhas.push(`linha sem chave entrou no saldo: ${depois1.sem}`);
  if (depois2.sem !== 0) falhas.push(`linha sem chave somou de novo: ${depois2.sem}`);
  if (r1.entradasSemChave.linhas !== 1) falhas.push(`a recusa não foi reportada: ${r1.entradasSemChave.linhas}`);
  // O preço tem que ter entrado nas DUAS: a recusa é do estoque, não da linha.
  if (r1.precosAtualizados !== 2) falhas.push(`preço devia entrar nas duas linhas, entrou em ${r1.precosAtualizados}`);

  console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nOK");
  for (const f of falhas) console.log("  ✗", f);

  await prisma.$disconnect();
  if (falhas.length) process.exit(1);
}

main();
