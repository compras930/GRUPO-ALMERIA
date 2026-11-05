// Dois períodos de venda não podem se tocar.
//
// POR QUE ISTO VIROU CÓDIGO. A carga semanal do Teknisa reenvia as últimas
// cinco semanas a cada rodada e conta com a recusa para não regravar. Isso só
// é seguro se a recusa pegar QUALQUER sobreposição — e até 05/11/2026 ela
// pegava só período IDÊNTICO:
//
//     where: { unidadeId, periodoInicio, periodoFim }
//
// Enquanto as bordas da semana forem exatamente as mesmas, funciona. Mas basta
// a régua mudar um dia — um ajuste no corte da virada do mês, um fuso que
// empurre uma data — para o período virar "parecido mas não igual", passar
// pela trava e somar a mesma venda duas vezes. O faturamento dobra na parte
// que se sobrepõe, e nada na tela diria que isso aconteceu.
//
// O MODO DE FALHAR ERA O PIOR POSSÍVEL: silencioso, e só visível meses depois,
// quando alguém estranhasse o CMV de uma semana.
//
// Núcleo puro: sem Prisma, sem I/O.

/**
 * Dois intervalos FECHADOS se sobrepõem?
 *
 * Fechados dos dois lados porque é assim que o período de venda é escrito e
 * lido: "01/11 a 08/11" inclui os dois dias. Uma semana que termina em 08 e
 * outra que começa em 08 contam o domingo duas vezes — e é exatamente o erro
 * que esta função existe para pegar.
 */
export function sobrepoePura(aInicio: Date, aFim: Date, bInicio: Date, bFim: Date): boolean {
  return aInicio.getTime() <= bFim.getTime() && aFim.getTime() >= bInicio.getTime();
}

const dia = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join("/");

/**
 * A mensagem da recusa.
 *
 * Separa "igual" de "se sobrepõe" porque as duas pedem reação diferente de
 * quem carrega: período igual é reenvio, e a resposta certa é seguir adiante.
 * Sobreposição é régua desalinhada, e aí alguém precisa olhar antes de
 * insistir.
 */
export function mensagemDeConflitoPura(
  casa: string,
  novoInicio: Date,
  novoFim: Date,
  existenteInicio: Date,
  existenteFim: Date
): string {
  const igual =
    novoInicio.getTime() === existenteInicio.getTime() && novoFim.getTime() === existenteFim.getTime();
  if (igual) {
    return `Já existe uma venda semanal registrada para "${casa}" no período ${dia(novoInicio)} a ${dia(novoFim)}.`;
  }
  return (
    `O período ${dia(novoInicio)} a ${dia(novoFim)} de "${casa}" se sobrepõe a uma venda já registrada, ` +
    `de ${dia(existenteInicio)} a ${dia(existenteFim)}. Carregar assim contaria a venda dos dias em comum ` +
    `duas vezes — ajuste o recorte antes de reenviar.`
  );
}
