"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export async function criarProduto(formData: FormData) {
  await requireAdmin();
  const nome = String(formData.get("nome") || "").trim();
  const unidadeMedida = String(formData.get("unidadeMedida") || "").trim();
  if (!nome || !unidadeMedida) throw new Error("Informe nome e unidade de medida.");

  await prisma.produto.create({
    data: {
      nome,
      unidadeMedida,
      categoria: String(formData.get("categoria") || "").trim() || null,
    },
  });
  revalidatePath("/produtos");
}

export async function alternarProduto(id: string, ativo: boolean) {
  await requireAdmin();
  await prisma.produto.update({ where: { id }, data: { ativo } });
  revalidatePath("/produtos");
}
