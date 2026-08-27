// Explosão recursiva de ficha técnica (Receita -> IngredienteReceita, que
// pode apontar pra um Produto comprado OU pra outra Receita/sub-receita) e
// cálculo de custo a partir do preço atual de cada insumo.
//
// Custo/CMV NUNCA são persistidos como coluna estática — são sempre
// calculados aqui, em tempo de leitura, a partir de PrecoAtualProduto. É
// isso que torna a cascata de atualização de preço (subir nota de compra ->
// ver quais pratos mudaram de CMV) automática, sem precisar re-editar cada
// ficha manualmente.
//
// A parte recursiva (explodirReceitaPura) é pura/síncrona e não toca no
// banco, de propósito — é a peça de maior risco de todo o módulo
// (recursiva, alimenta número financeiro, dados reais já mostraram
// referências quase-cíclicas) e precisa ser testável sem precisar de um
// banco de dados rodando. As funções async ao final só carregam os dados
// do Prisma e chamam a parte pura.
import { prisma } from "@/lib/prisma";

export type IngredienteIndexado = {
  produtoId: string | null;
  subReceitaId: string | null;
  quantidade: number;
};

export type ReceitaIndexada = {
  rendimentoQtd: number | null;
  ingredientes: IngredienteIndexado[];
};

export type IndiceReceitas = Map<string, ReceitaIndexada>;

export class CicloReceitaError extends Error {
  constructor(public readonly caminho: string[]) {
    super(`Ciclo detectado em receita: ${caminho.join(" -> ")}`);
    this.name = "CicloReceitaError";
  }
}

/**
 * Explode uma receita recursivamente e retorna, achatado, quanto de cada
 * Produto (insumo comprado) é necessário para atender `qtdSolicitada`
 * unidades do que a receita produz.
 *
 * `qtdSolicitada` está na unidade de uso do chamador: no topo (a partir de
 * um ItemVenda), é a quantidade vendida do prato/bebida/vinho; numa
 * recursão (sub-receita), é a quantidade da sub-receita consumida pela
 * receita-mãe.
 *
 * Se a receita tem `rendimentoQtd` definido (ex.: "essa sub-receita rende
 * 0,5kg"), a quantidade de cada ingrediente (definida para 1 lote inteiro)
 * é escalada por `qtdSolicitada / rendimentoQtd` (que fração de um lote
 * está sendo usada). Sem rendimento definido, assume-se que
 * `qtdSolicitada` já representa "quantos lotes inteiros" (equivalente à
 * unidade "Und" do dashboard antigo) — mesma convenção usada lá.
 */
export function explodirReceitaPura(
  receitaId: string,
  qtdSolicitada: number,
  indice: IndiceReceitas,
  visitados: ReadonlySet<string> = new Set()
): Map<string, number> {
  if (visitados.has(receitaId)) {
    throw new CicloReceitaError([...visitados, receitaId]);
  }
  const receita = indice.get(receitaId);
  const totais = new Map<string, number>();
  if (!receita) return totais; // receita referenciada não existe no índice — não deveria acontecer, mas não é motivo pra travar a explosão inteira

  const proximosVisitados = new Set(visitados);
  proximosVisitados.add(receitaId);

  const fatorLote =
    receita.rendimentoQtd && receita.rendimentoQtd > 0
      ? qtdSolicitada / receita.rendimentoQtd
      : qtdSolicitada;

  for (const ing of receita.ingredientes) {
    const qtdEfetiva = ing.quantidade * fatorLote;
    if (ing.produtoId) {
      totais.set(ing.produtoId, (totais.get(ing.produtoId) ?? 0) + qtdEfetiva);
    } else if (ing.subReceitaId) {
      const subTotais = explodirReceitaPura(ing.subReceitaId, qtdEfetiva, indice, proximosVisitados);
      for (const [produtoId, qtd] of subTotais) {
        totais.set(produtoId, (totais.get(produtoId) ?? 0) + qtd);
      }
    }
    // ingrediente sem produtoId nem subReceitaId: linha inconsistente, ignorada silenciosamente
    // aqui (validação de exclusividade mútua acontece na escrita, não na leitura).
  }
  return totais;
}

/** Carrega todas as Receitas + IngredienteReceita de uma unidade num único índice em memória. */
export async function carregarIndiceReceitas(unidadeId: string): Promise<IndiceReceitas> {
  const receitas = await prisma.receita.findMany({
    where: { unidadeId },
    include: { ingredientes: true },
  });
  const indice: IndiceReceitas = new Map();
  for (const r of receitas) {
    indice.set(r.id, {
      rendimentoQtd: r.rendimentoQtd,
      ingredientes: r.ingredientes.map((i) => ({
        produtoId: i.produtoId,
        subReceitaId: i.subReceitaId,
        quantidade: i.quantidade,
      })),
    });
  }
  return indice;
}

/** Carrega o preço atual (por unidade) de cada Produto, pra usar na precificação da explosão. */
export async function carregarPrecoAtualPorProduto(unidadeId: string): Promise<Map<string, number>> {
  const precos = await prisma.precoAtualProduto.findMany({ where: { unidadeId } });
  return new Map(precos.map((p) => [p.produtoId, p.preco]));
}

/** Wrapper conveniente: carrega o índice do banco e explode uma receita. */
export async function explodirReceita(
  receitaId: string,
  qtdSolicitada: number,
  unidadeId: string
): Promise<Map<string, number>> {
  const indice = await carregarIndiceReceitas(unidadeId);
  return explodirReceitaPura(receitaId, qtdSolicitada, indice);
}

/**
 * Custo de uma receita a partir do preço atual dos insumos.
 * `custoLote` = custo pra produzir 1 lote inteiro (ou 1 "Und" se não há rendimento).
 * `custoPorUnidadeRendimento` = custoLote / rendimentoQtd, só quando rendimento existe.
 */
export async function custoReceita(
  receitaId: string,
  unidadeId: string
): Promise<{ custoLote: number; custoPorUnidadeRendimento: number | null }> {
  const [indice, precos] = await Promise.all([
    carregarIndiceReceitas(unidadeId),
    carregarPrecoAtualPorProduto(unidadeId),
  ]);
  const receita = indice.get(receitaId);
  const qtdBase = receita?.rendimentoQtd && receita.rendimentoQtd > 0 ? receita.rendimentoQtd : 1;
  const insumos = explodirReceitaPura(receitaId, qtdBase, indice);
  let custoLote = 0;
  for (const [produtoId, qtd] of insumos) {
    custoLote += qtd * (precos.get(produtoId) ?? 0);
  }
  return {
    custoLote,
    custoPorUnidadeRendimento: receita?.rendimentoQtd ? custoLote / receita.rendimentoQtd : null,
  };
}
