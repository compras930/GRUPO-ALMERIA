import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

/**
 * Login obrigatório em tudo que o `matcher` cobre — e o responsável da
 * manutenção preso ao módulo dele.
 *
 * Ele não tem casa (atende todas), e as telas de estoque, CMV e pedidos
 * escopam por `unidadeId`: sem casa, mostrariam o Grupo inteiro. Em vez de
 * ensinar cada uma dessas telas a recusá-lo, a porta é fechada aqui, num
 * lugar só.
 */
export default withAuth(function middleware(req) {
  const papel = (req.nextauth.token as any)?.papel;
  const caminho = req.nextUrl.pathname;
  if (papel === "MANUTENCAO" && !caminho.startsWith("/manutencao") && !caminho.startsWith("/api/manutencao")) {
    return NextResponse.redirect(new URL("/manutencao", req.url));
  }
  return NextResponse.next();
});

export const config = {
  // Protege tudo, exceto login, rota de auth, assets estáticos do Next, e
  // as rotas /api/n8n/* — essas têm autenticação própria por token (ver
  // src/lib/n8n-auth.ts), já que quem chama (n8n) não tem sessão NextAuth.
  //
  // `icon.png` entrou junto com `favicon.ico`: o ícone da aba é servido pelo
  // Next a partir de src/app/icon.png, e sem a exceção o middleware devolvia
  // 307 pra tela de login. O navegador não segue redirect pra buscar favicon —
  // então a aba do LOGIN, que é a primeira que qualquer pessoa vê, continuava
  // com o globo cinza. Só apareceu abrindo a URL do ícone de fora da sessão.
  //
  // `marca-` cobre os PNGs da marca em public/. Eles não são segredo — é o
  // logo que está no site e na fachada —, e deixá-los de fora da checagem
  // permite usar a marca na própria tela de login, que por definição não tem
  // sessão. Sem isso, o mesmo 307 silencioso do favicon.
  //
  // `m/` é a página do COLABORADOR de manutenção (/m/<token>): pedreiro e
  // eletricista não têm login — o segredo do link, conferido na própria
  // página, é a autorização. `api/cron` tem token próprio (CRON_SECRET).
  matcher: [
    "/((?!login|api/auth|api/n8n|api/cron|m/|_next/static|_next/image|favicon.ico|icon.png|marca-).*)",
  ],
};
