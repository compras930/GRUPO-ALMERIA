// CMV CONTADO, semana a semana.
//
// É o número que a rotação nova de contagem (curva A toda semana) existe para
// produzir, e é o único dos três CMVs que responde "quanto SAIU da despensa
// de verdade" — os outros dois são proxy (compras ÷ vendas) e teoria (ficha).
//
// A CONTA, por produto e por semana:
//
//   consumo = contagem da segunda  +  entradas da semana  −  contagem da segunda seguinte
//
// A contagem SOBREESCREVE o saldo, então a diferença entre duas contagens do
// MESMO item, somada ao que entrou no meio, é tudo que saiu: vendido, perdido,
// quebrado, comido pela equipe ou levado embora. Em reais, pelo preço atual —
// custo nunca é coluna gravada neste projeto, é sempre recalculado.
//
// POR QUE SEMANAL MUDA ALGUMA COISA. Com o rodízio antigo, um item fechava
// período de quinze em quinze dias e o desvio aparecia até trinta dias depois,
// quando ninguém lembra o que houve. Semanal, ele aparece na segunda seguinte,
// com a semana ainda fresca na cabeça de quem trabalhou nela.
//
// A COBERTURA VEM JUNTO, SEMPRE. Só entra no consumo o produto contado nas
// DUAS pontas da semana: a curva A inteira e a metade da B daquela semana. Um
// CMV de 22% calculado sobre 60% do estoque não é 22% — e a tela diz isso em
// vez de deixar alguém levar o número para a diretoria achando que é o todo.
//
// Núcleo puro: sem Prisma, sem I/O.

export type ContagemDoProduto = { produtoId: string; quantidade: number; em: Date };
export type EntradaDoProduto = { produtoId: string; quantidade: number; em: Date };

export type ConsumoDeSemana = {
  produtoId: string;
  de: Date;
  ate: Date;
  saldoInicial: number;
  entradas: number;
  saldoFinal: number;
  quantidade: number;
  /** Ver o alerta em src/lib/consumo.ts: negativo é entrada que faltou. */
  negativo: boolean;
};

/**
 * TODOS os períodos fechados de cada produto, e não só o último.
 *
 * É a diferença entre esta função e `calcularConsumoPuro` (src/lib/consumo.ts),
 * que responde "quanto saiu desde a contagem anterior" para a tela de consumo.
 * Aqui a pergunta é a série: quero as doze últimas semanas lado a lado.
 */
export function consumoPorPeriodoPuro(
  contagens: ContagemDoProduto[],
  entradas: EntradaDoProduto[]
): ConsumoDeSemana[] {
  const porProduto = new Map<string, ContagemDoProduto[]>();
  for (const c of contagens) {
    if (!porProduto.has(c.produtoId)) porProduto.set(c.produtoId, []);
    porProduto.get(c.produtoId)!.push(c);
  }
  const entradasPorProduto = new Map<string, EntradaDoProduto[]>();
  for (const e of entradas) {
    if (!entradasPorProduto.has(e.produtoId)) entradasPorProduto.set(e.produtoId, []);
    entradasPorProduto.get(e.produtoId)!.push(e);
  }

  const saida: ConsumoDeSemana[] = [];
  for (const [produtoId, lista] of porProduto) {
    const ordenada = [...lista].sort((a, b) => a.em.getTime() - b.em.getTime());
    const doProduto = entradasPorProduto.get(produtoId) ?? [];
    for (let i = 1; i < ordenada.length; i++) {
      const anterior = ordenada[i - 1];
      const atual = ordenada[i];
      // Entrada no instante EXATO da contagem anterior já está refletida nela
      // (a contagem é o que a prateleira tinha), então o intervalo é aberto no
      // início e fechado no fim.
      const entradasNoPeriodo = doProduto
        .filter((e) => e.em > anterior.em && e.em <= atual.em)
        .reduce((s, e) => s + e.quantidade, 0);
      const quantidade = anterior.quantidade + entradasNoPeriodo - atual.quantidade;
      saida.push({
        produtoId,
        de: anterior.em,
        ate: atual.em,
        saldoInicial: anterior.quantidade,
        entradas: entradasNoPeriodo,
        saldoFinal: atual.quantidade,
        quantidade,
        negativo: quantidade < 0,
      });
    }
  }
  return saida;
}

export type SemanaDeCmv = {
  /** Segunda-feira da semana, AAAA-MM-DD. */
  semana: string;
  /** Consumo contado, em reais. */
  consumo: number;
  /** Venda da semana, em reais. */
  venda: number;
  /** consumo ÷ venda. Null quando não há venda carregada — e aí não há CMV. */
  cmv: number | null;
  /** Produtos com período fechado nesta semana. */
  itens: number;
  /** Quantos deram consumo negativo — contagem ou entrada faltando. */
  negativos: number;
  /** Valor comprado na semana, para a cobertura fazer sentido. */
  compra: number;
  /**
   * Quanto da compra da semana está representada pelos itens contados. É a
   * régua honesta: CMV de 22% sobre 60% do estoque não é 22%.
   */
  cobertura: number | null;
};

const DIA = 24 * 60 * 60 * 1000;

/** A segunda-feira da semana a que a data pertence, no fuso de Brasília. */
export function segundaDaDataPura(d: Date): string {
  const local = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  const diaDaSemana = local.getUTCDay();
  const recuo = (diaDaSemana + 6) % 7;
  return new Date(local.getTime() - recuo * DIA).toISOString().slice(0, 10);
}

/**
 * Junta tudo numa linha por semana.
 *
 * A SEMANA DE UM CONSUMO É A DA CONTAGEM QUE O FECHOU. O período entre a
 * contagem de 09/11 e a de 16/11 é a semana de 09/11: é nela que a mercadoria
 * saiu. Carimbar pela contagem final jogaria o consumo para a semana seguinte
 * e desencontraria consumo de venda em sete dias — justo o erro que faz o CMV
 * semanal parecer ruído.
 */
export function cmvSemanalPuro(entrada: {
  consumos: ConsumoDeSemana[];
  precoPorProduto: Map<string, number>;
  /** Venda por semana (segunda -> reais). */
  vendaPorSemana: Map<string, number>;
  /** Compra por semana (segunda -> reais), para a cobertura. */
  compraPorSemana: Map<string, number>;
  /** Compra por semana SÓ dos produtos contados. */
  compraContadaPorSemana: Map<string, number>;
}): SemanaDeCmv[] {
  const porSemana = new Map<string, { consumo: number; itens: number; negativos: number }>();
  for (const c of entrada.consumos) {
    const semana = segundaDaDataPura(c.de);
    const atual = porSemana.get(semana) ?? { consumo: 0, itens: 0, negativos: 0 };
    // Consumo negativo entra como ZERO no dinheiro, mas é contado à parte.
    // Somar negativo abateria o consumo de outro produto e deixaria o CMV mais
    // bonito justamente quando falta informação.
    const preco = entrada.precoPorProduto.get(c.produtoId) ?? 0;
    atual.consumo += Math.max(0, c.quantidade) * preco;
    atual.itens++;
    if (c.negativo) atual.negativos++;
    porSemana.set(semana, atual);
  }

  const semanas = new Set([...porSemana.keys(), ...entrada.vendaPorSemana.keys()]);
  return [...semanas]
    .sort()
    .reverse()
    .map((semana) => {
      const d = porSemana.get(semana) ?? { consumo: 0, itens: 0, negativos: 0 };
      const venda = entrada.vendaPorSemana.get(semana) ?? 0;
      const compra = entrada.compraPorSemana.get(semana) ?? 0;
      const compraContada = entrada.compraContadaPorSemana.get(semana) ?? 0;
      return {
        semana,
        consumo: d.consumo,
        venda,
        cmv: venda > 0 && d.itens > 0 ? d.consumo / venda : null,
        itens: d.itens,
        negativos: d.negativos,
        compra,
        cobertura: compra > 0 ? compraContada / compra : null,
      };
    });
}
