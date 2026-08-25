"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { PAPEIS, type Papel } from "@/lib/constants";

export async function criarUsuario(formData: FormData) {
  await requireAdmin();
  const nome = String(formData.get("nome") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const senha = String(formData.get("senha") || "");
  const papel = String(formData.get("papel") || "") as Papel;
  const unidadeId = String(formData.get("unidadeId") || "") || null;

  if (!nome || !email || !senha) throw new Error("Preencha nome, e-mail e senha.");
  if (senha.length < 6) throw new Error("A senha precisa ter ao menos 6 caracteres.");
  if (!PAPEIS.includes(papel)) throw new Error("Papel inválido.");

  const senhaHash = await bcrypt.hash(senha, 10);

  await prisma.usuario.create({
    data: { nome, email, senhaHash, papel, unidadeId },
  });
  revalidatePath("/usuarios");
}

export async function alternarUsuario(id: string, ativo: boolean) {
  await requireAdmin();
  await prisma.usuario.update({ where: { id }, data: { ativo } });
  revalidatePath("/usuarios");
}
