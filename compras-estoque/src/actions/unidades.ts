"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export async function criarUnidade(formData: FormData) {
  await requireAdmin();
  const nome = String(formData.get("nome") || "").trim();
  if (!nome) throw new Error("Informe o nome da unidade.");

  await prisma.unidade.create({ data: { nome } });
  revalidatePath("/unidades");
}

export async function alternarUnidade(id: string, ativo: boolean) {
  await requireAdmin();
  await prisma.unidade.update({ where: { id }, data: { ativo } });
  revalidatePath("/unidades");
}
