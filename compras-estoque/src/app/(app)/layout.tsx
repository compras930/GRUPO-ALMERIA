import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

// Todas as páginas autenticadas (cadastros, CMV, estoque...) leem dado que
// pode ter sido alterado por fora da própria interface (SQL direto, ou os
// endpoints /api/n8n/*) — nunca renderiza estático/cacheado, sempre busca
// no banco a cada requisição. Sem isso, uma atualização de preço via n8n
// (ou qualquer escrita direta) pode ficar invisível na tela até alguém
// salvar algo pela própria UI, o que quebra o design de "custo nunca
// persistido, sempre recalculado em tempo de leitura".
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="shell">
      <Sidebar
        papel={session.user.papel}
        unidadeNome={session.user.unidadeNome}
        userName={session.user.name ?? null}
      />
      <main className="main">{children}</main>
    </div>
  );
}
