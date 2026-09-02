export { default } from "next-auth/middleware";

export const config = {
  // Protege tudo, exceto login, rota de auth, assets estáticos do Next, e
  // as rotas /api/n8n/* — essas têm autenticação própria por token (ver
  // src/lib/n8n-auth.ts), já que quem chama (n8n) não tem sessão NextAuth.
  matcher: ["/((?!login|api/auth|api/n8n|_next/static|_next/image|favicon.ico).*)"],
};
