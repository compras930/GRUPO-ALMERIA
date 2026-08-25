"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { unidadeVisivel } from "@/lib/permissions";

export async function registrarContagem(formData: FormData) {
  const user = await requireSession();
  const unidadeId = String(formData.get("unidadeId") || "");
  const produtoId = String(formData.get("produtoId") || "");
  const quantidadeContada = Number(formData.get("quantidadeContada"));

  if (!unidadeVisivel(user.papel, user.unidadeId, unidadeId)) {
    throw new Error("Você não tem acesso a essa unidade.");
  }
  if (!produtoId || Number.isNaN(quantidadeContada) || quantidadeContada < 0) {
    throw new Error("Informe produto e quantidade contada válidos.");
  }

  await prisma.$transaction(async (tx) => {
    const saldo = await tx.estoqueSaldo.findUnique({
      where: { unidadeId_produtoId: { unidadeId, produtoId } },
    });
    const quantidadeSistema = saldo?.quantidade ?? 0;
    const diferenca = quantidadeContada - quantidadeSistema;

    await tx.contagemEstoque.create({
      data: {
        unidadeId,
        produtoId,
        quantidadeSistema,
        quantidadeContada,
        diferenca,
        contadoPorId: user.id,
      },
    });

    await tx.estoqueSaldo.upsert({
      where: { unidadeId_produtoId: { unidadeId, produtoId } },
      update: { quantidade: quantidadeContada },
      create: { unidadeId, produtoId, quantidade: quantidadeContada },
    });

    if (diferenca !== 0) {
      await tx.movimentoEstoque.create({
        data: {
          unidadeId,
          produtoId,
          tipo: "AJUSTE_CONTAGEM",
          quantidade: diferenca,
          observacao: "Ajuste por contagem de inventário",
        },
      });
    }
  });

  revalidatePath("/estoque");
  revalidatePath("/estoque/contagem");
}
