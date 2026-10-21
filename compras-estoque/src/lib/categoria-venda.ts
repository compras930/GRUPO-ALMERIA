// O nome canônico de uma categoria de item de venda.
//
// O PROBLEMA, com números: o painel de Vendas por categoria mostrava TINTO e
// Tintos, BRANCO e Brancos, ESPUMANTE e Espumante, ROSÉ e Rosé, ENTRADAS e
// Entradas — dez barras para cinco categorias. Mais de R$ 160 mil de vinho
// picados em nove barras, e nenhuma delas dizia quanto a casa vende de vinho.
//
// A CAUSA é limpa, e o diagnóstico confirmou sem margem: as 72 linhas em
// MAIÚSCULA têm TODAS `codigoPdv`, e nenhuma das Capitalizadas tem. As duas
// convenções são as duas origens — a maiúscula é o campo `grupo` do export do
// XMenu, a capitalizada é o cadastro antigo da casa.
//
// POR QUE UM MAPA E NÃO "DEIXA TUDO CAPITALIZADO". Porque o legado não segue
// regra: é "Tintos" no plural e "Espumante" no singular. Normalizar só a caixa
// transformaria TINTO em "Tinto", que continua sendo uma barra separada de
// "Tintos" — o bug sobreviveria com outra roupa.
//
// POR QUE O MAPA É CURTO, E FICA CURTO. Só os pares que de fato existem nas
// duas convenções. Categoria que só aparece em maiúscula (SERVICOS, TAXAS,
// MENU, PRINCIPAIS, NÃO ALCOÓLICAS) é deixada EXATAMENTE como veio: capitalizar
// por conta própria inventaria um nome novo que não casa com nada que já está
// gravado, criando a segunda convenção em vez de eliminá-la.
//
// Núcleo puro: sem Prisma, sem I/O.

/**
 * Chave de comparação: sem caixa, sem acento e sem o "s" do plural.
 *
 * O plural entra aqui porque sem ele "TINTO" e "Tintos" não se reconhecem — e
 * foi justamente esse par o que mais pesou no painel.
 */
export function chaveCategoria(nome: string): string {
  const semAcento = nome
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return semAcento.replace(/s$/, "");
}

/**
 * Os nomes que o app considera corretos, por chave de comparação.
 *
 * Fica a grafia do CADASTRO ANTIGO, não a do export: é a que já está nas telas,
 * a que o salão lê, e a mais legível num gráfico de barras.
 */
const CANONICAS: Record<string, string> = {
  tinto: "Tintos",
  branco: "Brancos",
  espumante: "Espumante",
  rose: "Rosé",
  entrada: "Entradas",
};

/**
 * Devolve o nome canônico, ou o próprio nome quando não há par conhecido.
 *
 * Nome vazio vira `null` em vez de string vazia: o painel já trata ausência de
 * categoria como "Sem categoria", e string vazia seria uma sexta forma de
 * dizer a mesma coisa.
 */
export function categoriaCanonicaPura(nome: string | null | undefined): string | null {
  const limpo = (nome ?? "").trim();
  if (limpo === "") return null;
  return CANONICAS[chaveCategoria(limpo)] ?? limpo;
}

/**
 * Venda de EVENTO — pacote fechado, sem ficha técnica por construção.
 *
 * No Beira Lago são quatro itens (`EVT-MENU`, `EVT-BEBIDAS`, `EVT-SERVICOS`,
 * `EVT-VINHOS`) que somaram 45,2% do faturamento de outubro. O evento é
 * faturado como pacote e o PDV não detalha prato a prato, então esse
 * faturamento NUNCA vai ter ficha — não é cadastro atrasado, é o dado que não
 * existe.
 *
 * Importa saber disso ao ler o CMV teórico: ele mede só o que tem ficha, e sem
 * este número ninguém tem como saber que ele está falando de pouco mais da
 * metade da casa.
 *
 * Reconhece pela categoria, e não pelo código do PDV, porque o prefixo `EVT-`
 * é invenção da carga do XMenu: outra casa, com outro PDV, usa outro código. A
 * categoria é do app.
 */
export function ehCategoriaDeEventoPura(categoria: string | null | undefined): boolean {
  return (categoria ?? "").trim().toLowerCase().startsWith("eventos");
}
