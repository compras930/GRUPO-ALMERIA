// Os números da manutenção — agregação pura sobre a lista de chamados do
// período. Quem busca no banco é relatorio-db.ts; aqui só se conta.

import { DIAS_JANELA_REPETIDO, grupoDoStatus, rotuloCategoria } from "./constantes";
import { estaAtrasado } from "./regras";

export type ChamadoRelatorio = {
  id: string;
  numero: number;
  status: string;
  unidade: string;
  unidadeId: string;
  categoria: string;
  urgencia: string;
  titulo: string;
  local: string | null;
  localChave: string | null;
  colaborador: string | null;
  colaboradorInterno: boolean | null;
  abertoEm: Date;
  triadoEm: Date | null;
  encaminhadoEm: Date | null;
  aceitoEm: Date | null;
  prazoFinal: Date | null;
  concluidoEm: Date | null;
  finalizadoEm: Date | null;
  reprovacoes: number;
  duplicadoDeId: string | null;
};

const ms = (a: Date | null, b: Date | null) => (a && b ? b.getTime() - a.getTime() : null);

function media(vals: (number | null)[]): number | null {
  const v = vals.filter((x): x is number => x != null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

export type Tempos = {
  /** abertura → triagem pelo responsável */
  triagem: number | null;
  /** encaminhamento → OK do colaborador */
  resposta: number | null;
  /** OK → colaborador concluir */
  execucao: number | null;
  /** abertura → casa aprovar (o tempo que a casa sente) */
  total: number | null;
};

export function temposDoChamado(c: ChamadoRelatorio): Tempos {
  return {
    triagem: ms(c.abertoEm, c.triadoEm),
    resposta: ms(c.encaminhadoEm, c.aceitoEm),
    execucao: ms(c.aceitoEm, c.concluidoEm),
    total: ms(c.abertoEm, c.finalizadoEm),
  };
}

function temposMedios(cs: ChamadoRelatorio[]): Tempos {
  const t = cs.map(temposDoChamado);
  return {
    triagem: media(t.map((x) => x.triagem)),
    resposta: media(t.map((x) => x.resposta)),
    execucao: media(t.map((x) => x.execucao)),
    total: media(t.map((x) => x.total)),
  };
}

export type LinhaAgrupada = {
  chave: string;
  rotulo: string;
  total: number;
  emAberto: number;
  emAndamento: number;
  finalizados: number;
  atrasados: number;
  reprovacoes: number;
  tempoMedioTotal: number | null;
  tempoMedioExecucao: number | null;
};

function agrupar(
  cs: ChamadoRelatorio[],
  chave: (c: ChamadoRelatorio) => string | null,
  rotulo: (k: string, c: ChamadoRelatorio) => string,
  agora: Date
): LinhaAgrupada[] {
  const mapa = new Map<string, { rotulo: string; itens: ChamadoRelatorio[] }>();
  for (const c of cs) {
    const k = chave(c);
    if (k == null) continue;
    const g = mapa.get(k) ?? { rotulo: rotulo(k, c), itens: [] };
    g.itens.push(c);
    mapa.set(k, g);
  }
  return [...mapa.entries()]
    .map(([k, g]) => {
      const t = temposMedios(g.itens);
      return {
        chave: k,
        rotulo: g.rotulo,
        total: g.itens.length,
        emAberto: g.itens.filter((c) => grupoDoStatus(c.status) === "ABERTO").length,
        emAndamento: g.itens.filter((c) => grupoDoStatus(c.status) === "ANDAMENTO").length,
        finalizados: g.itens.filter((c) => c.status === "FINALIZADO").length,
        atrasados: g.itens.filter((c) => estaAtrasado(c, agora)).length,
        reprovacoes: g.itens.reduce((s, c) => s + c.reprovacoes, 0),
        tempoMedioTotal: t.total,
        tempoMedioExecucao: t.execucao,
      };
    })
    .sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo));
}

export type GrupoRepetido = {
  unidade: string;
  categoria: string;
  local: string;
  numeros: number[];
  /** dias entre o primeiro e o último da sequência */
  intervaloDias: number;
};

/**
 * REPETIDO = o mesmo problema voltando. Mesma casa, mesma categoria, mesmo
 * local/equipamento, com no máximo DIAS_JANELA_REPETIDO entre um chamado e o
 * seguinte. É o número que mostra conserto mal feito ou equipamento que já
 * pede troca — e é diferente de DUPLICADO (dois chamados ao mesmo tempo para a
 * mesma coisa), que é contado à parte.
 *
 * Chamado recusado/cancelado/duplicado não entra: não foi manutenção feita.
 */
export function chamadosRepetidos(
  cs: ChamadoRelatorio[],
  janelaDias = DIAS_JANELA_REPETIDO
): GrupoRepetido[] {
  const validos = cs.filter(
    (c) => c.localChave && !c.duplicadoDeId && c.status !== "RECUSADO" && c.status !== "CANCELADO"
  );
  const mapa = new Map<string, ChamadoRelatorio[]>();
  for (const c of validos) {
    const k = `${c.unidadeId}|${c.categoria}|${c.localChave}`;
    mapa.set(k, [...(mapa.get(k) ?? []), c]);
  }
  const janelaMs = janelaDias * 86_400_000;
  const grupos: GrupoRepetido[] = [];
  for (const lista of mapa.values()) {
    lista.sort((a, b) => a.abertoEm.getTime() - b.abertoEm.getTime());
    let seq: ChamadoRelatorio[] = [lista[0]];
    const fechar = () => {
      if (seq.length > 1) {
        const p = seq[0];
        grupos.push({
          unidade: p.unidade,
          categoria: rotuloCategoria(p.categoria),
          local: p.local ?? p.localChave ?? "",
          numeros: seq.map((c) => c.numero),
          intervaloDias: Math.round(
            (seq[seq.length - 1].abertoEm.getTime() - p.abertoEm.getTime()) / 86_400_000
          ),
        });
      }
    };
    for (let i = 1; i < lista.length; i++) {
      const ant = seq[seq.length - 1];
      if (lista[i].abertoEm.getTime() - ant.abertoEm.getTime() <= janelaMs) seq.push(lista[i]);
      else {
        fechar();
        seq = [lista[i]];
      }
    }
    fechar();
  }
  return grupos.sort((a, b) => b.numeros.length - a.numeros.length || a.unidade.localeCompare(b.unidade));
}

export type Relatorio = {
  total: number;
  emAberto: number;
  emAndamento: number;
  finalizados: number;
  recusados: number;
  cancelados: number;
  duplicados: number;
  atrasados: number;
  /** % dos concluídos que terminaram dentro do prazo */
  noPrazoPct: number | null;
  reprovacoes: number;
  tempos: Tempos;
  porCategoria: LinhaAgrupada[];
  porUnidade: LinhaAgrupada[];
  porColaborador: LinhaAgrupada[];
  porLocal: LinhaAgrupada[];
  repetidos: GrupoRepetido[];
};

export function montarRelatorio(cs: ChamadoRelatorio[], agora: Date = new Date()): Relatorio {
  const concluidosComPrazo = cs.filter((c) => c.concluidoEm && c.prazoFinal);
  const noPrazo = concluidosComPrazo.filter((c) => !estaAtrasado(c, agora)).length;
  // Duplicado não é chamado de verdade: fica fora de tempos e agrupamentos,
  // senão a casa que reabre o mesmo pedido três vezes "tem três demandas".
  const reais = cs.filter((c) => !c.duplicadoDeId);
  return {
    total: cs.length,
    emAberto: cs.filter((c) => grupoDoStatus(c.status) === "ABERTO").length,
    emAndamento: cs.filter((c) => grupoDoStatus(c.status) === "ANDAMENTO").length,
    finalizados: cs.filter((c) => c.status === "FINALIZADO").length,
    recusados: cs.filter((c) => c.status === "RECUSADO" && !c.duplicadoDeId).length,
    cancelados: cs.filter((c) => c.status === "CANCELADO").length,
    duplicados: cs.filter((c) => c.duplicadoDeId).length,
    atrasados: cs.filter((c) => estaAtrasado(c, agora)).length,
    noPrazoPct: concluidosComPrazo.length ? (noPrazo / concluidosComPrazo.length) * 100 : null,
    reprovacoes: cs.reduce((s, c) => s + c.reprovacoes, 0),
    tempos: temposMedios(reais),
    porCategoria: agrupar(reais, (c) => c.categoria, (k) => rotuloCategoria(k), agora),
    porUnidade: agrupar(reais, (c) => c.unidadeId, (_k, c) => c.unidade, agora),
    porColaborador: agrupar(
      reais,
      (c) => c.colaborador,
      (k, c) => (c.colaboradorInterno ? `${k} (agente)` : k),
      agora
    ),
    porLocal: agrupar(
      reais,
      (c) => (c.localChave ? `${c.unidadeId}|${c.localChave}` : null),
      (_k, c) => `${c.local} — ${c.unidade}`,
      agora
    ).filter((l) => l.total > 1),
    repetidos: chamadosRepetidos(cs),
  };
}
