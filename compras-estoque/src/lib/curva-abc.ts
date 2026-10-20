// Curva ABC de compra: ordena por valor, acumula, e classifica.
//
// Núcleo puro: sem Prisma, sem I/O.
//
// A REGRA, e por que estes cortes. A classe sai do ACUMULADO, não do valor
// isolado: A é o conjunto que responde pelos primeiros 80% do dinheiro, B vai
// até 95%, C é o resto. São os mesmos 80% que definiram a curva A de contagem
// do Beira Lago (112 itens de 563), e usar o mesmo corte nos dois lugares é o
// que deixa o painel e a folha de contagem falarem da mesma coisa.
//
// O item que CRUZA a fronteira pertence à classe de baixo — ele entra em A
// mesmo que o acumulado passe de 80% com ele. Cortar antes deixaria de fora
// justamente o item que fecha os 80%.

export const CORTE_A = 80;
export const CORTE_B = 95;

export type ItemAbc = { id: string; nome: string; unidadeMedida: string; categoria: string | null; valor: number };
export type ItemClassificado = ItemAbc & {
  /** Posição na ordenação por valor, começando em 1. */
  posicao: number;
  /** Percentual do total que este item sozinho representa. */
  pct: number;
  /** Percentual acumulado até este item, inclusive. */
  acumulado: number;
  classe: "A" | "B" | "C";
};

export function curvaAbcPura(itens: ItemAbc[]): ItemClassificado[] {
  const positivos = itens.filter((i) => i.valor > 0);
  const total = positivos.reduce((s, i) => s + i.valor, 0);
  if (total === 0) return [];

  // Desempate por nome: duas compras de mesmo valor trocariam de posição a
  // cada carregamento da página, e lista que dança é lista em que não se
  // confia.
  const ordenados = [...positivos].sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome));

  let acumuladoValor = 0;
  return ordenados.map((i, n) => {
    const antes = (100 * acumuladoValor) / total;
    acumuladoValor += i.valor;
    const acumulado = (100 * acumuladoValor) / total;
    // Compara com o acumulado ANTES de incluir o item: é o que coloca o item
    // que cruza a linha dentro da classe de cima, e não fora dela.
    const classe = antes < CORTE_A ? "A" : antes < CORTE_B ? "B" : "C";
    return { ...i, posicao: n + 1, pct: (100 * i.valor) / total, acumulado, classe };
  });
}

/** Quantos itens e quanto dinheiro em cada classe — o resumo de uma linha. */
export function resumoAbcPura(classificados: ItemClassificado[]) {
  return (["A", "B", "C"] as const).map((classe) => {
    const lista = classificados.filter((i) => i.classe === classe);
    return {
      classe,
      itens: lista.length,
      valor: lista.reduce((s, i) => s + i.valor, 0),
      pct: lista.reduce((s, i) => s + i.pct, 0),
    };
  });
}
