// Corrige o padrao "receita cita a si mesma como sub-receita" (self-reference)
// encontrado em varias sub-receitas compartilhadas: a linha de ingrediente com
// o MESMO nome da propria ficha e quantidade redonda (1000g, 100g etc.) e' na
// verdade uma anotacao de RENDIMENTO do sistema antigo, nao um ingrediente de
// verdade. Remove essa linha e grava o valor como rendimentoQtd/rendimentoUnidade
// da propria receita (que e' exatamente pra isso que esse campo existe).
import { PrismaClient } from "@prisma/client";
import { carregarIndiceReceitas, explodirReceitaPura, CicloReceitaError } from "../../src/lib/receita";

const prisma = new PrismaClient();

async function main() {
  const commit = process.argv.includes("--commit");
  const unidades = await prisma.unidade.findMany();

  let totalCorrigidas = 0;
  for (const unidade of unidades) {
    const receitas = await prisma.receita.findMany({
      where: { unidadeId: unidade.id },
      include: { ingredientes: true },
    });
    for (const receita of receitas) {
      const autoRef = receita.ingredientes.find((i) => i.subReceitaId === receita.id);
      if (!autoRef) continue;
      console.log(
        `${commit ? "[CORRIGINDO]" : "[dry-run]"} ${unidade.nome} / "${receita.nome}": remove auto-referência (${autoRef.quantidade} ${autoRef.unidadeMedida}) -> rendimentoQtd=${autoRef.quantidade}, rendimentoUnidade=${autoRef.unidadeMedida}` +
          (receita.rendimentoQtd ? ` [JÁ TINHA rendimento=${receita.rendimentoQtd}${receita.rendimentoUnidade} — NÃO sobrescrevendo, só removendo a linha]` : "")
      );
      if (commit) {
        await prisma.$transaction(async (tx) => {
          await tx.ingredienteReceita.delete({ where: { id: autoRef.id } });
          if (!receita.rendimentoQtd) {
            await tx.receita.update({
              where: { id: receita.id },
              data: { rendimentoQtd: autoRef.quantidade, rendimentoUnidade: autoRef.unidadeMedida },
            });
          }
        });
      }
      totalCorrigidas++;
    }
  }
  console.log(`\nTotal de auto-referências ${commit ? "corrigidas" : "encontradas"}: ${totalCorrigidas}`);

  if (commit) {
    console.log("\nConferindo se ainda sobra algum ciclo...");
    for (const unidade of unidades) {
      const indice = await carregarIndiceReceitas(unidade.id);
      const itens = await prisma.itemVenda.findMany({ where: { unidadeId: unidade.id, receitaId: { not: null } } });
      for (const item of itens) {
        try {
          explodirReceitaPura(item.receitaId!, 1, indice);
        } catch (e) {
          if (e instanceof CicloReceitaError) console.log(`  ainda com ciclo: ${unidade.nome} / ${item.nome}`);
          else throw e;
        }
      }
    }
    console.log("Conferência concluída.");
  }
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
