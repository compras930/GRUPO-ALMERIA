// Provas sobre a SUBSTITUIÇÃO de uma carga de venda (carga diária).
//
// A pergunta que isto responde é a única que importa aqui: reenviar o mesmo
// dia várias vezes deixa o estoque e a venda como se ele tivesse sido enviado
// UMA vez? Se a resposta falhar, o erro não aparece na tela — aparece no
// inventário, semanas depois, como estoque que não existe.
//
//   1. substituir e recarregar = carregar uma vez só (saldo e venda);
//   2. a remoção devolve o saldo exatamente ao que era antes da carga;
//   3. recusa quando o período gravado não é o mesmo do envio;
//   4. recusa quando houve CONTAGEM depois da carga;
//   5. o rascunho de pedido que a carga gerou vai junto.
//
//   DATABASE_URL=postgresql://.../banco_de_teste \
//     npx tsx prisma/scripts/_provar-substituicao-venda.ts
import { PrismaClient } from "@prisma/client";
import { processarVendaSemanal } from "@/lib/venda-semanal";
import { removerCargaDeVenda, SubstituicaoRecusadaError } from "@/lib/venda-substituir";
import { N8N_SERVICE_USER_EMAIL } from "@/lib/constants";

const prisma = new PrismaClient();
const CASA = "Casa da substituicao";
const falhas: string[] = [];

const conferir = (nome: string, ok: boolean, detalhe: string) => {
  console.log(`${ok ? "ok  " : "FALHA"} ${nome} — ${detalhe}`);
  if (!ok) falhas.push(`${nome}: ${detalhe}`);
};

async function main() {
  if (!/teste|test|local|visual/i.test(process.env.DATABASE_URL ?? "")) {
    console.error("recusado: DATABASE_URL não parece um banco de teste");
    process.exit(1);
  }

  const servico = await prisma.usuario.upsert({
    where: { email: N8N_SERVICE_USER_EMAIL },
    update: {},
    create: { nome: "n8n", email: N8N_SERVICE_USER_EMAIL, senhaHash: "x", papel: "ADMIN" },
  });
  const u = await prisma.unidade.upsert({ where: { nome: CASA }, update: {}, create: { nome: CASA } });

  // Limpa resíduo de uma rodada anterior, para a prova ser repetível.
  await prisma.vendaSemanal.deleteMany({ where: { unidadeId: u.id } });
  await prisma.movimentoEstoque.deleteMany({ where: { unidadeId: u.id } });
  await prisma.pedidoCompra.deleteMany({ where: { unidadeId: u.id } });
  await prisma.contagemEstoque.deleteMany({ where: { unidadeId: u.id } });
  await prisma.estoqueSaldo.deleteMany({ where: { unidadeId: u.id } });
  await prisma.itemVenda.deleteMany({ where: { unidadeId: u.id } });
  await prisma.receita.deleteMany({ where: { unidadeId: u.id } });

  const insumo = await prisma.produto.create({
    data: { nome: `CARNE DA PROVA ${Date.now()}`, unidadeMedida: "KG" },
  });
  await prisma.estoqueSaldo.create({
    data: { unidadeId: u.id, produtoId: insumo.id, quantidade: 1000 },
  });
  const ficha = await prisma.receita.create({
    data: {
      unidadeId: u.id,
      nome: "PRATO DA PROVA",
      ingredientes: { create: [{ produtoId: insumo.id, quantidade: 2, unidadeMedida: "KG" }] },
    },
  });
  await prisma.itemVenda.create({
    data: { unidadeId: u.id, tipo: "PRATO", nome: "PRATO", precoVenda: 50, codigoPdv: "P1", receitaId: ficha.id },
  });

  const saldoDe = async () =>
    (await prisma.estoqueSaldo.findFirst({ where: { unidadeId: u.id, produtoId: insumo.id } }))!.quantidade;
  const venda = (qtd: number) => [{ nome: "PRATO", codigo: "P1", quantidadeVendida: qtd, valorTotal: qtd * 50 }];
  const DIA = "2026-11-11";

  // ------------------------------------------------------------------ 1 e 2
  const saldoInicial = await saldoDe();
  await processarVendaSemanal(CASA, DIA, DIA, venda(10), servico.id); // 10 pratos = 20 kg
  const saldoAposPrimeira = await saldoDe();
  conferir("a carga baixa o estoque", saldoAposPrimeira === saldoInicial - 20, `${saldoInicial} -> ${saldoAposPrimeira}`);

  const rascunhosAposCarga = await prisma.pedidoCompra.count({ where: { unidadeId: u.id, status: "RASCUNHO" } });

  const remocao = await removerCargaDeVenda(CASA, DIA, DIA);
  const saldoAposRemocao = await saldoDe();
  conferir(
    "remover devolve o saldo exato",
    saldoAposRemocao === saldoInicial,
    `${saldoAposRemocao} (esperado ${saldoInicial})`
  );
  conferir(
    "o rascunho da carga vai junto",
    remocao.rascunhosRemovidos === rascunhosAposCarga,
    `removidos ${remocao.rascunhosRemovidos} de ${rascunhosAposCarga}`
  );
  conferir(
    "não sobra movimento da carga",
    (await prisma.movimentoEstoque.count({ where: { referencia: remocao.vendaSemanalId! } })) === 0,
    "movimentos apagados"
  );
  conferir(
    "não sobra a venda nem as linhas",
    (await prisma.vendaSemanal.count({ where: { unidadeId: u.id } })) === 0 &&
      (await prisma.itemVendaSemanal.count({ where: { vendaSemanalId: remocao.vendaSemanalId! } })) === 0,
    "VendaSemanal e linhas apagadas"
  );

  // Recarrega o MESMO dia com número maior, como faz a rodada da tarde.
  await processarVendaSemanal(CASA, DIA, DIA, venda(15), servico.id); // 15 pratos = 30 kg
  const saldoFinal = await saldoDe();
  conferir(
    "substituir + recarregar = carregar uma vez só",
    saldoFinal === saldoInicial - 30,
    `${saldoFinal} (esperado ${saldoInicial - 30}, e NÃO ${saldoInicial - 50} que seria somar as duas)`
  );
  conferir(
    "fica uma carga só para o dia",
    (await prisma.vendaSemanal.count({ where: { unidadeId: u.id } })) === 1,
    "1 VendaSemanal"
  );

  // ---------------------------------------------------------------------- 3
  let recusouPeriodo = "";
  try {
    await removerCargaDeVenda(CASA, "2026-11-09", "2026-11-15"); // a semana inteira
  } catch (e: any) {
    recusouPeriodo = e instanceof SubstituicaoRecusadaError ? e.message : `erro errado: ${e?.message}`;
  }
  conferir(
    "recusa período que não bate exato",
    recusouPeriodo.includes("não é o mesmo período"),
    recusouPeriodo.slice(0, 90) || "NÃO RECUSOU"
  );

  // ---------------------------------------------------------------------- 4
  await prisma.contagemEstoque.create({
    data: {
      unidadeId: u.id,
      produtoId: insumo.id,
      quantidadeSistema: saldoFinal,
      quantidadeContada: saldoFinal,
      diferenca: 0,
      contadoPorId: servico.id,
    },
  });
  let recusouContagem = "";
  try {
    await removerCargaDeVenda(CASA, DIA, DIA);
  } catch (e: any) {
    recusouContagem = e instanceof SubstituicaoRecusadaError ? e.message : `erro errado: ${e?.message}`;
  }
  conferir(
    "recusa quando houve contagem depois da carga",
    recusouContagem.includes("contagem"),
    recusouContagem.slice(0, 90) || "NÃO RECUSOU"
  );
  conferir(
    "e a recusa não mexeu em nada",
    (await saldoDe()) === saldoFinal,
    `saldo segue ${await saldoDe()}`
  );

  console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTUDO OK");
  await prisma.$disconnect();
  if (falhas.length) process.exit(1);
}

main();
