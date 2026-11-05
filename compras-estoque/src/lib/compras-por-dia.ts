// A compra dia a dia, para enxergar o pico.
//
// A PERGUNTA É "QUANDO", NÃO "QUANTO". O total do mês já está no Painel. Aqui
// a informação está na FORMA da série: a entrega grande de terça, a semana em
// que se estocou para um evento, o dia em que não entrou nada.
//
// DIA SEM COMPRA ENTRA NA LISTA, com zero. É o ponto mais fácil de errar: se a
// série pular os dias vazios, as barras ficam encostadas e o gráfico mostra
// "comprou todo dia" — o buraco de três dias some, e ele é justamente o que
// explica o pico do dia seguinte.
//
// O VALOR É O DA LINHA DA NOTA, pela data da NOTA e não pela data da carga —
// a mesma régua do resto do app. Uma nota lançada com atraso aparece no dia em
// que a mercadoria foi comprada, que é onde ela significa alguma coisa.
//
// Núcleo puro: sem Prisma, sem I/O.

export type LinhaDeCompra = {
  dia: string; // AAAA-MM-DD
  valor: number;
  enxuto: boolean;
};

export type DiaDeCompra = {
  dia: string;
  valor: number;
  enxuto: number;
  linhas: number;
  /** Altura da barra, 0 a 1, relativa ao maior dia da janela. */
  altura: number;
  /** É o maior dia da janela — o único que ganha rótulo direto no gráfico. */
  pico: boolean;
  /** Sábado ou domingo. */
  fimDeSemana: boolean;
};

export type SerieDeCompra = {
  dias: DiaDeCompra[];
  total: number;
  enxuto: number;
  linhas: number;
  /** Dias com alguma compra — o denominador honesto da média. */
  diasComCompra: number;
  /**
   * Média por dia COM COMPRA, não por dia do calendário.
   *
   * Dividir pelo número de dias do período responde outra pergunta e sempre dá
   * um número menor: numa casa que recebe três vezes por semana, a média por
   * dia de calendário não descreve nenhum dia que existiu.
   */
  mediaPorDiaComCompra: number;
  maior: DiaDeCompra | null;
};

/** Os dias do intervalo, inclusive os dois extremos, em AAAA-MM-DD. */
export function diasDoIntervaloPura(de: string, ate: string): string[] {
  const dias: string[] = [];
  const fim = new Date(`${ate}T00:00:00.000Z`).getTime();
  let atual = new Date(`${de}T00:00:00.000Z`).getTime();
  if (Number.isNaN(atual) || Number.isNaN(fim) || atual > fim) return dias;
  // Teto de dois anos: a tela não serve para isso, e um intervalo digitado
  // errado não pode virar um laço de dez mil voltas.
  for (let n = 0; atual <= fim && n < 800; n++) {
    dias.push(new Date(atual).toISOString().slice(0, 10));
    atual += 24 * 60 * 60 * 1000;
  }
  return dias;
}

export function serieDeCompraPura(linhas: LinhaDeCompra[], de: string, ate: string): SerieDeCompra {
  const porDia = new Map<string, { valor: number; enxuto: number; linhas: number }>();
  for (const l of linhas) {
    const atual = porDia.get(l.dia) ?? { valor: 0, enxuto: 0, linhas: 0 };
    atual.valor += l.valor;
    if (l.enxuto) atual.enxuto += l.valor;
    atual.linhas++;
    porDia.set(l.dia, atual);
  }

  const calendario = diasDoIntervaloPura(de, ate);
  const maiorValor = Math.max(0, ...calendario.map((d) => porDia.get(d)?.valor ?? 0));

  const dias: DiaDeCompra[] = calendario.map((dia) => {
    const d = porDia.get(dia) ?? { valor: 0, enxuto: 0, linhas: 0 };
    const semana = new Date(`${dia}T00:00:00.000Z`).getUTCDay();
    return {
      dia,
      valor: d.valor,
      enxuto: d.enxuto,
      linhas: d.linhas,
      altura: maiorValor > 0 ? d.valor / maiorValor : 0,
      // Marcado depois: empate no maior valor não pode render dois picos.
      pico: false,
      fimDeSemana: semana === 0 || semana === 6,
    };
  });

  const maior = dias.find((d) => d.valor === maiorValor && maiorValor > 0) ?? null;
  if (maior) maior.pico = true;

  const comCompra = dias.filter((d) => d.valor > 0);
  const total = dias.reduce((s, d) => s + d.valor, 0);

  return {
    dias,
    total,
    enxuto: dias.reduce((s, d) => s + d.enxuto, 0),
    linhas: dias.reduce((s, d) => s + d.linhas, 0),
    diasComCompra: comCompra.length,
    mediaPorDiaComCompra: comCompra.length > 0 ? total / comCompra.length : 0,
    maior,
  };
}
