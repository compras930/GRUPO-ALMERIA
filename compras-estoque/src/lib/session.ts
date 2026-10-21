import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * REDIRECIONA, NÃO LANÇA — e a diferença não é de estilo.
 *
 * Erro lançado dentro de um componente de servidor vira, em produção,
 * "Application error: a server-side exception has occurred" com um Digest e
 * mais nada: tela em branco, sem menu, sem caminho de volta. O usuário não tem
 * como saber que o problema é permissão, e quem recebe o print não tem como
 * saber qual página quebrou — o endereço na barra nem muda, porque a navegação
 * é do cliente e o erro acontece no meio dela.
 *
 * Foi exatamente o que aconteceu no primeiro login da gerente do Beira Lago:
 * ela entrou com a senha certa, o NextAuth a devolveu para o `callbackUrl` que
 * tinha ficado da sessão anterior (`/usuarios`, tela só de admin), e o
 * `requireAdmin` derrubou a página. O login tinha funcionado; o destino é que
 * não existia para ela.
 *
 * Mandar para o Painel é melhor que qualquer mensagem de erro: é para onde ela
 * iria de qualquer jeito, e de lá o menu mostra o que ela pode fazer.
 */
export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return session.user;
}

export async function requireAdmin() {
  const user = await requireSession();
  if (user.papel !== "ADMIN") redirect("/dashboard");
  return user;
}
