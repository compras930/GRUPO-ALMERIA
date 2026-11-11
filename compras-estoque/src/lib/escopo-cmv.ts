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

// DOIS VOCABULÁRIOS NA MESMA LISTA, e é por isso que ela parece redundante.
//
// O Beira Lago compra pelo XMenu, que agrupa em "MATERIA PRIMA" e "BEBIDAS".
// As outras casas compram pelo Teknisa, que detalha: MERCEARIA, PROTEINAS,
// HORTIFRUTIGRANJEIRO, BEBIDAS ALCOOLICAS, BEBIDAS NAO ALCOOLICAS. São nomes
// diferentes para a mesma coisa — comida e bebida que vira prato vendido.
//
// Até 05/11/2026 só os do XMenu estavam aqui, e o Wine Garden apareceu no
// painel com CMV enxuto de 1,0%: de R$ 251 mil comprados, a régua reconheceu
// R$ 6,5 mil. Não era carga errada — era a régua não conhecendo a casa. O
// sintoma é traiçoeiro justamente por não parecer defeito: 1% é um número,
// aparece na tela, e só não quer dizer nada.
//
// O QUE FICA DE FORA, de propósito: LIMPEZA, DESCARTAVEIS, EMBALAGENS,
// UTILIDADE PUBLICA (gás, energia), GRAOS FUNCIONARIO (refeição de
// funcionário) e ATIVO IMOBILIZADO. São compra de verdade e entram no cheio;
// o que não fazem é virar prato vendido.
const CATEGORIAS_ENXUTO = [
  // XMenu — Beira Lago
  "MATERIA PRIMA",
  "BEBIDAS",
  // Teknisa — 104 Sul, Noroeste, Wine Garden, CPD
  "MERCEARIA",
  "PROTEINAS",
  "HORTIFRUTIGRANJEIRO",
  "BEBIDAS ALCOOLICAS",
  "BEBIDAS NAO ALCOOLICAS",
  // comum aos dois
  "VINHOS",
  // O VOCABULÁRIO DO PAINEL, que passou a ser o do cadastro em 11/11/2026.
  //
  // Até então as três casas do Teknisa tinham a maior parte do dinheiro em
  // produto SEM categoria — R$ 1,1 milhão somando as três, em três meses — e
  // o enxuto delas enxergava perto de um quinto da compra real. A classificação
  // veio da Árvore de Produtos do painel (ver
  // prisma/scripts/codigo-teknisa/), que já é a régua usada lá.
  //
  // Os nomes antigos ficam: o Beira Lago continua chegando pelo XMenu com
  // "MATERIA PRIMA", e produto classificado à mão antes disso também.
  "INSUMO DE COZINHA",
  "BEBIDA",
  // Fora, de propósito, pela mesma régua do painel: "Revenda emporio"
  // (mercadoria revendida como veio, que tem margem própria), "Embalagem e
  // descartavel", "Higiene e limpeza", "Refeicao de funcionario" e
  // "Fora do CMV".
];

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
