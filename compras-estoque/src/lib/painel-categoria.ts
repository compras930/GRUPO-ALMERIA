// Agrupamento por categoria para o painel: compra e venda, a mesma conta.
//
// Núcleo puro: sem Prisma, sem I/O. Quem chama carrega e passa pronto.
//
// POR QUE "SEM CATEGORIA" É UMA LINHA, E NÃO UM DESCARTE. A categoria vem do
// cadastro do produto, e cadastro incompleto é a regra, não a exceção: dos
// produtos do Beira Lago, só os 393 cadastrados pela carga do XMenu nasceram
// com grupo. Somar só o que tem categoria daria um total menor que a compra
// real, e um painel que não fecha com a nota é pior que painel nenhum — ele
// mente com cara de precisão. A linha "Sem categoria" é o tamanho do que falta
// cadastrar, e serve de tarefa.

export const SEM_CATEGORIA = "Sem categoria";

export type LinhaCategoria = { categoria: string | null; valor: number };
export type TotalCategoria = { categoria: string; valor: number; pct: number };

/**
 * Soma por categoria, do maior para o menor, com o percentual do total.
 *
 * "Sem categoria" fica SEMPRE por último, por maior que seja: ela não é uma
 * categoria entre outras, é o buraco. Misturada na ordenação, ela viraria a
 * primeira linha do painel e empurraria pra baixo o que de fato se quer ler.
 */
export function totaisPorCategoriaPura(linhas: LinhaCategoria[]): TotalCategoria[] {
  const soma = new Map<string, number>();
  for (const l of linhas) {
    const chave = l.categoria?.trim() || SEM_CATEGORIA;
    soma.set(chave, (soma.get(chave) ?? 0) + l.valor);
  }
  const total = [...soma.values()].reduce((s, v) => s + v, 0);
  return [...soma]
    .map(([categoria, valor]) => ({
      categoria,
      valor,
      // Total zero acontece (período sem compra): dividir daria NaN, e NaN na
      // tela vira "NaN%" em vez de 0%.
      pct: total === 0 ? 0 : (100 * valor) / total,
    }))
    .sort((a, b) => {
      if (a.categoria === SEM_CATEGORIA) return 1;
      if (b.categoria === SEM_CATEGORIA) return -1;
      return b.valor - a.valor;
    });
}
