import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { podeGerenciarManutencao } from "@/lib/permissions";

/** Telas de gestão do módulo: admin e responsável da manutenção. */
export async function requireGestaoManutencao() {
  const user = await requireSession();
  if (!podeGerenciarManutencao(user.papel)) redirect("/manutencao");
  return user;
}
