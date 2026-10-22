// Mês de competência do painel.
//
// Núcleo puro: sem Prisma, sem I/O.
//
// POR QUE MÊS, E NÃO "ÚLTIMOS 30 DIAS". Os dois parecem a mesma coisa e não
// são: 30 dias corridos é uma janela que anda todo dia, então o mesmo painel
// aberto na terça e na quarta mostra totais diferentes — e nunca bate com
// nenhum relatório fechado, que é sempre por mês. Competência é o jeito que o
// resto da empresa conta.
//
// TUDO EM UTC, de propósito. `dataCompra` nasce de uma string "2026-08-01" e
// vira meia-noite UTC. Montar a borda do mês no fuso do servidor faria a
// primeira e a última compra do mês caírem fora da janela quando o servidor
// não estivesse em UTC — um erro de um dia em cada ponta, invisível e sempre
// a favor de um mês contra o outro.

export type Mes = { ano: number; mes: number; chave: string; inicio: Date; fim: Date; rotulo: string };

const NOMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** `fim` é EXCLUSIVO: é a meia-noite do dia 1º do mês seguinte. */
export function mesDe(ano: number, mes: number): Mes {
  const inicio = new Date(Date.UTC(ano, mes - 1, 1));
  const fim = new Date(Date.UTC(ano, mes, 1));
  return {
    ano,
    mes,
    chave: `${ano}-${String(mes).padStart(2, "0")}`,
    inicio,
    fim,
    rotulo: `${NOMES[mes - 1]} de ${ano}`,
  };
}

/** "2026-08" -> Mes. Qualquer coisa fora disso devolve null, nunca um palpite. */
export function mesDaChave(chave: string | undefined | null): Mes | null {
  const m = /^(\d{4})-(\d{2})$/.exec((chave ?? "").trim());
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12 || ano < 2000 || ano > 2100) return null;
  return mesDe(ano, mes);
}

export function mesDaData(d: Date): Mes {
  return mesDe(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

/** Os `quantos` meses terminando no mês de `referencia`, do mais novo ao mais velho. */
export function ultimosMeses(referencia: Date, quantos: number): Mes[] {
  const base = mesDaData(referencia);
  return Array.from({ length: quantos }, (_, n) => {
    const d = new Date(Date.UTC(base.ano, base.mes - 1 - n, 1));
    return mesDe(d.getUTCFullYear(), d.getUTCMonth() + 1);
  });
}

/** Rótulo curto pro seletor: "ago/26". */
export function rotuloCurto(m: Mes): string {
  return `${NOMES[m.mes - 1].slice(0, 3)}/${String(m.ano).slice(2)}`;
}

/**
 * O primeiro mês que o sistema tem dado para mostrar.
 *
 * Agosto de 2026 é quando a carga de compras começou. Antes disso o banco está
 * vazio, e um mês vazio no seletor não é neutro: ele mostra CMV zero,
 * faturamento zero e curva ABC vazia, com a mesma cara de um mês ruim de
 * verdade. Quem abre "maio" e vê tudo zerado não conclui "não há dado" —
 * conclui "a casa não vendeu", ou pior, "o sistema está quebrado".
 */
export const PRIMEIRO_MES_COM_DADO = "2026-08";

/**
 * Os meses que o seletor oferece: os últimos `quantos`, cortados no primeiro
 * mês com dado.
 *
 * Devolve pelo menos um mês sempre — se a referência for anterior ao corte
 * (relógio errado, ambiente de teste), devolve o mês da referência em vez de
 * lista vazia. Seletor vazio trava a tela inteira; um mês fora da faixa só
 * mostra zeros.
 */
export function mesesDisponiveis(
  referencia: Date,
  quantos: number,
  primeiro: string = PRIMEIRO_MES_COM_DADO
): Mes[] {
  const corte = mesDaChave(primeiro);
  const lista = ultimosMeses(referencia, quantos);
  if (!corte) return lista;
  const dentro = lista.filter((m) => m.chave >= corte.chave);
  return dentro.length > 0 ? dentro : [mesDaData(referencia)];
}
