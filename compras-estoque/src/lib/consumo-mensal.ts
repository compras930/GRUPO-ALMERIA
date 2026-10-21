// O consumo contado de um MÊS, e não das duas últimas contagens.
//
// POR QUE ISTO EXISTE. `calcularConsumoPuro` responde "quanto saiu entre as
// duas últimas contagens de cada produto" — que é a pergunta certa para a tela
// de Consumo e a errada para fechar um mês. Em 10 de novembro, as duas últimas
// contagens são as de 02 e 09/11, e o CMV contado que sai delas é de uma
// semana de novembro, por mais que o seletor diga "outubro".
//
// A REGRA DA CASA, que este arquivo implementa: a contagem do primeiro dia do
// mês FECHA o mês que acabou e ABRE o seguinte. Quando o mês termina no meio
// da semana, a semana é partida em vez de o mês ser esticado:
//
//   outubro/2026 termina num sábado  -> última semana de outubro: seg 26 a sáb 31
//                                       contagem de domingo 01/11 fecha o mês
//   novembro começa num domingo      -> primeira semana: dom 01 a dom 08
//
// É o inverso do que a conveniência pediria (contar sempre na segunda e deixar
// o mês cair onde cai), e é assim de propósito: o CMV é comparado mês a mês,
// com faturamento do mês e compra do mês. Um consumo medido de 26/10 a 02/11
// contra o faturamento de outubro mistura dois meses no numerador e um só no
// denominador — e o erro aparece como variação de CMV que ninguém consegue
// explicar pela cozinha.
//
// A TOLERÂNCIA existe porque a contagem é feita por gente: a que "fecha
// outubro" pode cair em 31/10 à noite, 01/11 de manhã ou 02/11 se o domingo
// virou feriado. Uma janela de dois dias em volta da virada pega as três sem
// alcançar a contagem semanal seguinte.
//
// Núcleo puro: sem Prisma, sem I/O.
import type { ContagemResumo, EntradaResumo } from "@/lib/consumo";

const DIA_MS = 24 * 60 * 60 * 1000;
export const TOLERANCIA_DIAS = 2;

export type Mes = { inicio: Date; fim: Date };

export type ConsumoMensalProduto = {
  produtoId: string;
  de: Date;
  ate: Date;
  saldoInicial: number;
  entradas: number;
  saldoFinal: number;
  consumo: number;
  alerta: "CONSUMO_NEGATIVO" | null;
};

/**
 * A contagem mais próxima de um instante, dentro da tolerância.
 *
 * Mais próxima, e não "a primeira depois": a que fecha o mês tanto pode ter
 * sido feita em 31/10 à noite quanto em 01/11 de manhã, e as duas significam a
 * mesma coisa para quem conta. Empate resolve pela mais ANTIGA, para que o
 * mesmo inventário feche um mês e abra o outro sem buraco entre eles.
 */
export function contagemAncora(
  lista: ContagemResumo[],
  alvo: Date,
  toleranciaDias = TOLERANCIA_DIAS
): ContagemResumo | null {
  const limite = toleranciaDias * DIA_MS;
  let melhor: ContagemResumo | null = null;
  let melhorDist = Infinity;
  for (const c of lista) {
    const dist = Math.abs(c.em.getTime() - alvo.getTime());
    if (dist > limite) continue;
    if (dist < melhorDist || (dist === melhorDist && melhor && c.em < melhor.em)) {
      melhor = c;
      melhorDist = dist;
    }
  }
  return melhor;
}

/**
 * Consumo contado de cada produto DENTRO do mês.
 *
 * Produto sem contagem de abertura ou sem contagem de fechamento fica de fora
 * — não entra com meia janela. Medir de uma contagem de 20/10 até a virada
 * diria "outubro" para onze dias, e onze dias de consumo contra o faturamento
 * do mês inteiro dariam um CMV de 8% que alguém usaria numa decisão.
 */
export function calcularConsumoDoMesPuro(
  contagens: ContagemResumo[],
  entradas: EntradaResumo[],
  mes: Mes,
  toleranciaDias = TOLERANCIA_DIAS
): ConsumoMensalProduto[] {
  const porProduto = new Map<string, ContagemResumo[]>();
  for (const c of contagens) {
    porProduto.set(c.produtoId, [...(porProduto.get(c.produtoId) ?? []), c]);
  }

  const entradasPorProduto = new Map<string, EntradaResumo[]>();
  for (const e of entradas) {
    entradasPorProduto.set(e.produtoId, [...(entradasPorProduto.get(e.produtoId) ?? []), e]);
  }

  const saida: ConsumoMensalProduto[] = [];
  for (const [produtoId, lista] of porProduto) {
    const abertura = contagemAncora(lista, mes.inicio, toleranciaDias);
    const fechamento = contagemAncora(lista, mes.fim, toleranciaDias);
    if (!abertura || !fechamento) continue;
    // A mesma contagem servindo de abertura e fechamento significa que só uma
    // das duas pontas existe de verdade — o mês não tem período fechado.
    if (abertura.em.getTime() >= fechamento.em.getTime()) continue;

    // Mesma régua do consumo entre contagens: entrada no instante da contagem
    // de abertura já estava na prateleira quando ela foi feita; no instante da
    // de fechamento, ainda não tinha sido contada.
    const entradasNoMes = (entradasPorProduto.get(produtoId) ?? [])
      .filter((e) => e.em > abertura.em && e.em <= fechamento.em)
      .reduce((s, e) => s + e.quantidade, 0);

    const consumo = abertura.quantidade + entradasNoMes - fechamento.quantidade;
    saida.push({
      produtoId,
      de: abertura.em,
      ate: fechamento.em,
      saldoInicial: abertura.quantidade,
      entradas: entradasNoMes,
      saldoFinal: fechamento.quantidade,
      consumo,
      alerta: consumo < 0 ? "CONSUMO_NEGATIVO" : null,
    });
  }
  return saida;
}
