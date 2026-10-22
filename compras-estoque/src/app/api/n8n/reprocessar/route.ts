import { revalidarTelasDaCarga } from "@/lib/revalidar";
import { prisma } from "@/lib/prisma";
import { verificarTokenN8n, respostaNaoAutorizada } from "@/lib/n8n-auth";
import { N8N_SERVICE_USER_EMAIL } from "@/lib/constants";
import { reprocessarNaoReconhecidos } from "@/lib/reprocessar-nao-reconhecidos";

// Faz entrar o que já chegou e não casou, depois que o produto foi cadastrado.
// Ver o cabeçalho de src/lib/reprocessar-nao-reconhecidos.ts.
//
// Não recebe linha nenhuma: o dado já está no banco. O corpo diz só ONDE
// procurar. Isso é de propósito — reprocessar a partir do que foi gravado não
// depende de a origem reenviar nada, e é o que diferencia esta rota de
// mandar a carga de novo (que não funciona, e é o motivo desta rota existir).

// Mesmo prazo de /api/n8n/precos: a transação tolera 60s e o corte da função
// no meio dela some com a carga sem dizer por quê.
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!verificarTokenN8n(request)) return respostaNaoAutorizada();

  let body: { unidade?: string; notaCompraId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ erro: "Corpo da requisição não é um JSON válido." }, { status: 400 });
  }

  const { unidade, notaCompraId } = body;
  if (!unidade) {
    return Response.json({ erro: "Informe 'unidade' (nome exato da casa)." }, { status: 400 });
  }

  const servico = await prisma.usuario.findUnique({ where: { email: N8N_SERVICE_USER_EMAIL } });
  if (!servico) {
    return Response.json(
      { erro: "Usuário de serviço da integração não encontrado — rode o seed no banco de produção." },
      { status: 500 }
    );
  }

  try {
    const resultado = await reprocessarNaoReconhecidos(unidade, servico.id, notaCompraId);
    revalidarTelasDaCarga();
    return Response.json(resultado);
  } catch (e: any) {
    return Response.json({ erro: e?.message || "Erro ao reprocessar." }, { status: 400 });
  }
}
