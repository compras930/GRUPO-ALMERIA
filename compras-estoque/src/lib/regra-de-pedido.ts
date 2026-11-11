// A diretriz de pedidos, em código.
//
// A REGRA, dada pelo setor de compras em 11/11/2026:
//
//   - UM pedido normal por semana, de preferência na SEGUNDA-FEIRA;
//   - se a segunda cai em feriado, o dia do pedido anda para o próximo dia
//     útil da mesma semana;
//   - qualquer pedido ALÉM do primeiro da semana é EXTRA e só sai com MOTIVO
//     (falta, erro, perda, esquecimento, evento, aumento de demanda, outro).
//
// O QUE A REGRA ESTÁ MEDINDO. O pedido extra não é proibido — a casa não pode
// ficar sem mercadoria porque o sistema disse não. Ele é CARO: frete avulso,
// preço de emergência, alguém parando o serviço para receber. Então o app não
// bloqueia; ele obriga a nomear a causa, e o nome vira contagem. Trinta extras
// por "esquecimento" num trimestre é um problema de rotina; trinta por
// "evento" é um problema de previsão — e são remédios diferentes.
//
// PREFERÊNCIA NÃO É PROIBIÇÃO. Pedido normal feito na quarta não é recusado
// nem exige motivo: a diretriz diz "de preferência na segunda". A tela avisa,
// e só. Recusar o que a diretriz permite é o jeito mais rápido de ensinar o
// gerente a burlar o app.
//
// A SEMANA COMEÇA NA SEGUNDA, porque o pedido é da semana de serviço da casa.
// Semana começando no domingo jogaria o pedido de segunda e o da segunda
// seguinte em blocos que não se parecem com a rotina de ninguém.
//
// Núcleo puro: sem Prisma, sem I/O, sem Date.now().

import { feriadoDePura } from "@/lib/feriados";

export const MOTIVOS_EXTRA = [
  { valor: "FALTA", rotulo: "Falta — acabou antes do próximo pedido" },
  { valor: "ERRO", rotulo: "Erro no pedido da semana" },
  { valor: "PERDA", rotulo: "Perda, quebra ou vencimento" },
  { valor: "ESQUECIMENTO", rotulo: "Esquecimento" },
  { valor: "EVENTO", rotulo: "Evento" },
  { valor: "DEMANDA", rotulo: "Movimento acima do previsto" },
  { valor: "OUTRO", rotulo: "Outro (descreva)" },
] as const;

export type MotivoExtra = (typeof MOTIVOS_EXTRA)[number]["valor"];

export const MOTIVO_EXTRA_LABEL: Record<string, string> = Object.fromEntries(
  MOTIVOS_EXTRA.map((m) => [m.valor, m.rotulo])
);

export const ehMotivoValido = (v: string): v is MotivoExtra =>
  MOTIVOS_EXTRA.some((m) => m.valor === v);

const DIA = 24 * 60 * 60 * 1000;
const emMs = (d: string) => new Date(`${d}T00:00:00.000Z`).getTime();
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/**
 * O dia de hoje em BRASÍLIA (UTC-3), em AAAA-MM-DD.
 *
 * O servidor roda em UTC. Às 21h de domingo em Brasília já é segunda em UTC —
 * e a tela diria ao gerente que o pedido da semana está em dia quando a semana
 * nem começou. Três horas de diferença, uma semana inteira de conclusão errada.
 */
export function diaEmBrasiliaPura(agora: Date): string {
  return iso(agora.getTime() - 3 * 60 * 60 * 1000);
}

/** A segunda-feira da semana a que o dia pertence. */
export function segundaDaSemanaPura(dia: string): string {
  const t = emMs(dia);
  if (Number.isNaN(t)) return dia;
  const diaDaSemana = new Date(t).getUTCDay(); // 0 domingo … 6 sábado
  const recuo = (diaDaSemana + 6) % 7; // segunda = 0
  return iso(t - recuo * DIA);
}

export type SemanaDePedido = {
  /** Segunda-feira da semana. */
  inicio: string;
  /** Domingo da semana. */
  fim: string;
  /** O dia em que o pedido normal deveria sair. */
  diaPreferido: string;
  /** Preenchido quando a segunda é feriado e o dia andou. */
  feriadoQueEmpurrou: { dia: string; nome: string } | null;
};

/**
 * A semana do pedido e o dia preferido dela.
 *
 * O dia anda do feriado para a frente, nunca para trás: comprar antes exigiria
 * saber na sexta o que a casa vai precisar na semana seguinte, e a contagem de
 * segunda é justamente o que responde isso.
 */
export function semanaDePedidoPura(dia: string): SemanaDePedido {
  const inicio = segundaDaSemanaPura(dia);
  let preferido = inicio;
  let feriadoQueEmpurrou: { dia: string; nome: string } | null = null;
  // Anda no máximo até sexta: semana inteira de feriado não existe, e um teto
  // evita que um erro na lista vire laço.
  for (let n = 0; n < 5; n++) {
    const nome = feriadoDePura(preferido);
    if (!nome) break;
    if (!feriadoQueEmpurrou) feriadoQueEmpurrou = { dia: preferido, nome };
    preferido = iso(emMs(preferido) + DIA);
  }
  return { inicio, fim: iso(emMs(inicio) + 6 * DIA), diaPreferido: preferido, feriadoQueEmpurrou };
}

export type TipoDePedido = "NORMAL" | "EXTRA";

export type AvaliacaoDePedido = {
  tipo: TipoDePedido;
  semana: SemanaDePedido;
  /** Quantos pedidos a casa já fez nesta semana (os válidos). */
  jaFeitos: number;
  /** O pedido só pode ser criado com motivo preenchido. */
  exigeMotivo: boolean;
  /** "OUTRO" sem descrição não é motivo — é um campo preenchido. */
  exigeDetalhe: boolean;
  /** Impede a criação. Null = pode criar. */
  erro: string | null;
  /** Não impede nada; é o que a tela conta para quem está pedindo. */
  aviso: string | null;
};

/**
 * Decide se este pedido é o da semana ou um extra, e o que falta para ele sair.
 *
 * `jaFeitosNaSemana` conta só os pedidos que VALEM: cancelado e rejeitado não
 * entram, senão um pedido cancelado por engano às 9h transformaria o pedido
 * certo das 9h05 em extra — e o gerente teria que justificar o erro do app.
 */
export function avaliarPedidoPura(entrada: {
  hoje: string;
  jaFeitosNaSemana: number;
  motivo?: string | null;
  detalhe?: string | null;
}): AvaliacaoDePedido {
  const semana = semanaDePedidoPura(entrada.hoje);
  const tipo: TipoDePedido = entrada.jaFeitosNaSemana === 0 ? "NORMAL" : "EXTRA";
  const motivo = (entrada.motivo ?? "").trim();
  const detalhe = (entrada.detalhe ?? "").trim();

  let erro: string | null = null;
  let aviso: string | null = null;

  if (tipo === "EXTRA") {
    if (!motivo) {
      erro =
        "Esta casa já fez o pedido desta semana. Um pedido a mais é extra — escolha o motivo.";
    } else if (!ehMotivoValido(motivo)) {
      erro = "Motivo inválido.";
    } else if (motivo === "OUTRO" && detalhe.length < 3) {
      erro = "Escolheu “Outro”: descreva o que aconteceu.";
    }
  } else if (entrada.hoje !== semana.diaPreferido) {
    aviso = semana.feriadoQueEmpurrou
      ? `O pedido da semana era para sair ${rotuloCurto(semana.diaPreferido)} — a segunda caiu em ${semana.feriadoQueEmpurrou.nome}. Pode seguir; fica registrado.`
      : `O pedido da semana era para sair ${rotuloCurto(semana.diaPreferido)}. Pode seguir; fica registrado.`;
  }

  return {
    tipo,
    semana,
    jaFeitos: entrada.jaFeitosNaSemana,
    exigeMotivo: tipo === "EXTRA",
    exigeDetalhe: motivo === "OUTRO",
    erro,
    aviso,
  };
}

const SEMANA_PT = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** "segunda, 16/11" — para frase corrida, não para tabela. */
export function rotuloCurto(dia: string): string {
  const t = emMs(dia);
  if (Number.isNaN(t)) return dia;
  const d = new Date(t);
  return `${SEMANA_PT[d.getUTCDay()]}, ${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}
