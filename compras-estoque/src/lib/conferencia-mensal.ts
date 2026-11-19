// A conferência do MÊS INTEIRO, semana a semana.
//
// POR QUE EXISTE. A tela de conferência responde "o que faltou na última
// contagem". É a pergunta certa na segunda-feira e a errada no fim do mês: uma
// falta de picanha isolada é porção generosa ou erro de contagem; a MESMA
// falta quatro semanas seguidas é outra coisa, e só aparece quando as semanas
// estão lado a lado.
//
// CADA SEMANA É UM PERÍODO FECHADO DO PRODUTO: entre duas contagens dele. A
// semana da coluna é a da contagem que ABRIU o período — é nela que a
// mercadoria saiu, mesma régua do CMV semanal.
//
// SEMANA SEM CONTAGEM FICA VAZIA, e vazia é informação: quer dizer que ninguém
// contou, não que não faltou nada. Preencher com zero diria "conferido, tudo
// certo" sobre uma semana que não foi conferida — e é assim que uma casa para
// de contar sem ninguém notar.
//
// Núcleo puro: sem Prisma, sem I/O.

import { conciliarPuro, type ParcelasProduto } from "@/lib/conciliacao";

export type ContagemBruta = { produtoId: string; quantidade: number; em: Date };
export type MovimentoBruto = { produtoId: string; tipo: string; quantidade: number; em: Date };

export type CelulaDaSemana = {
  semana: string;
  de: Date;
  ate: Date;
  diferenca: number;
  diferencaEmReais: number;
  saldoInicial: number;
  saldoContado: number;
  comprado: number;
  vendido: number;
  perdaDeclarada: number;
  esperado: number;
  semFicha: boolean;
};

export type LinhaMensal = {
  produtoId: string;
  /** Uma célula por semana do mês; `null` onde não houve período fechado. */
  celulas: (CelulaDaSemana | null)[];
  /**
   * Soma das semanas com período fechado, NA UNIDADE DO PRODUTO.
   *
   * É o número que quem conta reconhece: ele contou caixa, quilo e litro, não
   * reais. O valor existe ao lado para priorizar — 1 kg de picanha e 1 kg de
   * sal não disputam a mesma atenção —, mas quem lê a linha primeiro lê a
   * quantidade.
   */
  totalQuantidade: number;
  /** Quanto entrou de mercadoria no mês, na unidade do produto. */
  compradoNoMes: number;
  /** Soma das semanas com período fechado. */
  totalEmReais: number;
  /** Em quantas semanas o produto FALTOU — o padrão que interessa. */
  semanasComFalta: number;
  /** Em quantas semanas ele foi conferido de fato. */
  semanasConferidas: number;
};

const DIA = 24 * 60 * 60 * 1000;

/** A segunda-feira da data, no fuso de Brasília, em AAAA-MM-DD. */
export function segundaPura(d: Date): string {
  const local = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  const recuo = (local.getUTCDay() + 6) % 7;
  return new Date(local.getTime() - recuo * DIA).toISOString().slice(0, 10);
}

/**
 * As segundas-feiras que o mês toca, da mais antiga para a mais nova.
 *
 * Entra a semana que COMEÇA antes do mês e termina dentro dele: a contagem da
 * segunda dia 30 de um mês fecha o período que foi consumido no mês seguinte,
 * e cortá-la deixaria a primeira semana sem ponto de partida.
 */
export function semanasDoMesPuras(inicio: Date, fim: Date): string[] {
  const semanas: string[] = [];
  let atual = new Date(`${segundaPura(inicio)}T12:00:00.000Z`).getTime();
  const limite = fim.getTime();
  for (let n = 0; n < 8 && atual < limite + DIA; n++) {
    semanas.push(new Date(atual).toISOString().slice(0, 10));
    atual += 7 * DIA;
  }
  return semanas;
}

export function conferenciaMensalPura(entrada: {
  contagens: ContagemBruta[];
  movimentos: MovimentoBruto[];
  precoPorProduto: Map<string, number>;
  semanas: string[];
  /** Tipos de movimento que são ENTRADA de mercadoria. */
  tiposDeEntrada: readonly string[];
  /** Tipos de movimento que são PERDA declarada. */
  tiposDePerda: readonly string[];
}): LinhaMensal[] {
  const porProduto = new Map<string, ContagemBruta[]>();
  for (const c of entrada.contagens) {
    if (!porProduto.has(c.produtoId)) porProduto.set(c.produtoId, []);
    porProduto.get(c.produtoId)!.push(c);
  }
  const movPorProduto = new Map<string, MovimentoBruto[]>();
  for (const m of entrada.movimentos) {
    if (!movPorProduto.has(m.produtoId)) movPorProduto.set(m.produtoId, []);
    movPorProduto.get(m.produtoId)!.push(m);
  }

  const indiceDaSemana = new Map(entrada.semanas.map((s, i) => [s, i]));
  const linhas: LinhaMensal[] = [];

  for (const [produtoId, lista] of porProduto) {
    const ordenada = [...lista].sort((a, b) => a.em.getTime() - b.em.getTime());
    if (ordenada.length < 2) continue;

    const celulas: (CelulaDaSemana | null)[] = entrada.semanas.map(() => null);
    const movimentos = movPorProduto.get(produtoId) ?? [];
    const preco = entrada.precoPorProduto.get(produtoId) ?? 0;

    for (let i = 1; i < ordenada.length; i++) {
      const anterior = ordenada[i - 1];
      const atual = ordenada[i];
      const coluna = indiceDaSemana.get(segundaPura(anterior.em));
      if (coluna === undefined) continue; // período fora do mês na tela

      let comprado = 0;
      let vendido = 0;
      let perdaDeclarada = 0;
      for (const m of movimentos) {
        // Mesma régua do resto: entrada no instante da contagem anterior já
        // estava na prateleira; no instante da atual, ainda não.
        if (!(m.em > anterior.em && m.em <= atual.em)) continue;
        if (m.tipo === "SAIDA_CONSUMO") vendido += Math.abs(m.quantidade);
        else if (entrada.tiposDePerda.includes(m.tipo)) perdaDeclarada += Math.abs(m.quantidade);
        else if (entrada.tiposDeEntrada.includes(m.tipo)) comprado += m.quantidade;
      }

      const parcelas: ParcelasProduto = {
        produtoId,
        saldoInicial: anterior.quantidade,
        comprado,
        vendido,
        perdaDeclarada,
        saldoContado: atual.quantidade,
        preco,
      };
      const [conciliada] = conciliarPuro([parcelas]);

      // Duas contagens na MESMA semana (recontagem, correção): fica a última,
      // que é a que a casa considera boa.
      celulas[coluna] = {
        semana: entrada.semanas[coluna],
        de: anterior.em,
        ate: atual.em,
        diferenca: conciliada.diferenca,
        diferencaEmReais: conciliada.diferencaEmReais,
        saldoInicial: conciliada.saldoInicial,
        saldoContado: conciliada.saldoContado,
        comprado: conciliada.comprado,
        vendido: conciliada.vendido,
        perdaDeclarada: conciliada.perdaDeclarada,
        esperado: conciliada.esperado,
        semFicha: conciliada.alerta === "SEM_FICHA",
      };
    }

    const preenchidas = celulas.filter((c): c is CelulaDaSemana => c !== null);
    if (preenchidas.length === 0) continue;

    linhas.push({
      produtoId,
      celulas,
      totalQuantidade: preenchidas.reduce((s, c) => s + c.diferenca, 0),
      compradoNoMes: preenchidas.reduce((s, c) => s + c.comprado, 0),
      totalEmReais: preenchidas.reduce((s, c) => s + c.diferencaEmReais, 0),
      semanasComFalta: preenchidas.filter((c) => c.diferencaEmReais < 0).length,
      semanasConferidas: preenchidas.length,
    });
  }

  // Maior falta primeiro — a mesma ordem da conferência semanal, e pela mesma
  // razão: quem abre a tela tem meia hora, e ela tem que ser gasta no topo.
  return linhas.sort((a, b) => a.totalEmReais - b.totalEmReais);
}

export type ContagemDaSemana = {
  semana: string;
  /** Quantos produtos a casa contou na semana. Zero = ninguém contou. */
  produtos: number;
};

/**
 * Quantos produtos a casa contou em cada semana — a régua do aviso de
 * "esta casa não contou".
 *
 * É uma pergunta diferente de "quanto faltou": uma casa que não conta não
 * aparece como falta nenhuma, aparece como TELA VAZIA. Sem este aviso, o
 * silêncio parece boa notícia.
 */
export function contagensPorSemanaPura(
  contagens: ContagemBruta[],
  semanas: string[]
): ContagemDaSemana[] {
  const porSemana = new Map<string, Set<string>>();
  for (const c of contagens) {
    const s = segundaPura(c.em);
    if (!porSemana.has(s)) porSemana.set(s, new Set());
    porSemana.get(s)!.add(c.produtoId);
  }
  return semanas.map((semana) => ({ semana, produtos: porSemana.get(semana)?.size ?? 0 }));
}
