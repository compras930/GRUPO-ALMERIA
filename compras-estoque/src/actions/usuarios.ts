"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { PAPEIS, PAPEL_LABEL, type Papel } from "@/lib/constants";
import { exigeUnidade } from "@/lib/permissions";

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
  // Ver `exigeUnidade`: usuário não-admin sem casa não opera nada e enxerga
  // todas as casas no Painel. Recusar na criação é mais barato que descobrir
  // depois pelo que ele viu.
  if (exigeUnidade(papel) && !unidadeId) {
    throw new Error(
      `${PAPEL_LABEL[papel]} precisa de uma unidade. Só o administrador fica sem casa.`
    );
  }

  const senhaHash = await bcrypt.hash(senha, 10);

  await prisma.usuario.create({
    data: { nome, email, senhaHash, papel, unidadeId },
  });
  revalidatePath("/usuarios");
}

/**
 * Senha nova para quem já existe.
 *
 * Na implantação das casas isso é a rotina, não a exceção: o gerente recebe
 * uma senha provisória, erra, esquece, ou troca de gerente. Sem esta ação, a
 * única saída era rodar UPDATE à mão no banco de produção — e senha digitada
 * em console de banco é senha que fica no histórico de alguém.
 *
 * Não guarda "senha provisória" nem obriga troca no primeiro acesso: seria uma
 * coluna nova, e coluna nova é uma janela em que a tela cai (o deploy não roda
 * migração). Quem redefine avisa a pessoa, e a pessoa pede outra se quiser.
 */
export async function redefinirSenha(id: string, formData: FormData) {
  await requireAdmin();
  const senha = String(formData.get("senha") || "");
  if (senha.length < 6) throw new Error("A senha precisa ter ao menos 6 caracteres.");
  await prisma.usuario.update({
    where: { id },
    data: { senhaHash: await bcrypt.hash(senha, 10) },
  });
  revalidatePath("/usuarios");
}

export async function alternarUsuario(id: string, ativo: boolean) {
  await requireAdmin();
  await prisma.usuario.update({ where: { id }, data: { ativo } });
  revalidatePath("/usuarios");
}
