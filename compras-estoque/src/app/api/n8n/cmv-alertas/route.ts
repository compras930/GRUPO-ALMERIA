import { prisma } from "@/lib/prisma";
import { verificarTokenN8n, respostaNaoAutorizada } from "@/lib/n8n-auth";
import { listarItensComCusto } from "@/lib/cmv";
import { TIPO_ITEM_VENDA } from "@/lib/constants";

const CAMPO_META: Record<(typeof TIPO_ITEM_VENDA)[number], "metaCmvPratos" | "metaCmvBebidas" | "metaCmvVinhos"> = {
  PRATO: "metaCmvPratos",
  BEBIDA: "metaCmvBebidas",
  VINHO: "metaCmvVinhos",
};

export async function GET(request: Request) {
  if (!verificarTokenN8n(request)) return respostaNaoAutorizada();

  const { searchParams } = new URL(request.url);
  const unidadeNome = searchParams.get("unidade");

  const unidades = await prisma.unidade.findMany({
    where: unidadeNome ? { nome: unidadeNome } : undefined,
  });
  if (unidadeNome && unidades.length === 0) {
    return Response.json({ erro: `Unidade "${unidadeNome}" não encontrada.` }, { status: 400 });
  }

  const alertas: {
    unidade: string;
    tipo: string;
    nome: string;
    custo: number;
    cmv: number;
    metaCmv: number;
    excedentePercentual: number;
  }[] = [];

  for (const unidade of unidades) {
    for (const tipo of TIPO_ITEM_VENDA) {
      const meta = unidade[CAMPO_META[tipo]];
      if (meta == null) continue;
      const itens = await listarItensComCusto(unidade.id, tipo);
      for (const item of itens) {
        if (item.status !== "OK" || item.cmv == null || item.custo == null) continue;
        if (item.cmv > meta) {
          alertas.push({
            unidade: unidade.nome,
            tipo,
            nome: item.nome,
            custo: item.custo,
            cmv: item.cmv,
            metaCmv: meta,
            excedentePercentual: (item.cmv - meta) * 100,
          });
        }
      }
    }
  }

  return Response.json({ totalAlertas: alertas.length, alertas });
}
