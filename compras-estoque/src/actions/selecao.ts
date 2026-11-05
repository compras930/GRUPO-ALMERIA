"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { COOKIE_CASA, COOKIE_MES } from "@/lib/selecao-db";
import { TODAS } from "@/lib/selecao";

/**
 * Grava a casa e o mês escolhidos no menu lateral.
 *
 * NÃO VALIDA A CASA AQUI, de propósito: quem valida é a leitura
 * (resolverSelecaoPura descarta casa fora da lista visível) e, acima dela,
 * cada tela, que chama `unidadeVisivel` antes de mostrar qualquer número.
 * Validar nos dois lugares criaria duas regras de permissão, e duas regras de
 * permissão divergem.
 *
 * Um ano de validade porque é preferência de tela, não sessão: quem volta na
 * segunda-feira quer a mesma casa que estava vendo na sexta.
 */
export async function definirSelecao(formData: FormData) {
  await requireSession();

  const casa = String(formData.get("casa") || "").trim();
  const mes = String(formData.get("mes") || "").trim();
  const c = cookies();
  const umAno = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const };

  if (casa) c.set(COOKIE_CASA, casa === TODAS ? TODAS : casa, umAno);
  if (mes) c.set(COOKIE_MES, mes, umAno);

  // A seleção muda o conteúdo de TODAS as telas, não só da atual.
  revalidatePath("/", "layout");
}
