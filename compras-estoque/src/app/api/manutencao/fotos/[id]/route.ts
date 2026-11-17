import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unidadeVisivel, veTodosOsChamados } from "@/lib/permissions";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Não autenticado.", { status: 401 });
  const foto = await prisma.fotoChamado.findUnique({
    where: { id: params.id },
    include: { chamado: { select: { unidadeId: true } } },
  });
  if (!foto) return new Response("Não encontrada.", { status: 404 });
  const u = session.user;
  if (!veTodosOsChamados(u.papel) && !unidadeVisivel(u.papel, u.unidadeId ?? null, foto.chamado.unidadeId)) {
    return new Response("Sem acesso.", { status: 403 });
  }
  return new Response(new Uint8Array(foto.dados), {
    headers: { "Content-Type": foto.mime, "Cache-Control": "private, max-age=86400, immutable" },
  });
}
