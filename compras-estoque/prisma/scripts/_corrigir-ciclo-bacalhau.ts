import { PrismaClient } from "@prisma/client";
import { normalizarNome } from "../../src/lib/nome-normalizado";
const prisma = new PrismaClient();

async function main() {
  const commit = process.argv.includes("--commit");
  const unidade = await prisma.unidade.findFirst({ where: { nome: "Beira Lago" } });
  const bacalhauCozido = await prisma.receita.findFirst({ where: { unidadeId: unidade!.id, nome: "BACALHAU COZIDO" } });
  const lagareiro = await prisma.receita.findFirst({ where: { unidadeId: unidade!.id, nome: "Bacalhau à Lagareiro" } });
  const linha = await prisma.ingredienteReceita.findFirst({ where: { receitaId: bacalhauCozido!.id, subReceitaId: lagareiro!.id } });
  if (!linha) { console.log("linha não encontrada — já corrigida?"); await prisma.$disconnect(); return; }

  console.log(`${commit ? "[CORRIGINDO]" : "[dry-run]"} BACALHAU COZIDO: troca ingrediente "Bacalhau à Lagareiro" (sub-receita, ${linha.quantidade}${linha.unidadeMedida}) por insumo "BACALHAU" (novo produto, custo 168/KG)`);

  if (commit) {
    await prisma.$transaction(async (tx) => {
      const nome = normalizarNome("BACALHAU");
      const produto = await tx.produto.upsert({
        where: { nome_unidadeMedida: { nome, unidadeMedida: "KG" } },
        update: {},
        create: { nome, unidadeMedida: "KG" },
      });
      await tx.ingredienteReceita.update({
        where: { id: linha.id },
        data: { subReceitaId: null, produtoId: produto.id },
      });
      const existente = await tx.precoAtualProduto.findUnique({
        where: { unidadeId_produtoId: { unidadeId: unidade!.id, produtoId: produto.id } },
      });
      if (!existente) {
        const agora = new Date();
        await tx.precoAtualProduto.create({ data: { unidadeId: unidade!.id, produtoId: produto.id, preco: 168, dataCompra: agora } });
        await tx.historicoPrecoProduto.create({
          data: { unidadeId: unidade!.id, produtoId: produto.id, preco: 168, origem: "IMPORTACAO_INICIAL", origemId: "correcao-ciclo-bacalhau", dataCompra: agora },
        });
      }
    });
    console.log("Corrigido.");
  }
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
