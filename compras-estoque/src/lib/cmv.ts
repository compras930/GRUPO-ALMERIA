// Camada de leitura pro módulo de CMV: junta ItemVenda + Receita + preço
// atual dos insumos (via src/lib/receita.ts) num só lugar, e classifica
// cada item numa das 3 situações que a tela de CMV precisa distinguir.
import { prisma } from "@/lib/prisma";
import {
  carregarIndiceReceitas,
  carregarPrecoAtualPorProduto,
  explodirReceitaPura,
  CicloReceitaError,
  type IndiceReceitas,
} from "@/lib/receita";

export type StatusCmv = "OK" | "SEM_FICHA" | "CICLO";

export type ItemComCusto = {
  id: string;
  nome: string;
  categoria: string | null;
  tipo: string;
  precoVenda: number;
  receitaId: string | null;
  custo: number | null;
  cmv: number | null;
  status: StatusCmv;
};

function custoDeReceita(
  receitaId: string,
  indice: IndiceReceitas,
  precos: Map<string, number>
): { custo: number } | { erro: "CICLO" } {
  const receita = indice.get(receitaId);
  const qtdBase = receita?.rendimentoQtd && receita.rendimentoQtd > 0 ? receita.rendimentoQtd : 1;
  try {
    const insumos = explodirReceitaPura(receitaId, qtdBase, indice);
    let custoLote = 0;
    for (const [produtoId, qtd] of insumos) custoLote += qtd * (precos.get(produtoId) ?? 0);
    const custo = receita?.rendimentoQtd && receita.rendimentoQtd > 0 ? custoLote / receita.rendimentoQtd : custoLote;
    return { custo };
  } catch (e) {
    if (e instanceof CicloReceitaError) return { erro: "CICLO" };
    throw e;
  }
}

export async function listarItensComCusto(unidadeId: string, tipo?: string): Promise<ItemComCusto[]> {
  const [itens, indice, precos] = await Promise.all([
    prisma.itemVenda.findMany({
      where: { unidadeId, ...(tipo ? { tipo } : {}) },
      orderBy: [{ categoria: "asc" }, { nome: "asc" }],
    }),
    carregarIndiceReceitas(unidadeId),
    carregarPrecoAtualPorProduto(unidadeId),
  ]);

  return itens.map((item) => {
    if (!item.receitaId) {
      return {
        id: item.id,
        nome: item.nome,
        categoria: item.categoria,
        tipo: item.tipo,
        precoVenda: item.precoVenda,
        receitaId: null,
        custo: null,
        cmv: null,
        status: "SEM_FICHA",
      };
    }
    const resultado = custoDeReceita(item.receitaId, indice, precos);
    if ("erro" in resultado) {
      return {
        id: item.id,
        nome: item.nome,
        categoria: item.categoria,
        tipo: item.tipo,
        precoVenda: item.precoVenda,
        receitaId: item.receitaId,
        custo: null,
        cmv: null,
        status: "CICLO",
      };
    }
    const cmv = item.precoVenda ? resultado.custo / item.precoVenda : null;
    return {
      id: item.id,
      nome: item.nome,
      categoria: item.categoria,
      tipo: item.tipo,
      precoVenda: item.precoVenda,
      receitaId: item.receitaId,
      custo: resultado.custo,
      cmv,
      status: "OK",
    };
  });
}

/** Mesma lógica de um único item, reaproveitada na tela de detalhe (carrega o índice sozinha). */
export async function custoItemVenda(itemVendaId: string) {
  const item = await prisma.itemVenda.findUnique({ where: { id: itemVendaId } });
  if (!item) return null;
  if (!item.receitaId) return { item, custo: null, cmv: null, status: "SEM_FICHA" as StatusCmv };
  const [indice, precos] = await Promise.all([
    carregarIndiceReceitas(item.unidadeId),
    carregarPrecoAtualPorProduto(item.unidadeId),
  ]);
  const resultado = custoDeReceita(item.receitaId, indice, precos);
  if ("erro" in resultado) return { item, custo: null, cmv: null, status: "CICLO" as StatusCmv };
  const cmv = item.precoVenda ? resultado.custo / item.precoVenda : null;
  return { item, custo: resultado.custo, cmv, status: "OK" as StatusCmv };
}
