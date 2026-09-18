// Qual bloco de produtos a contagem da semana pega.
//
// A ROTAÇÃO, decidida pelo setor de compras em 18/09/2026: curva A em dois
// grupos, curva B em quatro. A semana conta um grupo de cada — na prática, ~45
// itens. Cada item da curva A cai de quinze em quinze dias; cada um da B, uma
// vez por mês.
//
// Frequência seguindo valor é a razão de a curva existir. A curva A do 104 Sul
// são 55 itens que valem 80% do dinheiro, e doze deles são proteína — que é
// onde some. Contar de duas em duas semanas dá 26 medições por ano em vez de
// 12: a diferença entre achar um desvio enquanto ele acontece e achar trinta
// dias depois, quando ninguém lembra o que houve.
//
// A curva C (5% do valor, metade do catálogo) fica de fora do rodízio de
// propósito. Contar tudo toda semana nunca ia acontecer, e é por isso que
// inventário completo vira promessa que a operação não cumpre.

export const SEMANAS = [1, 2, 3, 4] as const;
export type Semana = (typeof SEMANAS)[number];

/** semana -> grupo da curva A, grupo da curva B */
const GRUPOS: Record<Semana, { a: number; b: number }> = {
  1: { a: 1, b: 1 },
  2: { a: 2, b: 2 },
  3: { a: 1, b: 3 },
  4: { a: 2, b: 4 },
};

export function gruposDaSemana(semana: Semana) {
  return GRUPOS[semana];
}

export type ProdutoClassificado = { classeAbc: string | null; grupoContagem: number | null };

/** O produto entra na contagem desta semana? */
export function entraNaSemanaPura(p: ProdutoClassificado, semana: Semana): boolean {
  const { a, b } = GRUPOS[semana];
  if (p.classeAbc === "A") return p.grupoContagem === a;
  if (p.classeAbc === "B") return p.grupoContagem === b;
  // Sem classe, ou classe C: não entra no rodízio. Continua contável pela tela
  // de produto avulso — o rodízio é a rotina, não a única porta.
  return false;
}

/**
 * A semana do mês, de 1 a 4, pela data. Dia 1-7 é semana 1, 8-14 semana 2, e
 * assim por diante; o que sobra do dia 29 em diante cai na semana 4.
 *
 * Semana do MÊS e não semana do ano porque a rotação tem que fechar dentro do
 * mês: cada item da curva B precisa ser contado uma vez por mês, e semana do
 * ano faria a quinta semana de alguns meses repetir o grupo 1 e pular o 4.
 */
export function semanaDoMes(d: Date): Semana {
  const n = Math.min(4, Math.ceil(d.getDate() / 7));
  return n as Semana;
}
