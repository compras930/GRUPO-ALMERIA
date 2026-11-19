// VÍNCULO FICHA ↔ ITEM DO CARDÁPIO.
//
// O QUE ESTÁ PARADO SEM ISTO. As 201 fichas do Beira Lago estão no app, com
// ingrediente e rendimento. Mesmo assim elas não produzem número nenhum: a
// venda só baixa estoque através da ficha DO ITEM VENDIDO, e o item só sabe
// qual é a sua ficha se alguém disser. Hoje 1 dos 58 pratos casa por nome.
//
// Enquanto não se diz, acontece exatamente o que já acontecia com a água: a
// conferência mostra "vendido 0" para o prato mais vendido da casa, a saída
// inteira dele aparece como falta, e não existe CMV teórico para comparar com
// o real — que é a pergunta que originou este projeto.
//
// POR QUE NÃO É A MESMA TELA DA REVENDA DIRETA. Lá o app CRIA uma receita de
// um ingrediente, porque ela não existia. Aqui a ficha já existe, escrita pelo
// chef, e o trabalho é só apontar. A diferença aparece no desfazer: ali a
// casquinha criada pode ser apagada, aqui a ficha nunca é — desligar não é
// apagar o trabalho de quem escreveu.
//
// Núcleo puro: sem Prisma, sem I/O.

import { chaveSemAcento, sugerirPorNomePuro, type Casamento } from "@/lib/casamento-por-nome";

/**
 * Tira "SB" e "MONTAGEM" do começo do nome da ficha.
 *
 * A planilha do chef usa os dois como marcação de tipo, não como parte do
 * nome: "SB - BECHAMEL" é o bechamel, "MONTAGEM - TARTAR DE ATUM" é o tartar
 * que está no cardápio como "Tartar de Atum". Sem tirar o prefixo, nenhuma
 * montagem casa com o prato que ela monta — e montagem é justamente a ficha
 * do que se vende.
 */
export const semPrefixoDeTipo = (nome: string) =>
  chaveSemAcento(nome).replace(/^(sb|montagem|motagem)\b[\s-]*/, "").trim();

/** Palavras que ligam e não nomeiam: tirá-las deixa o conjunto comparável. */
const LIGACAO = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "ao", "com", "em", "al"]);

/**
 * Assinatura por conjunto de palavras, sem ligação e sem ordem.
 *
 * "RIGATONI AMATRICIANA MONTAGEM" no fim do nome em vez do começo, "MOLHO DE
 * TOMATE" contra "TOMATE MOLHO", "SALADA DE QUINOA COM FEIJÃO" contra "SALADA
 * DE QUINOA E FEIJÃO". É o que mais casa — e por isso mesmo só rende PARCIAL:
 * casa também o que é parecido demais para decidir no automático.
 */
export const conjuntoDePalavras = (nome: string) =>
  semPrefixoDeTipo(nome)
    .split(/\s+/)
    .filter((p) => p && !LIGACAO.has(p))
    .sort()
    .join(" ");

/**
 * Níveis de chave, do estrito ao generoso. Só o nível 0 vira EXATA, que é o
 * único que o botão de lote aplica sem ninguém olhar.
 */
export const chavesDeFicha = (nome: string) => [
  chaveSemAcento(nome),
  semPrefixoDeTipo(nome),
  conjuntoDePalavras(nome),
];

export type ItemDeCardapio = { id: string; nome: string };
export type FichaCandidata = { id: string; nome: string };

export function sugerirFichasPuras(
  itens: ItemDeCardapio[],
  fichas: FichaCandidata[]
): Casamento[] {
  return sugerirPorNomePuro(itens, fichas, chavesDeFicha);
}
