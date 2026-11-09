// Qual bloco de produtos a contagem da semana pega.
//
// A ROTAÇÃO VIGENTE, decidida pelo setor de compras em 09/11/2026, e agora
// IGUAL EM TODAS AS CASAS:
//
//   - CURVA A: toda semana, inteira. Nenhum rodízio.
//   - CURVA B: metade numa semana, a outra metade na seguinte, alternando.
//     Semanas 1 e 3 contam o grupo 1; semanas 2 e 4, o grupo 2.
//
// Assim cada item da curva A fecha período toda semana e cada item da B fecha
// de quinze em quinze dias — ou seja, a curva A e a B são medidas PELO MENOS
// DUAS VEZES POR MÊS, que é o que a decisão pediu.
//
// POR QUE MUDOU. Antes a curva A caía em dois grupos (quinzenal) e a B em
// quatro (mensal). Consumo só existe entre duas contagens DO MESMO item: com a
// A quinzenal, o CMV contado também era quinzenal, e um desvio de proteína
// aparecia até trinta dias depois, quando ninguém lembra mais o que houve. O
// Beira Lago já contava a curva A inteira toda semana (o antigo "grupo 0") e
// sustentou a rotina — foi o que decidiu a régua para as outras casas.
//
// A curva C (5% do valor, metade do catálogo) fica de fora do rodízio de
// propósito. Contar tudo toda semana nunca ia acontecer, e é por isso que
// inventário completo vira promessa que a operação não cumpre.

export const SEMANAS = [1, 2, 3, 4] as const;
export type Semana = (typeof SEMANAS)[number];

/**
 * GRUPO ZERO = TODA SEMANA.
 *
 * Convenção no valor que já existe em ParametroEstoqueProduto, em vez de uma
 * coluna nova (o deploy roda só `prisma generate`, então coluna nova é uma
 * janela em que a tela cai). Agora é onde a curva A inteira vive, em todas as
 * casas.
 */
export const GRUPO_TODA_SEMANA = 0;

/** Os dois blocos em que a curva B se divide. */
export const GRUPOS_DA_B = [1, 2] as const;

/** semana -> grupo da curva A, grupo da curva B */
const GRUPOS: Record<Semana, { a: number; b: number }> = {
  1: { a: GRUPO_TODA_SEMANA, b: 1 },
  2: { a: GRUPO_TODA_SEMANA, b: 2 },
  3: { a: GRUPO_TODA_SEMANA, b: 1 },
  4: { a: GRUPO_TODA_SEMANA, b: 2 },
};

export function gruposDaSemana(semana: Semana) {
  return GRUPOS[semana];
}

export type ProdutoClassificado = { classeAbc: string | null; grupoContagem: number | null };

/** O produto entra na contagem desta semana? */
export function entraNaSemanaPura(p: ProdutoClassificado, semana: Semana): boolean {
  const { b } = GRUPOS[semana];
  // Curva A: toda semana, qualquer que seja o grupo gravado. Aceitar qualquer
  // grupo é de propósito: enquanto a curva ABC não for reaplicada, ainda há
  // casa com A gravada em grupo 1 ou 2, e ela tem que entrar na folha de hoje
  // em vez de esperar a reaplicação.
  if (p.classeAbc === "A") return true;
  if (p.classeAbc === "B") {
    // Grupo 0 na B é herança do Beira Lago, que contava tudo toda semana.
    // Continua valendo até a reaplicação dividir a B em duas metades.
    if (p.grupoContagem === GRUPO_TODA_SEMANA) return true;
    // Grupo 3 ou 4 é herança do rodízio antigo de quatro grupos: mapeia para a
    // metade correspondente (3 -> 1, 4 -> 2) para que nenhum item da B suma da
    // folha na semana seguinte à mudança.
    const metade = p.grupoContagem === 3 ? 1 : p.grupoContagem === 4 ? 2 : p.grupoContagem;
    return metade === b;
  }
  // Sem classe, ou classe C: não entra no rodízio. Continua contável pela tela
  // de produto avulso — o rodízio é a rotina, não a única porta.
  return false;
}

/**
 * A semana do mês, de 1 a 4, pela data. Dia 1-7 é semana 1, 8-14 semana 2, e
 * assim por diante; o que sobra do dia 29 em diante cai na semana 4.
 *
 * Semana do MÊS e não semana do ano porque a rotação tem que fechar dentro do
 * mês: cada metade da curva B precisa cair duas vezes no mês, e semana do ano
 * faria a quinta semana de alguns meses repetir uma metade e pular a outra.
 */
export function semanaDoMes(d: Date): Semana {
  const n = Math.min(4, Math.ceil(d.getDate() / 7));
  return n as Semana;
}
