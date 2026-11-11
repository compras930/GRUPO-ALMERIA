import { describe, it, expect } from "vitest";
import {
  consumoPorPeriodoPuro,
  cmvSemanalPuro,
  segundaDaDataPura,
  type ContagemDoProduto,
} from "@/lib/cmv-semanal";

const c = (produtoId: string, quantidade: number, iso: string): ContagemDoProduto => ({
  produtoId,
  quantidade,
  em: new Date(iso),
});

describe("consumo de cada período fechado", () => {
  it("duas contagens, um período: inicial + entradas − final", () => {
    const r = consumoPorPeriodoPuro(
      [c("x", 10, "2026-11-09T12:00:00Z"), c("x", 4, "2026-11-16T12:00:00Z")],
      [{ produtoId: "x", quantidade: 6, em: new Date("2026-11-11T10:00:00Z") }]
    );
    expect(r).toHaveLength(1);
    expect(r[0].quantidade).toBe(12); // 10 + 6 − 4
  });

  it("três contagens dão DUAS semanas — é a série, não só a última", () => {
    const r = consumoPorPeriodoPuro(
      [
        c("x", 10, "2026-11-02T12:00:00Z"),
        c("x", 6, "2026-11-09T12:00:00Z"),
        c("x", 1, "2026-11-16T12:00:00Z"),
      ],
      []
    );
    expect(r.map((p) => p.quantidade)).toEqual([4, 5]);
  });

  it("produto contado uma vez só não tem período fechado", () => {
    expect(consumoPorPeriodoPuro([c("x", 10, "2026-11-09T12:00:00Z")], [])).toEqual([]);
  });

  it("entrada no instante da contagem inicial não é contada duas vezes", () => {
    // A contagem é o que a prateleira TINHA: o que chegou naquele instante já
    // está nela. Contar de novo inflaria o consumo.
    const r = consumoPorPeriodoPuro(
      [c("x", 10, "2026-11-09T12:00:00Z"), c("x", 10, "2026-11-16T12:00:00Z")],
      [{ produtoId: "x", quantidade: 5, em: new Date("2026-11-09T12:00:00Z") }]
    );
    expect(r[0].quantidade).toBe(0);
  });

  it("marca o consumo negativo em vez de escondê-lo", () => {
    const r = consumoPorPeriodoPuro(
      [c("x", 1, "2026-11-09T12:00:00Z"), c("x", 9, "2026-11-16T12:00:00Z")],
      []
    );
    expect(r[0].quantidade).toBe(-8);
    expect(r[0].negativo).toBe(true);
  });
});

describe("a semana do CMV", () => {
  it("é a da contagem que ABRIU o período, não a que fechou", () => {
    // Contagem de segunda 09/11 a segunda 16/11 = a semana de 09/11: é nela
    // que a mercadoria saiu, e é com a venda dela que se compara.
    expect(segundaDaDataPura(new Date("2026-11-09T12:00:00Z"))).toBe("2026-11-09");
    expect(segundaDaDataPura(new Date("2026-11-15T12:00:00Z"))).toBe("2026-11-09");
    expect(segundaDaDataPura(new Date("2026-11-16T12:00:00Z"))).toBe("2026-11-16");
  });

  it("usa o fuso de Brasília: 21h de domingo ainda é a semana que termina", () => {
    expect(segundaDaDataPura(new Date("2026-11-16T00:30:00Z"))).toBe("2026-11-09");
  });
});

describe("a linha de cada semana", () => {
  const base = {
    consumos: consumoPorPeriodoPuro(
      [
        c("carne", 10, "2026-11-09T12:00:00Z"),
        c("carne", 2, "2026-11-16T12:00:00Z"),
        c("vinho", 5, "2026-11-09T12:00:00Z"),
        c("vinho", 3, "2026-11-16T12:00:00Z"),
      ],
      []
    ),
    precoPorProduto: new Map([
      ["carne", 50],
      ["vinho", 100],
    ]),
    vendaPorSemana: new Map([["2026-11-09", 2000]]),
    compraPorSemana: new Map([["2026-11-09", 1000]]),
    compraContadaPorSemana: new Map([["2026-11-09", 800]]),
  };

  it("soma o consumo em reais e divide pela venda da MESMA semana", () => {
    const [s] = cmvSemanalPuro(base);
    expect(s.consumo).toBe(600); // 8 carne × 50 + 2 vinho × 100
    expect(s.cmv).toBeCloseTo(0.3);
    expect(s.itens).toBe(2);
  });

  it("diz a cobertura, porque CMV sobre parte do estoque não é o CMV", () => {
    const [s] = cmvSemanalPuro(base);
    expect(s.cobertura).toBeCloseTo(0.8);
  });

  it("sem venda carregada não inventa CMV", () => {
    const [s] = cmvSemanalPuro({ ...base, vendaPorSemana: new Map() });
    expect(s.cmv).toBeNull();
    expect(s.consumo).toBe(600); // o consumo continua lá: ele existe
  });

  it("consumo negativo entra como zero no dinheiro, e é contado à parte", () => {
    const consumos = consumoPorPeriodoPuro(
      [
        c("carne", 10, "2026-11-09T12:00:00Z"),
        c("carne", 2, "2026-11-16T12:00:00Z"),
        c("sumiu", 1, "2026-11-09T12:00:00Z"),
        c("sumiu", 9, "2026-11-16T12:00:00Z"), // contaram mais do que podia existir
      ],
      []
    );
    const [s] = cmvSemanalPuro({ ...base, consumos, precoPorProduto: new Map([["carne", 50], ["sumiu", 100]]) });
    expect(s.consumo).toBe(400); // só a carne; o negativo não abate nada
    expect(s.negativos).toBe(1);
  });

  it("semana com venda e sem contagem aparece, com CMV nulo", () => {
    const r = cmvSemanalPuro({
      ...base,
      vendaPorSemana: new Map([["2026-11-09", 2000], ["2026-11-02", 1500]]),
    });
    expect(r.map((x) => x.semana)).toEqual(["2026-11-09", "2026-11-02"]); // mais recente primeiro
    expect(r[1].cmv).toBeNull();
    expect(r[1].venda).toBe(1500);
  });
});
