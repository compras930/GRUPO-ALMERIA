import { describe, it, expect } from "vitest";
import {
  chaveTexto,
  semelhanca,
  possiveisDuplicados,
  calcularPrazoFinal,
  estaAtrasado,
  fmtDuracao,
  normalizarTelefone,
  fmtTelefone,
} from "./regras";
import { grupoDoStatus, STATUS_CHAMADO } from "./constantes";

describe("grupoDoStatus — as cores do painel", () => {
  it("vermelho enquanto ninguém começou", () => {
    expect(grupoDoStatus("ABERTO")).toBe("ABERTO");
    expect(grupoDoStatus("ENCAMINHADO")).toBe("ABERTO");
  });
  it("amarelo do OK até a casa aprovar", () => {
    expect(grupoDoStatus("EM_ANDAMENTO")).toBe("ANDAMENTO");
    expect(grupoDoStatus("AGUARDANDO_APROVACAO")).toBe("ANDAMENTO");
  });
  it("verde só depois de aprovado", () => {
    expect(grupoDoStatus("FINALIZADO")).toBe("FINALIZADO");
  });
  it("recusado e cancelado não contam como finalizado", () => {
    expect(grupoDoStatus("RECUSADO")).toBe("ENCERRADO");
    expect(grupoDoStatus("CANCELADO")).toBe("ENCERRADO");
  });
  it("todo status tem grupo", () => {
    for (const s of STATUS_CHAMADO) expect(grupoDoStatus(s)).toBeTruthy();
  });
});

describe("chaveTexto", () => {
  it("ignora acento, caixa e pontuação", () => {
    expect(chaveTexto("Câmara Fria  2.")).toBe("camara fria 2");
    expect(chaveTexto("camara fria 2")).toBe("camara fria 2");
  });
  it("vazio vira null", () => {
    expect(chaveTexto("  ")).toBeNull();
    expect(chaveTexto(null)).toBeNull();
  });
});

describe("possiveisDuplicados", () => {
  const base: {
    unidadeId: string;
    categoria: string;
    titulo: string;
    descricao: string;
    localChave: string | null;
  } = {
    unidadeId: "bl",
    categoria: "REFRIGERACAO",
    titulo: "Câmara fria não gela",
    descricao: "A câmara fria de carnes está com temperatura alta",
    localChave: "camara fria 1",
  };
  const existente = (o: Partial<typeof base & { id: string; numero: number; status: string }>) => ({
    id: "x",
    numero: 1,
    status: "ABERTO",
    ...base,
    ...o,
  });

  it("acha pelo mesmo local", () => {
    const r = possiveisDuplicados(base, [existente({ titulo: "Barulho", descricao: "faz barulho" })]);
    expect(r).toHaveLength(1);
  });
  it("acha por texto parecido mesmo sem local", () => {
    const r = possiveisDuplicados({ ...base, localChave: null }, [
      existente({ localChave: null, titulo: "Camara fria nao esta gelando", descricao: "temperatura alta nas carnes" }),
    ]);
    expect(r).toHaveLength(1);
  });
  it("ignora outra casa, outra categoria e chamado já finalizado", () => {
    expect(possiveisDuplicados(base, [existente({ unidadeId: "ns" })])).toHaveLength(0);
    expect(possiveisDuplicados(base, [existente({ categoria: "ELETRICA" })])).toHaveLength(0);
    expect(possiveisDuplicados(base, [existente({ status: "FINALIZADO" })])).toHaveLength(0);
  });
  it("dois defeitos diferentes da mesma categoria não são duplicados", () => {
    const r = possiveisDuplicados(
      { ...base, localChave: "freezer bar", titulo: "Freezer do bar com gelo acumulado", descricao: "porta não veda" },
      [existente({})]
    );
    expect(r).toHaveLength(0);
  });
});

describe("semelhanca", () => {
  it("texto igual = 1, sem palavra em comum = 0", () => {
    expect(semelhanca("torneira pingando", "Torneira pingando")).toBe(1);
    expect(semelhanca("torneira pingando", "lâmpada queimada")).toBe(0);
  });
});

describe("prazo e atraso", () => {
  const ok = new Date("2026-11-10T12:00:00Z");
  const prazo = calcularPrazoFinal(ok, 24);
  it("prazo conta a partir do OK", () => {
    expect(prazo.toISOString()).toBe("2026-11-11T12:00:00.000Z");
  });
  it("em execução depois do prazo = atrasado", () => {
    const c = { prazoFinal: prazo, concluidoEm: null, status: "EM_ANDAMENTO" };
    expect(estaAtrasado(c, new Date("2026-11-11T11:00:00Z"))).toBe(false);
    expect(estaAtrasado(c, new Date("2026-11-11T13:00:00Z"))).toBe(true);
  });
  it("concluído: vale a hora em que terminou, não a de agora", () => {
    expect(
      estaAtrasado({ prazoFinal: prazo, concluidoEm: new Date("2026-11-11T10:00:00Z"), status: "FINALIZADO" }, new Date("2027-01-01"))
    ).toBe(false);
    expect(
      estaAtrasado({ prazoFinal: prazo, concluidoEm: new Date("2026-11-12T10:00:00Z"), status: "FINALIZADO" })
    ).toBe(true);
  });
  it("sem OK ainda não há prazo", () => {
    expect(estaAtrasado({ prazoFinal: null, concluidoEm: null, status: "ENCAMINHADO" })).toBe(false);
  });
});

describe("fmtDuracao", () => {
  it("formata minutos, horas e dias", () => {
    expect(fmtDuracao(45 * 60_000)).toBe("45 min");
    expect(fmtDuracao(200 * 60_000)).toBe("3 h 20 min");
    expect(fmtDuracao((2 * 24 + 4) * 3_600_000)).toBe("2 d 4 h");
    expect(fmtDuracao(null)).toBe("—");
  });
});

describe("normalizarTelefone", () => {
  it("aceita como as pessoas digitam", () => {
    expect(normalizarTelefone("(61) 99999-1234")).toBe("5561999991234");
    expect(normalizarTelefone("+55 61 9 9999 1234")).toBe("5561999991234");
    expect(normalizarTelefone("6133331234")).toBe("556133331234");
  });
  it("recusa o que não é telefone", () => {
    expect(normalizarTelefone("1234")).toBeNull();
    expect(normalizarTelefone("")).toBeNull();
  });
  it("formata de volta", () => {
    expect(fmtTelefone("5561999991234")).toBe("(61) 99999-1234");
  });
});
