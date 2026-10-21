// A conferência da contagem: o que o sistema esperava encontrar na prateleira,
// o que a pessoa encontrou, e de onde vem a diferença.
//
// A CONTA:
//
//   esperado = contado antes + comprado − vendido (pela ficha) − perda declarada
//   diferença = contado agora − esperado
//
// Cada parcela vem de uma fonte diferente, e é por isso que a conta vale:
//
//   contado antes     a contagem anterior (que SOBRESCREVEU o saldo)
//   comprado          nota de compra do período
//   vendido           venda da semana explodida pela ficha técnica
//   perda declarada   o que o gerente lançou como quebra, validade, cortesia
//   contado agora     a contagem de hoje
//
// O SINAL DIZ O QUE ACONTECEU, e é a única coisa que o relatório afirma:
//
//   diferença < 0   sumiu mais do que a ficha explica
//   diferença > 0   sobrou — contagem a mais, compra não lançada, ficha que
//                   pede mais do que a cozinha usa
//
// O QUE ELE NÃO FAZ: dizer a causa. Falta de 12 kg de picanha pode ser furto,
// ficha errada, porção generosa ou contagem na unidade errada, e nenhum número
// aqui distingue os quatro. O relatório aponta ONDE olhar, em ordem de quanto
// dinheiro está em jogo; quem olha é gente.
//
// POR QUE SÓ PRODUTO COM DUAS CONTAGENS. Com uma contagem só não existe
// período fechado — existe marco zero. Mostrar "diferença" contra um saldo que
// nunca foi conferido seria inventar um erro que é só a ignorância inicial do
// sistema. Na segunda-feira da primeira contagem este relatório sai vazio de
// propósito, e isso é o certo.
//
// Núcleo puro: sem Prisma, sem I/O. Quem chama carrega e passa pronto.

export type ParcelasProduto = {
  produtoId: string;
  /** Contagem anterior. */
  saldoInicial: number;
  /** Entradas de nota/recebimento entre as duas contagens. */
  comprado: number;
  /** Baixa teórica da venda (ficha explodida) entre as duas contagens. */
  vendido: number;
  /** Perdas declaradas pelo gerente entre as duas contagens. */
  perdaDeclarada: number;
  /** Contagem de agora. */
  saldoContado: number;
  /** Preço unitário corrente, para converter a diferença em dinheiro. */
  preco: number;
};

export type LinhaConciliacao = ParcelasProduto & {
  esperado: number;
  diferenca: number;
  diferencaEmReais: number;
  /**
   * `SEM_FICHA` é informação, não defeito do produto: insumo que nenhuma ficha
   * menciona tem `vendido` zero, então TODA a saída dele aparece como falta.
   * Sem essa marca, o relatório abriria com uma lista de "sumiços" que são só
   * fichas que ninguém escreveu ainda — e a primeira leitura de quem abre a
   * tela seria de que o estoque está sendo roubado.
   */
  alerta: "SEM_FICHA" | "SOBRA" | null;
};

/** Diferença abaixo disto é ruído de balança, não achado. */
const TOLERANCIA = 0.001;

export function conciliarPuro(parcelas: ParcelasProduto[]): LinhaConciliacao[] {
  return parcelas
    .map((p) => {
      const esperado = p.saldoInicial + p.comprado - p.vendido - p.perdaDeclarada;
      const diferenca = p.saldoContado - esperado;
      return {
        ...p,
        esperado,
        diferenca,
        diferencaEmReais: diferenca * p.preco,
        alerta:
          p.vendido === 0 && p.saldoInicial + p.comprado > p.saldoContado
            ? ("SEM_FICHA" as const)
            : diferenca > TOLERANCIA
              ? ("SOBRA" as const)
              : null,
      };
    })
    // Ordem de dinheiro em jogo, maior falta primeiro: quem abre a tela tem
    // meia hora, e a meia hora tem que ser gasta nas primeiras linhas.
    // `abs` seria errado aqui — sobra de R$ 500 não disputa atenção com falta
    // de R$ 500, e empurrá-las pro mesmo topo esconderia a falta.
    .sort((a, b) => a.diferencaEmReais - b.diferencaEmReais);
}

export type TotaisConciliacao = {
  /** Falta de produto QUE TEM FICHA — a única que acusa alguma coisa. */
  faltaEmReais: number;
  /**
   * Falta de produto sem ficha, somada à parte.
   *
   * Sem essa separação o card de falta vira um número grande e sem sentido:
   * insumo sem ficha tem venda zero, então TODA a saída dele conta como falta.
   * Com 47 fichas escritas de 414 itens vendidos, a maior parte da "falta" do
   * primeiro relatório seria isso — e um número grande e falso na primeira
   * tela que a diretoria vê queima a confiança no relatório inteiro.
   */
  faltaSemFichaEmReais: number;
  sobraEmReais: number;
  liquidoEmReais: number;
  produtos: number;
  semFicha: number;
};

export function totalizarPuro(linhas: LinhaConciliacao[]): TotaisConciliacao {
  let faltaEmReais = 0;
  let faltaSemFichaEmReais = 0;
  let sobraEmReais = 0;
  for (const l of linhas) {
    if (l.diferencaEmReais >= 0) sobraEmReais += l.diferencaEmReais;
    else if (l.alerta === "SEM_FICHA") faltaSemFichaEmReais += -l.diferencaEmReais;
    else faltaEmReais += -l.diferencaEmReais;
  }
  return {
    faltaEmReais,
    faltaSemFichaEmReais,
    sobraEmReais,
    // Separados, e não só o saldo: R$ 3.000 de falta com R$ 2.900 de sobra não
    // é "R$ 100 de problema" — são dois problemas grandes que por acaso quase
    // se cancelam, e quase sempre significam troca de produto na contagem.
    //
    // O líquido inclui a falta sem ficha porque ele é o fechamento de tudo que
    // a prateleira contradiz; as colunas acima é que separam o que acusa do que
    // só falta escrever.
    liquidoEmReais: sobraEmReais - faltaEmReais - faltaSemFichaEmReais,
    produtos: linhas.length,
    semFicha: linhas.filter((l) => l.alerta === "SEM_FICHA").length,
  };
}
