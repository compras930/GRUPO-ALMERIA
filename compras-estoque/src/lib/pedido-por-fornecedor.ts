// O pedido da casa, quebrado por fornecedor.
//
// É a conta que hoje é feita à mão: a casa manda a lista inteira, e quem
// compra separa quem vende o quê. A folha de conferência sai assim e a
// mensagem do fornecedor também — a mercadoria chega numa entrega por vez, de
// um fornecedor por vez, e papel organizado por categoria obriga o estoquista
// a caçar os itens da nota espalhados por seis blocos.
//
// SEM FORNECEDOR VEM POR ÚLTIMO, com nome próprio. Ele não é um fornecedor
// entre outros: é a parte do pedido que ainda não dá para mandar para ninguém,
// e misturá-lo na ordem alfabética o esconderia bem no meio da folha.
//
// Núcleo puro: sem Prisma, sem I/O.

export const SEM_FORNECEDOR = "A definir";

export type LinhaDoPedido = {
  fornecedor: string | null;
  nome: string;
  unidade: string;
  quantidade: number;
  precoUnitEsperado: number;
};

export type ItemAgrupado = LinhaDoPedido & { total: number };

export type GrupoDeFornecedor = {
  fornecedor: string;
  itens: ItemAgrupado[];
  /** Soma do esperado; zero quando nenhum item tem preço. */
  total: number;
};

export function agruparPorFornecedorPura(linhas: LinhaDoPedido[]): GrupoDeFornecedor[] {
  const porFornecedor = new Map<string, ItemAgrupado[]>();
  for (const l of linhas) {
    const chave = l.fornecedor?.trim() || SEM_FORNECEDOR;
    if (!porFornecedor.has(chave)) porFornecedor.set(chave, []);
    porFornecedor.get(chave)!.push({ ...l, total: l.quantidade * l.precoUnitEsperado });
  }

  return [...porFornecedor]
    .map(([fornecedor, itens]) => ({
      fornecedor,
      // Alfabético dentro do fornecedor: é a ordem em que a nota dele costuma
      // vir, e a ordem em que se procura um item numa lista de trinta.
      itens: [...itens].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      total: itens.reduce((s, i) => s + i.total, 0),
    }))
    .sort((a, b) => {
      if (a.fornecedor === SEM_FORNECEDOR) return 1;
      if (b.fornecedor === SEM_FORNECEDOR) return -1;
      return a.fornecedor.localeCompare(b.fornecedor, "pt-BR");
    });
}

/**
 * A mensagem pronta para mandar ao fornecedor, no formato que a compra já usa
 * no WhatsApp.
 *
 * O FORMATO É O DE HOJE, de propósito — "• 5 KG – CALABRESA FATIADA". Os
 * fornecedores já leem assim há meses; inventar um layout novo trocaria uma
 * coisa que funciona por outra que precisa ser explicada a trinta pessoas.
 *
 * Uma mensagem por fornecedor, com as casas dentro: é assim que o pedido sai
 * hoje, e o fornecedor fatura por casa — por isso o CNPJ de cada uma aparece.
 */
export function mensagemDoFornecedorPura(entrada: {
  fornecedor: string;
  saudacao: string;
  casas: { nome: string; cnpj: string | null; itens: { quantidade: number; unidade: string; nome: string }[] }[];
}): string {
  const partes: string[] = [];
  partes.push(`==================== ${entrada.fornecedor.toUpperCase()} ====================`);
  partes.push("");
  partes.push(`${entrada.saudacao}!`);

  entrada.casas.forEach((casa, i) => {
    partes.push("");
    if (i > 0) {
      partes.push("------------------------------");
      partes.push("");
    }
    partes.push(`*Segue pedido para ${casa.nome}*`);
    if (casa.cnpj) partes.push(`CNPJ ${casa.cnpj}`);
    partes.push("");
    for (const item of casa.itens) {
      partes.push(`• ${formatarQuantidade(item.quantidade)} ${item.unidade.toUpperCase()} – ${item.nome}`);
    }
  });

  partes.push("");
  partes.push("Obrigado!");
  return partes.join("\n");
}

/** 2 em vez de 2,0 — mas 0,5 continua 0,5. */
function formatarQuantidade(q: number): string {
  return Number.isInteger(q) ? String(q) : String(q).replace(".", ",");
}
