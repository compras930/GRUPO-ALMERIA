import { describe, it, expect } from "vitest";
import { totaisPorCategoriaPura, SEM_CATEGORIA } from "@/lib/painel-categoria";

describe("totaisPorCategoriaPura", () => {
  it("soma por categoria e ordena do maior pro menor", () => {
    const r = totaisPorCategoriaPura([
      { categoria: "BEBIDAS", valor: 100 },
      { categoria: "MATERIA PRIMA", valor: 300 },
      { categoria: "BEBIDAS", valor: 100 },
    ]);
    expect(r.map((x) => x.categoria)).toEqual(["MATERIA PRIMA", "BEBIDAS"]);
    expect(r[0].valor).toBe(300);
    expect(r[1].valor).toBe(200);
    expect(r[0].pct).toBeCloseTo(60, 6);
    expect(r[1].pct).toBeCloseTo(40, 6);
  });

  it("produto sem categoria vira uma LINHA, não some do total", () => {
    // Se descartasse, o painel mostraria R$ 100 numa compra de R$ 400 — e
    // ninguém olha um painel duas vezes depois de ver isso.
    const r = totaisPorCategoriaPura([
      { categoria: "VINHOS", valor: 100 },
      { categoria: null, valor: 300 },
    ]);
    expect(r.reduce((s, x) => s + x.valor, 0)).toBe(400);
    expect(r.find((x) => x.categoria === SEM_CATEGORIA)?.valor).toBe(300);
  });

  it("'Sem categoria' fica por último mesmo sendo a maior", () => {
    const r = totaisPorCategoriaPura([
      { categoria: null, valor: 1000 },
      { categoria: "VINHOS", valor: 10 },
      { categoria: "BEBIDAS", valor: 5 },
    ]);
    expect(r.map((x) => x.categoria)).toEqual(["VINHOS", "BEBIDAS", SEM_CATEGORIA]);
  });

  it("categoria só com espaço conta como sem categoria", () => {
    const r = totaisPorCategoriaPura([
      { categoria: "   ", valor: 10 },
      { categoria: null, valor: 5 },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].categoria).toBe(SEM_CATEGORIA);
    expect(r[0].valor).toBe(15);
  });

  it("lista vazia não vira NaN", () => {
    expect(totaisPorCategoriaPura([])).toEqual([]);
    const zerado = totaisPorCategoriaPura([{ categoria: "X", valor: 0 }]);
    expect(zerado[0].pct).toBe(0);
  });
});
