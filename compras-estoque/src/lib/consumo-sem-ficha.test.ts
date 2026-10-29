import { describe, it, expect } from "vitest";
import { quebrarFaltaPura, filaDeFichasPura, type VendaSemFichaResumo } from "@/lib/consumo-sem-ficha";

const venda = (
  nome: string,
  faturamento: number,
  ehEvento = false
): VendaSemFichaResumo => ({
  itemVendaId: nome,
  nome,
  categoria: ehEvento ? "EVENTOS · MENU" : "PRINCIPAIS",
  quantidadeVendida: 1,
  faturamento,
  ehEvento,
});

describe("quebrarFaltaPura", () => {
  it("estima pelo CMV e separa evento de prato", () => {
    const r = quebrarFaltaPura(10_000, [venda("FILETTO", 20_000), venda("EVT-MENU", 10_000, true)], 20);
    expect(r.pratosSemFichaEmReais).toBeCloseTo(4_000);
    expect(r.eventosEmReais).toBeCloseTo(2_000);
    expect(r.perdaEmReais).toBeCloseTo(4_000);
    expect(r.cortadaNoTeto).toBe(false);
    expect(r.cmvUsadoPct).toBe(20);
  });

  it("a soma das três partes é sempre a falta", () => {
    const r = quebrarFaltaPura(7_777, [venda("A", 12_345), venda("B", 6_789, true)], 23.4);
    expect(r.eventosEmReais + r.pratosSemFichaEmReais + r.perdaEmReais).toBeCloseTo(7_777);
  });

  it("corta no teto em vez de deixar a perda negativa", () => {
    // R$ 100 mil de venda sem ficha a 20% estimaria R$ 20 mil de consumo, mas
    // a prateleira só acusa R$ 5 mil de falta.
    const r = quebrarFaltaPura(5_000, [venda("A", 60_000), venda("EVT", 40_000, true)], 20);
    expect(r.cortadaNoTeto).toBe(true);
    expect(r.perdaEmReais).toBe(0);
    expect(r.eventosEmReais + r.pratosSemFichaEmReais).toBeCloseTo(5_000);
    // A razão 60/40 entre prato e evento é preservada no corte.
    expect(r.pratosSemFichaEmReais).toBeCloseTo(3_000);
    expect(r.eventosEmReais).toBeCloseTo(2_000);
  });

  it("sem CMV não estima nada — a falta inteira fica como perda", () => {
    for (const cmv of [null, 0, -3]) {
      const r = quebrarFaltaPura(9_000, [venda("A", 50_000)], cmv);
      expect(r.perdaEmReais).toBe(9_000);
      expect(r.pratosSemFichaEmReais).toBe(0);
      expect(r.cmvUsadoPct).toBeNull();
    }
  });

  it("sobra (falta <= 0) não se reparte", () => {
    for (const falta of [0, -1_200]) {
      const r = quebrarFaltaPura(falta, [venda("A", 50_000)], 20);
      expect(r).toMatchObject({ eventosEmReais: 0, pratosSemFichaEmReais: 0, perdaEmReais: 0 });
    }
  });

  it("sem venda sem ficha, a falta inteira é perda", () => {
    const r = quebrarFaltaPura(3_000, [], 20);
    expect(r.perdaEmReais).toBe(3_000);
    expect(r.cortadaNoTeto).toBe(false);
  });

  it("faturamento negativo (estorno) não vira crédito de consumo", () => {
    const r = quebrarFaltaPura(1_000, [venda("A", -5_000), venda("B", 1_000)], 20);
    expect(r.pratosSemFichaEmReais).toBeCloseTo(200);
  });
});

describe("filaDeFichasPura", () => {
  it("ordena por faturamento e deixa evento de fora", () => {
    const r = filaDeFichasPura([
      venda("BARATO", 100),
      venda("EVT-MENU", 900_000, true),
      venda("CARO", 5_000),
    ]);
    expect(r.map((v) => v.nome)).toEqual(["CARO", "BARATO"]);
  });

  it("desempata por nome, para a lista não dançar entre cargas", () => {
    const r = filaDeFichasPura([venda("ZEBRA", 100), venda("ABACAXI", 100)]);
    expect(r.map((v) => v.nome)).toEqual(["ABACAXI", "ZEBRA"]);
  });

  it("ignora quem não faturou", () => {
    expect(filaDeFichasPura([venda("ZERO", 0)])).toHaveLength(0);
  });
});
