// Consumo real entre duas contagens.
//
// A CONTA, e por que ela não precisa de ficha técnica:
//
//   consumo = saldo contado antes  +  entradas do período  −  saldo contado depois
//
// A contagem SOBRESCREVE o saldo. Então a diferença entre duas contagens,
// somada ao que entrou no meio, é tudo que saiu — vendido, perdido, quebrado,
// consumido pela equipe ou levado embora. É o consumo de verdade, não o que a
// receita diz que deveria ter sido gasto.
//
// Isso é o que torna o piloto possível antes das fichas: a cobertura de ficha
// do 104 Sul é de 21%, e mesmo assim o consumo em reais sai inteiro. O que a
// ficha acrescenta depois é o CMV TEÓRICO, pra comparar com este e separar
// "receita mal executada" de "coisa sumindo" — duas causas que este número
// sozinho não distingue.
//
// Núcleo puro: sem Prisma, sem I/O. Quem chama carrega e passa pronto.

export type ContagemResumo = { produtoId: string; quantidade: number; em: Date };
/** Movimento que ENTRA mercadoria (nota, recebimento, ajuste manual). */
export type EntradaResumo = { produtoId: string; quantidade: number; em: Date };

export type ConsumoProduto = {
  produtoId: string;
  de: Date;
  ate: Date;
  saldoInicial: number;
  entradas: number;
  saldoFinal: number;
  consumo: number;
  /**
   * Consumo negativo é impossível fisicamente: significa que foi contado mais
   * do que poderia existir. Quase sempre é entrada que não chegou ao sistema
   * (compra fora do Teknisa, transferência entre casas) ou contagem na unidade
   * errada — caixa contada como quilo. Nunca é "sobrou mercadoria".
   */
  alerta: "CONSUMO_NEGATIVO" | null;
};

/**
 * Considera as DUAS ÚLTIMAS contagens de cada produto. Produto contado uma vez
 * só não aparece: ainda não tem período fechado, só marco zero.
 */
export function calcularConsumoPuro(contagens: ContagemResumo[], entradas: EntradaResumo[]): ConsumoProduto[] {
  const porProduto = new Map<string, ContagemResumo[]>();
  for (const c of contagens) {
    porProduto.set(c.produtoId, [...(porProduto.get(c.produtoId) ?? []), c]);
  }

  const entradasPorProduto = new Map<string, EntradaResumo[]>();
  for (const e of entradas) {
    entradasPorProduto.set(e.produtoId, [...(entradasPorProduto.get(e.produtoId) ?? []), e]);
  }

  const saida: ConsumoProduto[] = [];
  for (const [produtoId, lista] of porProduto) {
    if (lista.length < 2) continue;
    const ordenada = [...lista].sort((a, b) => a.em.getTime() - b.em.getTime());
    const anterior = ordenada[ordenada.length - 2];
    const atual = ordenada[ordenada.length - 1];

    // Entrada exatamente no instante da contagem anterior fica de FORA: a
    // contagem já viu aquela mercadoria na prateleira. No instante da contagem
    // atual fica DENTRO, porque a contagem é feita depois de guardar o que
    // chegou no dia.
    const entradas = (entradasPorProduto.get(produtoId) ?? [])
      .filter((e) => e.em > anterior.em && e.em <= atual.em)
      .reduce((s, e) => s + e.quantidade, 0);

    const consumo = anterior.quantidade + entradas - atual.quantidade;
    saida.push({
      produtoId,
      de: anterior.em,
      ate: atual.em,
      saldoInicial: anterior.quantidade,
      entradas,
      saldoFinal: atual.quantidade,
      consumo,
      alerta: consumo < 0 ? "CONSUMO_NEGATIVO" : null,
    });
  }
  return saida;
}

/** Tipos de movimento que representam mercadoria ENTRANDO na despensa. */
export const TIPOS_DE_ENTRADA = ["ENTRADA_NOTA", "ENTRADA_RECEBIMENTO", "AJUSTE_MANUAL"] as const;
// AJUSTE_CONTAGEM fica de fora de propósito: ele é o acerto que a própria
// contagem gera. Somá-lo seria contar a contagem duas vezes.
// SAIDA_CONSUMO também: é a baixa TEÓRICA, calculada da ficha. Este relatório
// mede o que saiu de verdade, e misturar as duas coisas apagaria justamente a
// diferença que interessa.
