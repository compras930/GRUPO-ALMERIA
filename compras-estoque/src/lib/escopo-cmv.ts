// Enxuto × cheio: duas leituras da mesma compra.
//
// Núcleo puro: sem Prisma, sem I/O.
//
// O VOCABULÁRIO É O DO PAINEL DE COMPRAS, de propósito. Lá a tabela traz "CMV"
// e "CMV cheio" lado a lado, e a diretoria já lê os dois assim. Inventar nomes
// diferentes aqui obrigaria todo mundo a traduzir na cabeça, toda vez.
//
//   ENXUTO  o que vira prato vendido: matéria-prima, bebidas e vinhos.
//   CHEIO   tudo o que foi comprado — inclusive descartáveis, higiene,
//           alimentação de funcionário e eventos.
//
// POR QUE OS DOIS, E NÃO UM. O enxuto é o número que se compara com a meta: a
// casa não controla CMV comprando menos detergente. Mas o cheio é o que saiu
// do caixa, e esconder a diferença faria o painel contar só metade da história
// — no Beira Lago, os grupos de fora somam R$ 86 mil em dois meses e meio.
//
// A COMPARAÇÃO IGNORA ACENTO E CAIXA porque a categoria é texto livre: ela vem
// do grupo do XMenu em uns produtos, de cadastro antigo em outros, e um
// "Matéria Prima" digitado à mão não pode cair fora do CMV por causa do acento.

const CATEGORIAS_ENXUTO = ["MATERIA PRIMA", "BEBIDAS", "VINHOS"];

const chave = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

const ENXUTO = new Set(CATEGORIAS_ENXUTO.map(chave));

/**
 * Categoria vazia NÃO é enxuto. É produto sem cadastro, e cadastro faltando
 * não pode entrar calado no número que vai pra diretoria — ele aparece na
 * diferença entre cheio e enxuto, que é onde dá pra ver e cobrar.
 */
export function ehEnxuto(categoria: string | null | undefined): boolean {
  if (!categoria) return false;
  return ENXUTO.has(chave(categoria));
}

export const CATEGORIAS_DO_ENXUTO = CATEGORIAS_ENXUTO;
