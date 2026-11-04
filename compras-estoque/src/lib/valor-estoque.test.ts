import { describe, it, expect } from "vitest";
import { valorizarEstoquePura, type SaldoParaValorizar } from "@/lib/valor-estoque";

const s = (
  nome: string,
  quantidade: number,
  preco: number | null,
  categoria: string | null = "MERCEARIA"
): SaldoParaValorizar => ({
  produtoId: nome,
  nome,
  unidadeMedida: "KG",
  categoria,
  quantidade,
  preco,
});

describe("valorizarEstoquePura", () => {
  it("soma quantidade x preço", () => {
    const r = valorizarEstoquePura([s("ARROZ", 10, 5), s("FEIJAO", 4, 12.5)]);
    expect(r.total).toBeCloseTo(100);
    expect(r.itensValorizados).toBe(2);
  });

  it("produto sem preço fica FORA do total e aparece na lista", () => {
    const r = valorizarEstoquePura([s("ARROZ", 10, 5), s("COMINHO", 2, null)]);
    expect(r.total).toBeCloseTo(50);
    expect(r.itensValorizados).toBe(1);
    expect(r.semPreco.map((i) => i.nome)).toEqual(["COMINHO"]);
  });

  it("preço zero conta como sem preço — zero não é 'de graça'", () => {
    const r = valorizarEstoquePura([s("AGUA", 100, 0)]);
    expect(r.total).toBe(0);
    expect(r.semPreco.map((i) => i.nome)).toEqual(["AGUA"]);
  });

  it("saldo negativo não abate o total", () => {
    const r = valorizarEstoquePura([s("ARROZ", 10, 5), s("ALHO", -3, 20)]);
    expect(r.total).toBeCloseTo(50);
    expect(r.negativos.map((i) => i.nome)).toEqual(["ALHO"]);
    expect(r.itensValorizados).toBe(1);
  });

  it("negativo de arredondamento não vira problema", () => {
    const r = valorizarEstoquePura([s("ARROZ", -0.0000001, 5)]);
    expect(r.negativos).toHaveLength(0);
    expect(r.total).toBe(0);
  });

  it("saldo zero não entra em lugar nenhum", () => {
    const r = valorizarEstoquePura([s("ARROZ", 0, 5)]);
    expect(r.total).toBe(0);
    expect(r.semPreco).toHaveLength(0);
    expect(r.negativos).toHaveLength(0);
    expect(r.porCategoria).toHaveLength(0);
  });

  it("agrupa por categoria, da maior para a menor", () => {
    const r = valorizarEstoquePura([
      s("VINHO", 10, 100, "VINHOS"),
      s("ARROZ", 10, 5, "MERCEARIA"),
      s("CARNE", 10, 50, "PROTEINAS"),
    ]);
    expect(r.porCategoria.map((c) => c.categoria)).toEqual(["VINHOS", "PROTEINAS", "MERCEARIA"]);
    expect(r.porCategoria[0].valor).toBeCloseTo(1000);
  });

  it("categoria vazia vira nula, não string em branco", () => {
    const r = valorizarEstoquePura([s("X", 1, 10, "   ")]);
    expect(r.porCategoria[0].categoria).toBeNull();
  });

  it("maisCaros vem do maior valor parado, não da maior quantidade", () => {
    const r = valorizarEstoquePura([s("SAL", 1000, 1), s("TRUFA", 1, 5000)]);
    expect(r.maisCaros.map((i) => i.nome)).toEqual(["TRUFA", "SAL"]);
  });

  it("estoque vazio devolve zero sem quebrar", () => {
    const r = valorizarEstoquePura([]);
    expect(r).toMatchObject({ total: 0, itensValorizados: 0 });
    expect(r.porCategoria).toHaveLength(0);
  });
});
