import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import SeletorContexto from "@/components/SeletorContexto";
import { carregarContexto } from "@/lib/selecao-db";

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

  // A seleção vive no layout porque vale para todas as telas — ver
  // src/lib/selecao.ts.
  const ctx = await carregarContexto({
    papel: session.user.papel,
    unidadeId: session.user.unidadeId ?? null,
  });

  return (
    <div className="shell">
      <Sidebar
        papel={session.user.papel}
        unidadeNome={session.user.unidadeNome}
        userName={session.user.name ?? null}
        seletor={
          <SeletorContexto
            casas={ctx.casas}
            meses={ctx.meses}
            casaId={ctx.casaId}
            mes={ctx.mes}
            podeVerTodas={session.user.papel === "ADMIN"}
          />
        }
      />
      <main className="main">{children}</main>
    </div>
  );
}
