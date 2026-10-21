import { revalidatePath } from "next/cache";
import { verificarTokenN8n, respostaNaoAutorizada } from "@/lib/n8n-auth";
import { reprocessarVendasNaoReconhecidas } from "@/lib/reprocessar-vendas";

// Faz entrar a venda que já chegou e não casou, depois que o item de venda foi
// cadastrado. Ver o cabeçalho de src/lib/reprocessar-vendas.ts.
//
// Não recebe linha nenhuma: o dado já está no banco. Reenviar a semana não
// resolveria — ela volta 409, porque na venda a identidade é o período inteiro.

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!verificarTokenN8n(request)) return respostaNaoAutorizada();

  let body: { unidade?: string; vendaSemanalId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ erro: "Corpo da requisição não é um JSON válido." }, { status: 400 });
  }

  const { unidade, vendaSemanalId } = body;
  if (!unidade) {
    return Response.json({ erro: "Informe 'unidade' (nome exato da casa)." }, { status: 400 });
  }

  try {
    const resultado = await reprocessarVendasNaoReconhecidas(unidade, vendaSemanalId);
    revalidatePath("/dashboard");
    revalidatePath("/cmv");
    revalidatePath("/estoque");
    return Response.json(resultado);
  } catch (e: any) {
    return Response.json({ erro: e?.message || "Erro ao reprocessar vendas." }, { status: 400 });
  }
}
