import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Pesagem } from "@/lib/pesagem";

/**
 * Os pesos dos produtos, se as colunas já existirem no banco.
 *
 * MESMA TOLERÂNCIA DO `CodigoCompraProduto`, e pelo mesmo motivo: o deploy
 * roda `prisma generate` e nunca `prisma migrate deploy`. As migrações são
 * aplicadas à mão no Neon, então existe uma janela real entre o código subir e
 * o banco mudar — e aqui a janela cai em cima da FOLHA DE CONTAGEM, que é a
 * tela que não pode falhar na segunda de manhã.
 *
 * Sem isto, subir o código antes da migração derruba a contagem inteira com
 * "column does not exist" para ganhar um aviso em meia dúzia de garrafas.
 * Com isto, a folha sai normalmente e o aviso aparece quando a coluna existir.
 *
 * Só P2022 (coluna não existe) é tolerado; qualquer outro erro sobe.
 */
export async function carregarPesagens(produtoIds: string[]): Promise<Map<string, Pesagem>> {
  if (produtoIds.length === 0) return new Map();
  try {
    const linhas = await prisma.produto.findMany({
      where: { id: { in: produtoIds }, OR: [{ pesoTaraG: { not: null } }, { pesoLiquidoCheioG: { not: null } }] },
      select: { id: true, pesoTaraG: true, pesoLiquidoCheioG: true },
    });
    return new Map(linhas.map((l) => [l.id, { taraG: l.pesoTaraG, liquidoCheioG: l.pesoLiquidoCheioG }]));
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022") {
      console.warn("Colunas de pesagem ainda não existem no banco; a folha de contagem sai sem o aviso de pesar.");
      return new Map();
    }
    throw e;
  }
}
