import { prisma } from "@/lib/prisma";
import { verificarTokenN8n, respostaNaoAutorizada } from "@/lib/n8n-auth";
import { N8N_SERVICE_USER_EMAIL } from "@/lib/constants";
import { processarNotaCompra, type ItemPrecoInput } from "@/lib/nota-compra";

export async function POST(request: Request) {
  if (!verificarTokenN8n(request)) return respostaNaoAutorizada();

  let body: { unidade?: string; arquivoNome?: string; itens?: ItemPrecoInput[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ erro: "Corpo da requisição não é um JSON válido." }, { status: 400 });
  }

  const { unidade, arquivoNome, itens } = body;
  if (!unidade || !Array.isArray(itens) || itens.length === 0) {
    return Response.json({ erro: "Informe 'unidade' e uma lista não-vazia de 'itens'." }, { status: 400 });
  }
  for (const item of itens) {
    if (!item.nome || !item.unidadeMedida || typeof item.preco !== "number" || !item.dataCompra) {
      return Response.json(
        { erro: "Cada item precisa de nome, unidadeMedida, preco (número) e dataCompra." },
        { status: 400 }
      );
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
    const resultado = await processarNotaCompra(unidade, arquivoNome ?? null, itens, servico.id);
    return Response.json(resultado);
  } catch (e: any) {
    return Response.json({ erro: e?.message || "Erro ao processar." }, { status: 400 });
  }
}
