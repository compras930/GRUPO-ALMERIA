import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { custoReceita } from "../../src/lib/receita";
const prisma = new PrismaClient();
async function main() {
  const unidades = await prisma.unidade.findMany();
  const itens = await prisma.itemVenda.findMany({ where: { receitaId: { not: null } } });
  const saida: Record<string, number> = {};
  for (const item of itens) {
    try {
      const { custoLote, custoPorUnidadeRendimento } = await custoReceita(item.receitaId!, item.unidadeId);
      saida[item.id] = custoPorUnidadeRendimento ?? custoLote;
    } catch (e) {
      saida[item.id] = NaN;
    }
  }
  fs.writeFileSync(process.argv[2], JSON.stringify(saida));
  console.log("itens com custo calculado:", Object.keys(saida).length);
  await prisma.$disconnect();
}
main();
