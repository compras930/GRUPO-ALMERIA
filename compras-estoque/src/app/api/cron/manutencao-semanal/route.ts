import { timingSafeEqual } from "node:crypto";
import { enviarResumoSemanal } from "@/lib/manutencao/resumo-semanal";

// Dispara o relatório semanal da manutenção pelo WhatsApp.
//
// Quem chama: o Cron da Vercel (vercel.json, toda segunda às 8h de Brasília),
// que manda "Authorization: Bearer <CRON_SECRET>". Aceita também o token do
// n8n, para quem preferir agendar por lá.
function autorizado(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  const recebido = Buffer.from(auth.slice(7));
  return [process.env.CRON_SECRET, process.env.N8N_API_TOKEN].some((esperado) => {
    if (!esperado) return false;
    const b = Buffer.from(esperado);
    return b.length === recebido.length && timingSafeEqual(b, recebido);
  });
}

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!autorizado(req)) return Response.json({ erro: "Token inválido ou ausente." }, { status: 401 });
  const r = await enviarResumoSemanal();
  return Response.json(r);
}

export const POST = GET;
