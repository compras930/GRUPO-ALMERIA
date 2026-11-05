"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { idDaUnidadeFisica } from "@/lib/unidade-fisica";
import { emOrdemDeBloqueio } from "@/lib/ordem-de-bloqueio";
import { comRetentativaDeConflito } from "@/lib/transacao";
import { carregarCurvaDaJanela } from "@/lib/curva-abc-db";
import { planejarCurvaAbcPura } from "@/lib/curva-abc-aplicar";

/**
 * Grava a curva ABC recalculada na classificação que a FOLHA DE CONTAGEM usa.
 *
 * RECALCULA DE NOVO AQUI DENTRO, em vez de receber o plano da tela. A tela
 * mostrou um plano de alguns segundos atrás; entre ver e clicar pode ter
 * entrado uma nota. Receber a lista pronta do navegador também deixaria
 * qualquer um mandar a classificação que quisesse — e quem decide o que a
 * cozinha conta é a compra da casa, não o corpo de uma requisição.
 *
 * SÓ ADMIN: muda o trabalho de outra pessoa.
 */
export async function aplicarCurvaAbc(formData: FormData) {
  await requireAdmin();

  const unidadeId = String(formData.get("unidadeId") || "");
  if (!unidadeId) throw new Error("Informe a casa.");
  const despensaId = await idDaUnidadeFisica(unidadeId);

  const { novas, atuais, grupoZero } = await carregarCurvaDaJanela(despensaId);
  const plano = planejarCurvaAbcPura(novas, atuais, grupoZero);
  if (plano.mudancas.length === 0) return { mudou: 0 };

  await comRetentativaDeConflito(() =>
    prisma.$transaction(
      async (tx) => {
        // Ordem estável de id — ver src/lib/ordem-de-bloqueio.ts. Duas pessoas
        // aplicando ao mesmo tempo travariam uma na outra sem isto.
        const porProduto = new Map(plano.mudancas.map((m) => [m.produtoId, m]));
        for (const [produtoId, m] of emOrdemDeBloqueio(porProduto)) {
          await tx.parametroEstoqueProduto.upsert({
            where: { unidadeId_produtoId: { unidadeId: despensaId, produtoId } },
            update: { classeAbc: m.para, grupoContagem: m.grupoContagem },
            create: {
              unidadeId: despensaId,
              produtoId,
              classeAbc: m.para,
              grupoContagem: m.grupoContagem,
            },
            select: { id: true },
          });
        }
      },
      { timeout: 60_000 }
    )
  );

  revalidatePath("/estoque/curva-abc");
  revalidatePath("/estoque/contagem");
  revalidatePath("/dashboard");
  return { mudou: plano.mudancas.length };
}
