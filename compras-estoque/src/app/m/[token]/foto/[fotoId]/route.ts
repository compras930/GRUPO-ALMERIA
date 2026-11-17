import { prisma } from "@/lib/prisma";

// Foto vista pelo colaborador: vale só para fotos do chamado do link dele.
export async function GET(_req: Request, { params }: { params: { token: string; fotoId: string } }) {
  const foto = await prisma.fotoChamado.findFirst({
    where: { id: params.fotoId, chamado: { tokenAcesso: params.token } },
  });
  if (!foto) return new Response("Não encontrada.", { status: 404 });
  return new Response(new Uint8Array(foto.dados), {
    headers: { "Content-Type": foto.mime, "Cache-Control": "private, max-age=86400" },
  });
}
