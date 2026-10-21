// A ordem em que as cargas tocam as linhas de estoque.
//
// Núcleo puro: sem Prisma, sem I/O.
//
// O PROBLEMA, com nome. Duas cargas rodando ao mesmo tempo (a venda de uma
// semana e a compra, ou duas semanas de venda disparadas juntas) atualizam as
// MESMAS linhas de EstoqueSaldo. Cada uma percorria um Map, cuja ordem é a de
// inserção — e a ordem de inserção depende de quais produtos apareceram
// primeiro na planilha. Então a carga A pegava o produto X e ia buscar o Y
// enquanto a B já tinha o Y e esperava o X. Nenhuma das duas solta, e o
// Postgres mata uma: "deadlock detected".
//
// Aconteceu de verdade em 21/10, com três semanas de venda do Beira Lago
// enviadas ao mesmo tempo: a de 20/10 passou, as de 01–05 e 06–12 morreram no
// upsert de EstoqueSaldo.
//
// A SOLUÇÃO NÃO É TENTAR DE NOVO — é tirar o ciclo. Se TODA transação pega as
// linhas sempre na mesma ordem, não existe espera circular, e deadlock dessa
// classe deixa de ser possível em vez de ficar raro. A tentativa de novo
// continua existindo como rede (ver transacao.ts), para o que não depende de
// nós: outra sessão, um lock de manutenção.
//
// Qualquer ordem total serve, desde que seja a MESMA em todo lugar. O id do
// produto é estável, único e já está à mão — por isso é ele.

/** Pares (produtoId, valor) em ordem estável de id, para o lock sempre seguir o mesmo caminho. */
export function emOrdemDeBloqueio<T>(porProduto: Map<string, T>): [string, T][] {
  return [...porProduto].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}
