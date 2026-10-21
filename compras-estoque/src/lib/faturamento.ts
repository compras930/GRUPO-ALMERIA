// Quanto uma linha de venda faturou.
//
// Núcleo puro: sem Prisma, sem I/O.
//
// A REGRA, e por que ela tem duas pernas:
//
//   valor declarado pela origem   ->  usa ele
//   origem não declarou           ->  quantidade × preço cadastrado
//
// O DECLARADO GANHA SEMPRE. O preço cadastrado é o do cardápio; o valor
// declarado é o que o cliente pagou. Entre os dois, quem manda no faturamento
// é a segunda — ela já tem dentro a cortesia, o preço promocional e o
// reajuste que ninguém repassou ao cadastro.
//
// Medido: na semana de 13–19/10 do Beira Lago, recalcular dava R$ 400.989,60
// contra R$ 403.360,64 de verdade. 12 de 68 preços estavam defasados (FILETTO
// DI MANZO a 155 quando o cardápio já cobrava 175), e uma garrafa de cortesia
// lançada a R$ 0,01 entrava valendo R$ 400.
//
// O ERRO É SISTEMÁTICO, não aleatório: cardápio sobe e cadastro fica parado,
// então o recálculo subestima o faturamento quase sempre. Subestimar o
// faturamento INFLA todo CMV, porque ele é o denominador — e CMV inflado é o
// tipo de número que ninguém questiona, porque "ruim" parece plausível.
//
// A SEGUNDA PERNA NÃO É LEGADO que um dia se apaga. Ela cobre a origem que
// manda só quantidade, e cobre a linha que não casou com item nenhum (sem
// item não há preço: fatura zero, que é o certo — não se inventa receita de
// algo que não se sabe o que é).

export type LinhaFaturavel = {
  quantidadeVendida: number;
  /** O que a origem declarou. Null/undefined quando ela não manda valor. */
  valorVendido?: number | null;
  /** Preço do cadastro. Null quando a linha não casou com item nenhum. */
  precoVenda?: number | null;
};

export function faturamentoDaLinhaPura(linha: LinhaFaturavel): number {
  // `!= null` e não `>` zero: venda de R$ 0,00 existe (cortesia declarada como
  // tal) e é informação. Trocá-la pelo preço de cardápio inventaria receita.
  if (linha.valorVendido != null) return linha.valorVendido;
  return linha.quantidadeVendida * (linha.precoVenda ?? 0);
}

export function faturamentoTotalPura(linhas: LinhaFaturavel[]): number {
  return linhas.reduce((s, l) => s + faturamentoDaLinhaPura(l), 0);
}

/**
 * Quantas linhas ainda dependem do preço cadastrado. É o tamanho da parte do
 * faturamento que é estimativa, e serve pra dizer na tela quando o número
 * ainda não é o declarado.
 */
export function linhasEstimadasPura(linhas: LinhaFaturavel[]): number {
  return linhas.filter((l) => l.valorVendido == null).length;
}
