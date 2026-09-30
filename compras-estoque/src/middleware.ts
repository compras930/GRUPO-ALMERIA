export { default } from "next-auth/middleware";

export const config = {
  // Protege tudo, exceto login, rota de auth, assets estáticos do Next, e
  // as rotas /api/n8n/* — essas têm autenticação própria por token (ver
  // src/lib/n8n-auth.ts), já que quem chama (n8n) não tem sessão NextAuth.
  //
  // `icon.svg` entrou junto com `favicon.ico`: o ícone da aba é servido pelo
  // Next a partir de src/app/icon.svg, e sem a exceção o middleware devolvia
  // 307 pra tela de login. O navegador não segue redirect pra buscar favicon —
  // então a aba do LOGIN, que é a primeira que qualquer pessoa vê, continuava
  // com o globo cinza. Só apareceu abrindo a URL do ícone de fora da sessão.
  matcher: ["/((?!login|api/auth|api/n8n|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
