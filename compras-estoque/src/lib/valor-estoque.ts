// Quanto vale o que está na prateleira.
//
// É a pergunta que todo dono faz primeiro, e a que o app não respondia: ele
// tinha o saldo de cada produto e o preço de cada produto, e nunca multiplicou
// os dois numa tela.
//
// O NÚMERO SOZINHO MENTE, e é por isso que esta função devolve mais que um
// número. Três coisas podem estragá-lo, e todas aparecem no dia a dia desta
// casa:
//
//   1. PRODUTO SEM PREÇO entra como zero e some da conta. Um estoque com
//      trinta itens sem preço vale mais do que diz, e nada na tela avisaria.
//      Aqui eles saem numa lista à parte, e o total diz sobre quantos itens
//      foi calculado.
//
//   2. SALDO NEGATIVO somaria valor negativo e abateria o total. Negativo não
//      é prateleira: é erro de conta (venda com ficha consumindo insumo cuja
//      compra não foi carregada, ou conversão de unidade errada). Fica fora do
//      total e aparece na lista de problemas, que é onde ele pode ser
//      consertado.
//
//   3. NOTA LANÇADA DEPOIS DA CONTAGEM soma em cima do que já foi contado.
//      Isso não dá para ver daqui — quem chama é que sabe a data da última
//      contagem —, mas é o terceiro erro e a tela precisa dizê-lo.
//
// Núcleo puro: sem Prisma, sem I/O.

export type SaldoParaValorizar = {
  produtoId: string;
  nome: string;
  unidadeMedida: string;
  categoria: string | null;
  quantidade: number;
  /** Preço atual na casa. Nulo = produto que nunca teve nota. */
  preco: number | null;
};

export type ItemDeEstoque = {
  produtoId: string;
  nome: string;
  unidadeMedida: string;
  quantidade: number;
};

export type ValorEstoque = {
  /** O que a prateleira vale, somando só o que dá para somar. */
  total: number;
  /** Quantos produtos entraram no total. */
  itensValorizados: number;
  /** Tem saldo, não tem preço: o total está subestimado por causa deles. */
  semPreco: ItemDeEstoque[];
  /** Saldo abaixo de zero: erro de conta, fora do total. */
  negativos: ItemDeEstoque[];
  /** Onde o dinheiro está parado, do maior para o menor. */
  porCategoria: { categoria: string | null; valor: number; itens: number }[];
  /** Os mais caros, do maior para o menor — para a tela mostrar os primeiros. */
  maisCaros: (ItemDeEstoque & { valor: number })[];
};

const SEM_CATEGORIA = null;

export function valorizarEstoquePura(saldos: SaldoParaValorizar[]): ValorEstoque {
  let total = 0;
  let itensValorizados = 0;
  const semPreco: ItemDeEstoque[] = [];
  const negativos: ItemDeEstoque[] = [];
  const porCategoria = new Map<string | null, { valor: number; itens: number }>();
  const comValor: (ItemDeEstoque & { valor: number })[] = [];

  for (const s of saldos) {
    const item: ItemDeEstoque = {
      produtoId: s.produtoId,
      nome: s.nome,
      unidadeMedida: s.unidadeMedida,
      quantidade: s.quantidade,
    };
    // A tolerância existe porque saldo é float: -0.0000001 é zero, não dívida.
    if (s.quantidade < -0.001) {
      negativos.push(item);
      continue;
    }
    if (s.quantidade <= 0.001) continue; // zero não vale nada e não é problema
    if (s.preco == null || !(s.preco > 0)) {
      semPreco.push(item);
      continue;
    }

    const valor = s.quantidade * s.preco;
    total += valor;
    itensValorizados++;
    comValor.push({ ...item, valor });

    const chave = s.categoria?.trim() || SEM_CATEGORIA;
    const atual = porCategoria.get(chave) ?? { valor: 0, itens: 0 };
    porCategoria.set(chave, { valor: atual.valor + valor, itens: atual.itens + 1 });
  }

  return {
    total,
    itensValorizados,
    // Ordem por valor parado, não alfabética: a pergunta é onde está o
    // dinheiro, e alfabética responde outra coisa.
    semPreco: semPreco.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    negativos: negativos.sort((a, b) => a.quantidade - b.quantidade),
    porCategoria: [...porCategoria]
      .map(([categoria, v]) => ({ categoria, ...v }))
      .sort((a, b) => b.valor - a.valor),
    maisCaros: comValor.sort((a, b) => b.valor - a.valor),
  };
}
