export { default } from "next-auth/middleware";

export const config = {
  // Protege tudo, exceto login, rota de auth, e assets estáticos do Next.
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)"],
};
