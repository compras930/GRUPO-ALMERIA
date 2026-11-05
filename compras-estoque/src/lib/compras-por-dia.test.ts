import { describe, it, expect } from "vitest";
import { serieDeCompraPura, diasDoIntervaloPura, type LinhaDeCompra } from "@/lib/compras-por-dia";

const l = (dia: string, valor: number, enxuto = true): LinhaDeCompra => ({ dia, valor, enxuto });

describe("diasDoIntervaloPura", () => {
  it("inclui os dois extremos", () => {
    expect(diasDoIntervaloPura("2026-11-01", "2026-11-03")).toEqual([
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
    ]);
  });

  it("um dia só", () => {
    expect(diasDoIntervaloPura("2026-11-01", "2026-11-01")).toEqual(["2026-11-01"]);
  });

  it("atravessa a virada do mês e do ano", () => {
    expect(diasDoIntervaloPura("2026-12-30", "2027-01-02")).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
  });

  it("intervalo invertido ou inválido devolve vazio em vez de laço infinito", () => {
    expect(diasDoIntervaloPura("2026-11-10", "2026-11-01")).toEqual([]);
    expect(diasDoIntervaloPura("xx", "2026-11-01")).toEqual([]);
  });
});

describe("serieDeCompraPura", () => {
  it("dia sem compra entra na série com zero — o buraco é informação", () => {
    const s = serieDeCompraPura([l("2026-11-01", 100), l("2026-11-03", 300)], "2026-11-01", "2026-11-03");
    expect(s.dias.map((d) => d.valor)).toEqual([100, 0, 300]);
    expect(s.diasComCompra).toBe(2);
  });

  it("soma as linhas do mesmo dia", () => {
    const s = serieDeCompraPura([l("2026-11-01", 100), l("2026-11-01", 50)], "2026-11-01", "2026-11-01");
    expect(s.dias[0]).toMatchObject({ valor: 150, linhas: 2 });
  });

  it("a altura é relativa ao maior dia", () => {
    const s = serieDeCompraPura([l("2026-11-01", 100), l("2026-11-02", 400)], "2026-11-01", "2026-11-02");
    expect(s.dias.map((d) => d.altura)).toEqual([0.25, 1]);
  });

  it("só um dia é o pico, mesmo com empate", () => {
    const s = serieDeCompraPura([l("2026-11-01", 500), l("2026-11-02", 500)], "2026-11-01", "2026-11-02");
    expect(s.dias.filter((d) => d.pico)).toHaveLength(1);
    expect(s.maior?.dia).toBe("2026-11-01");
  });

  it("a média é por dia COM compra, não por dia de calendário", () => {
    // 600 em 2 dias de compra, dentro de uma janela de 6 dias.
    const s = serieDeCompraPura([l("2026-11-01", 200), l("2026-11-05", 400)], "2026-11-01", "2026-11-06");
    expect(s.mediaPorDiaComCompra).toBe(300);
  });

  it("separa o enxuto do total", () => {
    const s = serieDeCompraPura(
      [l("2026-11-01", 100, true), l("2026-11-01", 40, false)],
      "2026-11-01",
      "2026-11-01"
    );
    expect(s.total).toBe(140);
    expect(s.enxuto).toBe(100);
  });

  it("marca fim de semana", () => {
    // 07/11/2026 é sábado, 08 é domingo, 09 é segunda.
    const s = serieDeCompraPura([], "2026-11-06", "2026-11-09");
    expect(s.dias.map((d) => d.fimDeSemana)).toEqual([false, true, true, false]);
  });

  it("janela sem compra nenhuma não quebra nem divide por zero", () => {
    const s = serieDeCompraPura([], "2026-11-01", "2026-11-03");
    expect(s).toMatchObject({ total: 0, mediaPorDiaComCompra: 0, maior: null });
    expect(s.dias.every((d) => d.altura === 0)).toBe(true);
  });

  it("linha fora da janela não entra na conta", () => {
    const s = serieDeCompraPura([l("2026-10-31", 999)], "2026-11-01", "2026-11-02");
    expect(s.total).toBe(0);
  });
});
