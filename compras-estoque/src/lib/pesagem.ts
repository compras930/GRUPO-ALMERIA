// Contar garrafa pesando, em vez de adivinhando o dedo.
//
// O PROBLEMA. Whisky, gin, licor e aperitivo são vendidos em DOSE, então a
// garrafa fica meses aberta e quase nunca está cheia nem vazia. Contar "mais
// ou menos meia" é o que se faz hoje, e meio dedo de erro numa garrafa de
// R$ 290 é mais dinheiro que o mês inteiro de hortifrúti. A balança resolve —
// ela já existe na cozinha — mas entrega GRAMA, e o estoque está em garrafa.
//
// A CONTA:
//
//     garrafas = (peso medido − tara) ÷ líquido quando cheia
//
// `tara` é a garrafa vazia com tampa e rótulo, porque é assim que ela vai para
// a balança: ninguém despeja whisky num copo para pesar. `líquido quando
// cheia` NÃO é o volume nominal — 700 ml de whisky pesam ~660 g, porque álcool
// é mais leve que água, e a diferença de 6% num estoque de bar é dinheiro.
//
// POR QUE GUARDAR DOIS NÚMEROS E NÃO O TEXTO PRONTO. O pedido foi "uma
// mensagem no item", e um campo de texto resolveria hoje. Mas com os dois
// números a tela pode, amanhã, receber o peso e converter sozinha — e aí
// ninguém faz divisão de cabeça às duas da manhã com quarenta garrafas na
// frente. Texto teria que ser redigitado para chegar lá; número não.
//
// Núcleo puro: sem Prisma, sem I/O.

export type Pesagem = {
  /** Garrafa vazia, com tampa e rótulo, em gramas. */
  taraG: number | null;
  /** Líquido quando cheia, em gramas — não o volume nominal. */
  liquidoCheioG: number | null;
};

/** Tem o suficiente para pesar? Só o líquido cheio é obrigatório. */
export function podePesarPura(p: Pesagem | null | undefined): boolean {
  return !!p && typeof p.liquidoCheioG === "number" && p.liquidoCheioG > 0;
}

/**
 * Quantas unidades uma leitura da balança representa.
 *
 * Devolve `null` quando não dá para responder, em vez de zero: zero numa
 * contagem significa "conferi e não tem nenhum", que é outra afirmação.
 *
 * NUNCA DEVOLVE NEGATIVO. Peso abaixo da tara é garrafa que pesou menos que o
 * próprio vidro — balança mal zerada, tara errada ou o frasco errado na mão.
 * Negativo entraria na contagem como estoque negativo e viraria um "sumiço" na
 * Conferência, escondendo o erro de medição atrás de um erro de estoque.
 */
export function quantidadePorPesoPura(pesoMedidoG: number, p: Pesagem): number | null {
  if (!podePesarPura(p)) return null;
  if (!Number.isFinite(pesoMedidoG) || pesoMedidoG < 0) return null;
  const liquido = pesoMedidoG - (p.taraG ?? 0);
  if (liquido < 0) return null;
  return liquido / p.liquidoCheioG!;
}

const g = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} g`;

/**
 * O aviso que vai na folha de contagem, ao lado do item.
 *
 * Curto de propósito: ele é lido em pé, na frente da prateleira, numa folha
 * impressa em preto e branco. A fórmula vem junto porque quem conta não tem
 * como consultar esta explicação ali.
 */
export function avisoDePesagemPura(p: Pesagem | null | undefined, unidade: string): string | null {
  if (!podePesarPura(p)) return null;
  const cheia = g(p!.liquidoCheioG!);
  if (p!.taraG && p!.taraG > 0) {
    return `pese: (peso − ${g(p!.taraG)} da garrafa vazia) ÷ ${cheia} = ${unidade.toLowerCase()}`;
  }
  return `pese: peso do líquido ÷ ${cheia} = ${unidade.toLowerCase()}`;
}
