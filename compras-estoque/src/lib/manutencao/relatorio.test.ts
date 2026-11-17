import { describe, it, expect } from "vitest";
import { montarRelatorio, chamadosRepetidos, type ChamadoRelatorio } from "./relatorio";

const H = 3_600_000;
const t0 = new Date("2026-11-02T12:00:00Z").getTime();
let n = 0;
function ch(o: Partial<ChamadoRelatorio>): ChamadoRelatorio {
  n++;
  return {
    id: `c${n}`,
    numero: n,
    status: "ABERTO",
    unidade: "Beira Lago",
    unidadeId: "bl",
    categoria: "ELETRICA",
    urgencia: "NORMAL",
    titulo: "x",
    local: null,
    localChave: null,
    colaborador: null,
    colaboradorInterno: null,
    abertoEm: new Date(t0),
    triadoEm: null,
    encaminhadoEm: null,
    aceitoEm: null,
    prazoFinal: null,
    concluidoEm: null,
    finalizadoEm: null,
    reprovacoes: 0,
    duplicadoDeId: null,
    ...o,
  };
}

describe("montarRelatorio", () => {
  const finalizado = ch({
    status: "FINALIZADO",
    colaborador: "João",
    triadoEm: new Date(t0 + 1 * H),
    encaminhadoEm: new Date(t0 + 1 * H),
    aceitoEm: new Date(t0 + 2 * H),
    prazoFinal: new Date(t0 + 26 * H),
    concluidoEm: new Date(t0 + 10 * H),
    finalizadoEm: new Date(t0 + 12 * H),
  });
  const atrasado = ch({
    status: "EM_ANDAMENTO",
    categoria: "HIDRAULICA",
    unidade: "Noroeste",
    unidadeId: "ns",
    colaborador: "João",
    aceitoEm: new Date(t0),
    prazoFinal: new Date(t0 + 24 * H),
  });
  const aberto = ch({});
  const duplicado = ch({ status: "RECUSADO", duplicadoDeId: "c3" });
  const recusado = ch({ status: "RECUSADO" });
  const r = montarRelatorio([finalizado, atrasado, aberto, duplicado, recusado], new Date(t0 + 48 * H));

  it("conta por situação", () => {
    expect(r.total).toBe(5);
    expect(r.finalizados).toBe(1);
    expect(r.emAndamento).toBe(1);
    expect(r.emAberto).toBe(1);
    expect(r.duplicados).toBe(1);
    expect(r.recusados).toBe(1);
    expect(r.atrasados).toBe(1);
  });
  it("tempos médios a partir das datas", () => {
    expect(r.tempos.triagem).toBe(1 * H);
    expect(r.tempos.resposta).toBe(1 * H);
    expect(r.tempos.execucao).toBe(8 * H);
    expect(r.tempos.total).toBe(12 * H);
    expect(r.noPrazoPct).toBe(100);
  });
  it("duplicado não vira demanda", () => {
    const eletrica = r.porCategoria.find((l) => l.chave === "ELETRICA")!;
    expect(eletrica.total).toBe(3); // finalizado + aberto + recusado
  });
  it("agrupa por colaborador", () => {
    expect(r.porColaborador).toHaveLength(1);
    expect(r.porColaborador[0].total).toBe(2);
    expect(r.porColaborador[0].atrasados).toBe(1);
  });
});

describe("chamadosRepetidos", () => {
  const dia = 86_400_000;
  const base = { localChave: "camara fria", local: "Câmara fria", categoria: "REFRIGERACAO", status: "FINALIZADO" };
  it("junta o mesmo defeito no mesmo lugar dentro da janela", () => {
    const g = chamadosRepetidos([
      ch({ ...base, abertoEm: new Date(t0) }),
      ch({ ...base, abertoEm: new Date(t0 + 10 * dia) }),
      ch({ ...base, abertoEm: new Date(t0 + 25 * dia) }),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].numeros).toHaveLength(3);
    expect(g[0].intervaloDias).toBe(25);
  });
  it("separa quando passa da janela, e ignora outra casa", () => {
    const g = chamadosRepetidos([
      ch({ ...base, abertoEm: new Date(t0) }),
      ch({ ...base, abertoEm: new Date(t0 + 60 * dia) }),
      ch({ ...base, unidadeId: "ns", abertoEm: new Date(t0 + 1 * dia) }),
    ]);
    expect(g).toHaveLength(0);
  });
  it("duplicado e recusado não contam como repetição", () => {
    const g = chamadosRepetidos([
      ch({ ...base, abertoEm: new Date(t0) }),
      ch({ ...base, abertoEm: new Date(t0 + dia), duplicadoDeId: "c1", status: "RECUSADO" }),
    ]);
    expect(g).toHaveLength(0);
  });
});
