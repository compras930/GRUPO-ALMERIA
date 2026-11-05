// A casa e o mês que a pessoa está olhando, e que não se perdem ao trocar de
// tela.
//
// O PROBLEMA QUE ISTO RESOLVE. Cada tela carregava a seleção pela URL
// (`?unidadeId=`, `?mes=`), e os links entre elas nem sempre levavam. Quem
// estava vendo outubro do Beira Lago no Painel clicava em Estoque e caía no
// 104 Sul do mês corrente — e, pior, podia não perceber: a tela nova mostra
// números plausíveis, só que de outra casa.
//
// A ORDEM DE PRECEDÊNCIA, e por que nessa ordem:
//
//   1. a URL, quando vem preenchida — link compartilhado tem que abrir o que
//      quem mandou estava vendo, e não o que quem abriu selecionou por último;
//   2. o cookie, que é a escolha feita no menu lateral;
//   3. o padrão: a primeira casa visível e o mês corrente.
//
// "TODAS AS CASAS" É UMA ESCOLHA, não a ausência de escolha. Por isso vira o
// valor explícito `todas` em vez de campo vazio: vazio não se distingue de
// "nunca escolhi", e aí o cookie não teria como guardar essa opção.
//
// SÓ ACEITA O QUE EXISTE. Casa que não está na lista de visíveis e mês fora
// da faixa disponível são descartados em silêncio e caem no padrão — um
// cookie velho, de um usuário que mudou de casa, não pode mostrar dado de
// unidade que ele não pode ver.
//
// Núcleo puro: sem Prisma, sem I/O, sem cookies.

export const TODAS = "todas";

export type CasaOpcao = { id: string; nome: string };

export type Selecao = {
  /** null = todas as casas. */
  casaId: string | null;
  mes: string;
  /** A casa veio da URL, não do cookie — a tela pode querer dizer isso. */
  daUrl: boolean;
};

export function resolverSelecaoPura(
  casasVisiveis: CasaOpcao[],
  mesesValidos: string[],
  pedido: {
    casaSp?: string | null;
    mesSp?: string | null;
    casaCookie?: string | null;
    mesCookie?: string | null;
  },
  mesPadrao: string
): Selecao {
  const existe = (id: string | null | undefined) =>
    !!id && casasVisiveis.some((c) => c.id === id);

  const escolherCasa = (v: string | null | undefined): string | null | undefined => {
    if (!v) return undefined; // não escolheu nada
    if (v === TODAS) return null; // escolheu explicitamente "todas"
    return existe(v) ? v : undefined;
  };

  const daUrl = escolherCasa(pedido.casaSp);
  const doCookie = escolherCasa(pedido.casaCookie);
  const casaId =
    daUrl !== undefined ? daUrl : doCookie !== undefined ? doCookie : (casasVisiveis[0]?.id ?? null);

  const mesValido = (m: string | null | undefined) => (m && mesesValidos.includes(m) ? m : undefined);
  const mes = mesValido(pedido.mesSp) ?? mesValido(pedido.mesCookie) ?? mesPadrao;

  return { casaId, mes, daUrl: daUrl !== undefined };
}

/** O valor a gravar no cookie: "todas" quando não há casa escolhida. */
export function valorDeCookiePura(casaId: string | null): string {
  return casaId ?? TODAS;
}
