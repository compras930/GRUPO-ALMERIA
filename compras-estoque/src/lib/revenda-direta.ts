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

import { chaveComparacao } from "@/lib/nome-normalizado";

/**
 * Chave de comparação SEM ACENTO, só para esta tela.
 *
 * `chaveComparacao` baixa a caixa e não mexe no acento — e está certo assim no
 * resto do app, onde ela decide casamento que vira gravação. Aqui os dois
 * lados vêm de cadastros digitados por gente diferente: o cardápio escreve
 * "Água Prata Retornável", a nota do Teknisa escreve "AGUA PRATA RETORNAVEL".
 * Como o resultado é sugestão, e não gravação, tirar o acento compra muitos
 * casamentos certos e custa, no pior caso, um clique.
 */
const chaveSemAcento = (nome: string) =>
  chaveComparacao(nome)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

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
 */
export function sugerirVinculosPuros(
  itens: ItemParaVincular[],
  produtos: ProdutoCandidato[]
): Sugestao[] {
  const porChave = new Map<string, ProdutoCandidato[]>();
  for (const p of produtos) {
    const k = chaveSemAcento(p.nome);
    if (!porChave.has(k)) porChave.set(k, []);
    porChave.get(k)!.push(p);
  }

  return itens.map((item) => {
    const chave = chaveSemAcento(item.nome);
    const exatos = porChave.get(chave) ?? [];
    if (exatos.length === 1) {
      return {
        itemVendaId: item.itemVendaId,
        produtoId: exatos[0].produtoId,
        confianca: "EXATA",
        quantidade: 1,
        motivo: "nome idêntico ao do produto",
      };
    }
    // Mais de um produto com o mesmo nome: não dá para escolher sozinho — e
    // escolher o primeiro seria decidir no escuro por quem vai conferir.
    if (exatos.length > 1) {
      return {
        itemVendaId: item.itemVendaId,
        produtoId: null,
        confianca: "NENHUMA",
        quantidade: 1,
        motivo: `${exatos.length} produtos com esse mesmo nome`,
      };
    }

    const parciais = produtos.filter((p) => {
      const k = chaveSemAcento(p.nome);
      return k.length > 6 && chave.length > 6 && (k.startsWith(chave) || chave.startsWith(k));
    });
    if (parciais.length === 1) {
      return {
        itemVendaId: item.itemVendaId,
        produtoId: parciais[0].produtoId,
        confianca: "PARCIAL",
        quantidade: 1,
        motivo: "nome parecido — confira antes",
      };
    }
    return {
      itemVendaId: item.itemVendaId,
      produtoId: null,
      confianca: "NENHUMA",
      quantidade: 1,
      motivo: parciais.length > 1 ? `${parciais.length} nomes parecidos` : "nenhum produto parecido",
    };
  });
}

/** Os que podem ser aplicados de uma vez, sem ninguém olhar linha a linha. */
export const sugestoesSegurasPuras = (s: Sugestao[]) =>
  s.filter((x) => x.confianca === "EXATA" && x.produtoId);
