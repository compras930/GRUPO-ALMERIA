import { prisma } from "@/lib/prisma";
import { verificarTokenN8n, respostaNaoAutorizada } from "@/lib/n8n-auth";
import { N8N_SERVICE_USER_EMAIL } from "@/lib/constants";
import { processarVendaSemanal, VendaSemanalDuplicadaError, type ItemVendaSemanalInput } from "@/lib/venda-semanal";

export async function POST(request: Request) {
  if (!verificarTokenN8n(request)) return respostaNaoAutorizada();

  let body: { unidade?: string; periodoInicio?: string; periodoFim?: string; itens?: ItemVendaSemanalInput[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ erro: "Corpo da requisição não é um JSON válido." }, { status: 400 });
  }

  const { unidade, periodoInicio, periodoFim, itens } = body;
  if (!unidade || !periodoInicio || !periodoFim || !Array.isArray(itens) || itens.length === 0) {
    return Response.json(
      { erro: "Informe 'unidade', 'periodoInicio', 'periodoFim' e uma lista não-vazia de 'itens'." },
      { status: 400 }
    );
  }
  for (const item of itens) {
    if (!item.nome || typeof item.quantidadeVendida !== "number") {
      return Response.json({ erro: "Cada item precisa de nome e quantidadeVendida (número)." }, { status: 400 });
    }
  }

  const servico = await prisma.usuario.findUnique({ where: { email: N8N_SERVICE_USER_EMAIL } });
  if (!servico) {
    return Response.json(
      { erro: "Usuário de serviço da integração não encontrado — rode o seed no banco de produção." },
      { status: 500 }
    );
  }

  try {
    const resultado = await processarVendaSemanal(unidade, periodoInicio, periodoFim, itens, servico.id);
    return Response.json(resultado);
  } catch (e: any) {
    if (e instanceof VendaSemanalDuplicadaError) {
      return Response.json({ erro: e.message }, { status: 409 });
    }
    return Response.json({ erro: e?.message || "Erro ao processar." }, { status: 400 });
  }
}
