import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verificarTokenN8n, respostaNaoAutorizada } from "@/lib/n8n-auth";
import { N8N_SERVICE_USER_EMAIL } from "@/lib/constants";
import { processarNotaCompra, type ItemPrecoInput } from "@/lib/nota-compra";

// A carga real é grande: a planilha semanal do Teknisa chega com ~2200 linhas
// de nota, que viram ~440 por casa. O $transaction aqui tolera 60s, mas a
// função da Vercel corta antes disso no padrão — e o corte no meio de uma
// transação some com a carga inteira sem dizer por quê. Os dois prazos
// precisam ser o mesmo número.
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!verificarTokenN8n(request)) return respostaNaoAutorizada();

  let body: { unidade?: string; arquivoNome?: string; aprenderCodigos?: boolean; itens?: ItemPrecoInput[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ erro: "Corpo da requisição não é um JSON válido." }, { status: 400 });
  }

  const { unidade, arquivoNome, aprenderCodigos, itens } = body;
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
    // `codigo` é opcional (origem antiga não tem) mas, quando vem, é o que
    // manda no casamento — então tem que ser texto. O código do Teknisa tem 12
    // dígitos e chega como número quando a planilha é lida como número;
    // aceitamos e convertemos, em vez de recusar a carga toda.
    if (item.codigo != null && typeof item.codigo !== "string") {
      item.codigo = String(item.codigo);
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
    const resultado = await processarNotaCompra(
      unidade,
      arquivoNome ?? null,
      itens,
      servico.id,
      aprenderCodigos === true
    );
    revalidatePath("/cmv");
    revalidatePath("/receitas");
    revalidatePath("/produtos");
    return Response.json(resultado);
  } catch (e: any) {
    return Response.json({ erro: e?.message || "Erro ao processar." }, { status: 400 });
  }
}
