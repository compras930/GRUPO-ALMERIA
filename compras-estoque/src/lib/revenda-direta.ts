// REVENDA DIRETA: o item que se vende exatamente como se compra.
//
// O BURACO QUE ISTO FECHA. A venda só baixa estoque através da ficha técnica:
// a carga explode a receita do item vendido e desconta os insumos. Item sem
// ficha não desconta nada — e para um prato isso faz sentido, porque sem a
// ficha ninguém sabe quanto de cada insumo ele leva.
//
// Para água, cerveja, refrigerante e vinho, não. Vende-se a mesma garrafa que
// se comprou. Não falta informação nenhuma: falta só dizer ao app que o item
// do cardápio e o produto da despensa são a mesma coisa. Enquanto isso não é
// dito, a conferência mostra "vendido 0" para a água mais vendida da casa, e a
// saída inteira dela aparece como falta — acusando sumiço onde houve venda.
//
// COMO SE DIZ: uma receita de UM ingrediente só. É feio e é certo — todo o
// resto do app (consumo, CMV teórico, conferência, lista de compras) já sabe
// trabalhar com receita, e inventar um segundo caminho "venda direta" criaria
// duas regras para a mesma pergunta, que é como se perde o controle de qual
// está valendo.
//
// A QUANTIDADE NEM SEMPRE É 1. A casa compra fardo e vende lata; compra
// garrafa de 700 ml e vende dose de 50. Por isso o vínculo carrega quanto do
// produto sai a cada unidade vendida, e o padrão de 1 só vale quando as duas
// unidades batem.
//
// Núcleo puro: sem Prisma, sem I/O.

// A COMPARAÇÃO POR NOME MORA EM casamento-por-nome.ts, e de propósito: esta
// tela e a do vínculo de ficha fazem a mesma pergunta — "qual destes é o
// mesmo?". Duas réguas para a mesma pergunta significam que uma casa o que a
// outra recusa, e ninguém sabe qual está valendo.
import { sugerirPorNomePuro, casamentosSegurosPuros } from "@/lib/casamento-por-nome";

export type ItemParaVincular = {
  itemVendaId: string;
  nome: string;
  tipo: string;
  /** Faturamento no período — ordena por quanto cada vínculo compra de exatidão. */
  faturamento: number;
  unidadeDeVenda?: string | null;
};

export type ProdutoCandidato = { produtoId: string; nome: string; unidadeMedida: string };

export type Sugestao = {
  itemVendaId: string;
  produtoId: string | null;
  /**
   * EXATA  — nome igual depois de normalizar: pode ser aplicada em lote.
   * PARCIAL— um nome contém o outro: precisa de olho humano.
   * NENHUMA— não há candidato; alguém escolhe na mão.
   */
  confianca: "EXATA" | "PARCIAL" | "NENHUMA";
  /** Quanto do produto sai a cada unidade vendida. */
  quantidade: number;
  /** Por que o app sugeriu isto — aparece na tela, para não parecer mágica. */
  motivo: string;
};

/**
 * Casa item de cardápio com produto de despensa POR NOME, e só para sugerir.
 *
 * Por nome é o que este projeto evita em toda parte — e aqui é aceitável por
 * uma razão específica: o resultado não é gravado em silêncio, ele vira uma
 * SUGESTÃO que uma pessoa confirma. O risco de casar errado por texto é
 * grande; o risco de sugerir errado é um clique.
 *
 * A quantidade sai sempre 1: só a pessoa sabe se a casa compra fardo e vende
 * lata. Chutar aqui seria o único lugar desta tela onde o erro não dá na
 * vista.
 */
export function sugerirVinculosPuros(
  itens: ItemParaVincular[],
  produtos: ProdutoCandidato[]
): Sugestao[] {
  const casamentos = sugerirPorNomePuro(
    itens.map((i) => ({ id: i.itemVendaId, nome: i.nome })),
    produtos.map((p) => ({ id: p.produtoId, nome: p.nome }))
  );
  return casamentos.map((c) => ({
    itemVendaId: c.alvoId,
    produtoId: c.candidatoId,
    confianca: c.confianca,
    quantidade: 1,
    // A tela desta funcionalidade diz "produto"; o núcleo compartilhado não
    // sabe de produto nenhum, então a palavra entra aqui.
    motivo:
      c.motivo === "nome idêntico"
        ? "nome idêntico ao do produto"
        : c.motivo.replace(/^(\d+) com esse mesmo nome$/, "$1 produtos com esse mesmo nome"),
  }));
}

/** Os que podem ser aplicados de uma vez, sem ninguém olhar linha a linha. */
export const sugestoesSegurasPuras = (s: Sugestao[]) =>
  s.filter((x) => x.confianca === "EXATA" && x.produtoId);

export { casamentosSegurosPuros };
