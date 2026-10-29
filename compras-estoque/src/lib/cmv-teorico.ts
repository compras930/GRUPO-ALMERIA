// O CMV teórico de um conjunto de linhas de venda: quanto a ficha diz que
// deveria ter sido gasto para fazer o que foi vendido.
//
// SÓ SOBRE O QUE TEM FICHA, nas duas pontas. O custo sai das fichas e o
// faturamento do denominador conta só os itens que têm ficha. Dividir o custo
// de metade do cardápio pelo faturamento inteiro não daria um CMV baixo —
// daria um número sem significado, e com aparência de boa notícia.
//
// Existe aqui, e não dentro de uma tela, porque duas telas precisam do mesmo
// número: o painel o mostra como indicador, e a conferência da contagem o usa
// como proporção para estimar quanto da falta veio de prato sem ficha
// (src/lib/consumo-sem-ficha.ts). Dois cálculos para a mesma coisa acabariam
// discordando, e aí as duas telas se desmentiriam.
import { carregarIndiceReceitas, carregarPrecoAtualPorProduto, explodirReceitaPura, CicloReceitaError } from "@/lib/receita";
import { faturamentoDaLinhaPura } from "@/lib/faturamento";

export type LinhaComFicha = {
  quantidadeVendida: number;
  valorVendido: number | null;
  itemVenda: { id: string; precoVenda: number; receitaId: string | null } | null;
};

export type CmvTeorico = {
  custoTeorico: number;
  vendaComFicha: number;
  /** Em %, ou nulo quando nenhuma linha com ficha entrou na conta. */
  pct: number | null;
  /** Itens distintos que apareceram na venda e não tinham ficha utilizável. */
  itensSemFicha: number;
};

export async function calcularCmvTeorico(casaId: string, linhas: LinhaComFicha[]): Promise<CmvTeorico> {
  const vazio: CmvTeorico = { custoTeorico: 0, vendaComFicha: 0, pct: null, itensSemFicha: 0 };
  if (linhas.length === 0) return vazio;

  const [indice, precos] = await Promise.all([
    carregarIndiceReceitas(casaId),
    carregarPrecoAtualPorProduto(casaId),
  ]);

  let custoTeorico = 0;
  let vendaComFicha = 0;
  const semFicha = new Set<string>();

  for (const l of linhas) {
    const item = l.itemVenda;
    if (!item) continue;
    if (!item.receitaId) {
      semFicha.add(item.id);
      continue;
    }
    try {
      const receita = indice.get(item.receitaId);
      // A ficha é de um LOTE (o rendimento); o custo por porção é o lote
      // dividido pelo rendimento. Ficha sem rendimento é tratada como lote de
      // 1, que é o mesmo palpite que o painel faz — e é por isso que ficha sem
      // rendimento aparece na lista de pendências.
      const base = receita?.rendimentoQtd && receita.rendimentoQtd > 0 ? receita.rendimentoQtd : 1;
      const insumos = explodirReceitaPura(item.receitaId, base, indice);
      let custoLote = 0;
      for (const [produtoId, qtd] of insumos) custoLote += qtd * (precos.get(produtoId) ?? 0);
      const custoUnit = receita?.rendimentoQtd && receita.rendimentoQtd > 0 ? custoLote / receita.rendimentoQtd : custoLote;
      custoTeorico += custoUnit * l.quantidadeVendida;
      vendaComFicha += faturamentoDaLinhaPura({
        quantidadeVendida: l.quantidadeVendida,
        valorVendido: l.valorVendido,
        precoVenda: item.precoVenda,
      });
    } catch (e) {
      // Ficha em ciclo não derruba a tela: ela sai da conta e o item conta
      // como sem ficha, que é o que ele é na prática até alguém corrigir.
      if (e instanceof CicloReceitaError) semFicha.add(item.id);
      else throw e;
    }
  }

  return {
    custoTeorico,
    vendaComFicha,
    pct: vendaComFicha > 0 ? (100 * custoTeorico) / vendaComFicha : null,
    itensSemFicha: semFicha.size,
  };
}
