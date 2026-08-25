import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/** Usa em server actions/pages: garante sessão válida e devolve o usuário logado. */
export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Não autenticado.");
  return session.user;
}

export async function requireAdmin() {
  const user = await requireSession();
  if (user.papel !== "ADMIN") throw new Error("Apenas administradores podem fazer isso.");
  return user;
}
