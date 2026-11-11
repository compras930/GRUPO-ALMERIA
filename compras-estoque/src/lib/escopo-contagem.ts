// O que a CONTAGEM pode contar — que não é a mesma pergunta do CMV.
//
// A curva ABC da folha é feita em cima da compra, e a compra traz tudo o que a
// casa pagou: travessa, toalha, gás, taxa de maquininha. Nada disso fica numa
// prateleira esperando ser contado. Em 11/11/2026 o Wine Garden apareceu com
// "ATIVO IMOBILIZADO — LINHA RUSTICO PILOTTO, TRAVESSA OVAL" na curva A, ou
// seja, na folha semanal da cozinha.
//
// Linha de folha que não dá para contar é pior que linha a menos: quem conta
// aprende que a folha tem lixo, e passa a pular linha por conta própria — aí a
// que importava também some.
//
// A REGRA É POR EXCLUSÃO, NÃO POR INCLUSÃO, e a escolha é deliberada.
//
// Listar o que ENTRA parece mais seguro e é o contrário: todo produto com
// categoria nova, ou sem categoria nenhuma, cairia fora da folha em silêncio —
// e deixar de medir sem perceber é o erro que esta tela existe para evitar.
// Listando o que SAI, o desconhecido continua sendo contado, e aparece.
//
// É por isso que esta régua é o oposto da do CMV (src/lib/escopo-cmv.ts), onde
// categoria vazia NÃO entra no enxuto: lá, incluir o que não se conhece
// embelezaria o número que vai para a diretoria; aqui, excluir o que não se
// conhece pararia a medição.
//
// Núcleo puro: sem Prisma, sem I/O.

/**
 * Categorias que NÃO são estoque de despensa.
 *
 * Os dois vocabulários juntos (XMenu e Teknisa), pela mesma razão explicada em
 * escopo-cmv.ts: a mesma coisa tem nome diferente em cada sistema, e a régua
 * tem que conhecer os dois ou ela só funciona em uma casa.
 */
const CATEGORIAS_FORA_DA_CONTAGEM = [
  // Bem que fica na casa — móvel, louça, enxoval, equipamento. Comprado uma
  // vez, não consumido.
  "ATIVO IMOBILIZADO",
  "ATIVO IMOBILIZADO CONSUMO",
  "IMOBILIZADO",
  "MOVEIS E UTENSILIOS",
  "ENXOVAL",
  "EQUIPAMENTOS",
  // Não é mercadoria: é conta a pagar.
  "TAXAS",
  "TAXA",
  "SERVICOS",
  "SERVICO",
  "MANUTENCAO",
  "UTILIDADE PUBLICA", // gás, energia, água
  "ALUGUEL",
  "MARKETING",
  "MATERIAL DE ESCRITORIO",
  "UNIFORME",
  // O guarda-chuva do painel para o que não é mercadoria de prateleira. Em
  // 11/11/2026 eram oito produtos nas três casas do Teknisa: lenha, GLP,
  // cilindro de CO2, travessas e um copo. Gás não se conta na despensa.
  "FORA DO CMV",
];

const chave = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

const FORA = new Set(CATEGORIAS_FORA_DA_CONTAGEM.map(chave));

/**
 * Entra na folha de contagem?
 *
 * SEM CATEGORIA ENTRA. É cadastro incompleto, não é motivo para parar de
 * medir: o produto aparece na folha, alguém estranha, e o cadastro se resolve.
 * Sumir calado não resolve nada.
 */
export function ehContavel(categoria: string | null | undefined): boolean {
  if (!categoria) return true;
  return !FORA.has(chave(categoria));
}

export const CATEGORIAS_FORA_DA_FOLHA = CATEGORIAS_FORA_DA_CONTAGEM;
