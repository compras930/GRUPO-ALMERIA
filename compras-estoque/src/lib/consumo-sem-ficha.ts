// De onde vem a falta da contagem: prato sem ficha, evento, ou perda.
//
// O PROBLEMA. A conferência diz que faltam R$ 8.000 na prateleira. Parte disso
// é mercadoria que virou prato e o app não soube descontar, porque o prato não
// tem ficha. Parte é perda de verdade. Olhando o número inteiro, as duas se
// confundem — e a conversa vira "sumiu R$ 8 mil", que é acusação em cima de
// contabilidade incompleta.
//
// O QUE NÃO DÁ PARA FAZER, e é importante dizer: sem ficha, NÃO EXISTE no
// sistema nada que ligue "vendi 40 Filetto" a "saíram 6 kg de filé". Por isso
// esta quebra vale só para o TOTAL EM REAIS. As linhas por produto continuam
// mostrando a diferença inteira, sem culpado — inventar um rateio por insumo
// seria produzir número com cara de medição.
//
// A PREMISSA, que a tela precisa dizer em voz alta: "o prato sem ficha consome
// na mesma proporção dos que têm ficha". É isso e nada mais. Se as fichas
// existentes cobrem só entradas baratas e o que falta é o churrasco, a
// estimativa erra — e erra para baixo.
//
// EVENTO É LINHA PRÓPRIA, e não é detalhe de apresentação. No Beira Lago, 43%
// do faturamento é evento: pacote fechado que o PDV não detalha prato a prato
// e que NUNCA vai ter ficha, por construção. Jogado junto com "pratos sem
// ficha", ele domina a lista para sempre e a fila de fichas a escrever fica
// inútil — o topo seria sempre as mesmas quatro linhas que ninguém pode
// resolver.
//
// O TETO. Se a estimativa passar da falta, ela é cortada nela. Sem isso,
// "Perda" ficaria NEGATIVA — e número negativo ali é uma mentira com cara de
// medição. Quando corta, a tela avisa que cortou: é sinal de que a premissa
// não está valendo.
//
// Núcleo puro: sem Prisma, sem I/O.

export type VendaSemFichaResumo = {
  itemVendaId: string;
  nome: string;
  categoria: string | null;
  quantidadeVendida: number;
  faturamento: number;
  /** Venda de evento — pacote fechado, sem ficha por construção. */
  ehEvento: boolean;
};

export type QuebraDaFalta = {
  /** Parte atribuída a EVENTO, estimada. */
  eventosEmReais: number;
  /** Parte atribuída a prato de cardápio sem ficha, estimada. */
  pratosSemFichaEmReais: number;
  /** O que sobra depois das duas: perda, erro de contagem, ou sumiço. */
  perdaEmReais: number;
  /** A estimativa passou da falta e foi cortada no teto. */
  cortadaNoTeto: boolean;
  /** O CMV usado na estimativa, em %. Nulo = não deu para estimar. */
  cmvUsadoPct: number | null;
};

export function quebrarFaltaPura(
  faltaEmReais: number,
  vendas: VendaSemFichaResumo[],
  cmvTeoricoPct: number | null
): QuebraDaFalta {
  const vazia = (perda: number): QuebraDaFalta => ({
    eventosEmReais: 0,
    pratosSemFichaEmReais: 0,
    perdaEmReais: perda,
    cortadaNoTeto: false,
    cmvUsadoPct: null,
  });

  // Sem CMV teórico não há de onde tirar a proporção. Melhor devolver a falta
  // inteira como "perda" e deixar o rótulo dizer que não foi estimada, do que
  // chutar um percentual de mercado: o número do mercado não é o desta casa.
  if (cmvTeoricoPct == null || !(cmvTeoricoPct > 0)) return vazia(Math.max(0, faltaEmReais));
  // Falta zero ou negativa (sobra) não se reparte: não há consumo a explicar.
  if (!(faltaEmReais > 0)) return vazia(Math.max(0, faltaEmReais));

  const fator = cmvTeoricoPct / 100;
  const somar = (evento: boolean) =>
    vendas.filter((v) => v.ehEvento === evento).reduce((s, v) => s + Math.max(0, v.faturamento), 0) * fator;

  let eventos = somar(true);
  let pratos = somar(false);

  let cortadaNoTeto = false;
  const soma = eventos + pratos;
  if (soma > faltaEmReais) {
    // Corta proporcionalmente, preservando a razão entre as duas: cortar só
    // uma delas escolheria um culpado por conveniência aritmética.
    const escala = faltaEmReais / soma;
    eventos *= escala;
    pratos *= escala;
    cortadaNoTeto = true;
  }

  return {
    eventosEmReais: eventos,
    pratosSemFichaEmReais: pratos,
    // O max(0) é defesa contra erro de ponto flutuante depois da escala, não
    // regra de negócio: com o teto aplicado, isto nunca é negativo de verdade.
    perdaEmReais: Math.max(0, faltaEmReais - eventos - pratos),
    cortadaNoTeto,
    cmvUsadoPct: cmvTeoricoPct,
  };
}

/**
 * A fila de fichas a escrever: prato sem ficha, do que mais faturou para o que
 * menos faturou.
 *
 * ORDENA POR FATURAMENTO, não por quantidade. Trezentos cafezinhos custam menos
 * atenção que oito T-Bones, e a pergunta aqui é "qual ficha compra mais
 * exatidão por hora de trabalho".
 *
 * EVENTO FICA DE FORA, pelo mesmo motivo da quebra: ele não tem ficha a
 * escrever, então listá-lo é dar tarefa que não existe.
 */
export function filaDeFichasPura(vendas: VendaSemFichaResumo[]): VendaSemFichaResumo[] {
  return vendas
    .filter((v) => !v.ehEvento && v.faturamento > 0)
    .sort((a, b) => b.faturamento - a.faturamento || a.nome.localeCompare(b.nome, "pt-BR"));
}
