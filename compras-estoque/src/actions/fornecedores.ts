"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export async function criarFornecedor(formData: FormData) {
  await requireAdmin();
  const nome = String(formData.get("nome") || "").trim();
  if (!nome) throw new Error("Informe o nome do fornecedor.");

  await prisma.fornecedor.create({
    data: {
      nome,
      cnpj: String(formData.get("cnpj") || "").trim() || null,
      contato: String(formData.get("contato") || "").trim() || null,
      telefone: String(formData.get("telefone") || "").trim() || null,
    },
  });
  revalidatePath("/fornecedores");
}

export async function alternarFornecedor(id: string, ativo: boolean) {
  await requireAdmin();
  await prisma.fornecedor.update({ where: { id }, data: { ativo } });
  revalidatePath("/fornecedores");
}
