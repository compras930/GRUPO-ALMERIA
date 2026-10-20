import { describe, it, expect } from "vitest";
import { curvaAbcPura, resumoAbcPura, type ItemAbc } from "@/lib/curva-abc";

const item = (nome: string, valor: number): ItemAbc => ({
  id: nome,
  nome,
  unidadeMedida: "KG",
  categoria: "MATERIA PRIMA",
  valor,
});

describe("curvaAbcPura", () => {
  it("ordena por valor e acumula até 100%", () => {
    const r = curvaAbcPura([item("b", 20), item("a", 70), item("c", 10)]);
    expect(r.map((x) => x.nome)).toEqual(["a", "b", "c"]);
    expect(r.map((x) => x.posicao)).toEqual([1, 2, 3]);
    expect(r[0].pct).toBeCloseTo(70, 6);
    expect(r[2].acumulado).toBeCloseTo(100, 6);
  });

  it("o item que CRUZA os 80% fica em A, não em B", () => {
    // 70 + 20 = 90: o segundo item atravessa a linha dos 80%. Ele é o item que
    // FECHA os 80%; deixá-lo em B tiraria da curva A justamente quem a
    // completa.
    const r = curvaAbcPura([item("a", 70), item("b", 20), item("c", 10)]);
    expect(r[0].classe).toBe("A");
    expect(r[1].classe).toBe("A");
    expect(r[1].acumulado).toBeCloseTo(90, 6);
    expect(r[2].classe).toBe("B");
  });

  it("separa A, B e C pelos cortes de 80 e 95", () => {
    // 100 itens de 1 real: o acumulado anda de 1 em 1 ponto.
    const r = curvaAbcPura(Array.from({ length: 100 }, (_, n) => item(`p${String(n).padStart(3, "0")}`, 1)));
    expect(r.filter((x) => x.classe === "A")).toHaveLength(80);
    expect(r.filter((x) => x.classe === "B")).toHaveLength(15);
    expect(r.filter((x) => x.classe === "C")).toHaveLength(5);
  });

  it("empate não faz a lista dançar entre carregamentos", () => {
    const uma = curvaAbcPura([item("zebra", 10), item("abacaxi", 10)]);
    const outra = curvaAbcPura([item("abacaxi", 10), item("zebra", 10)]);
    expect(uma.map((x) => x.nome)).toEqual(outra.map((x) => x.nome));
    expect(uma[0].nome).toBe("abacaxi");
  });

  it("valor zero ou negativo fica de fora, e total zero não vira NaN", () => {
    // Devolução e linha sem valor não têm lugar numa curva de participação:
    // um negativo faria o acumulado andar pra trás.
    const r = curvaAbcPura([item("a", 10), item("b", 0), item("c", -5)]);
    expect(r).toHaveLength(1);
    expect(curvaAbcPura([])).toEqual([]);
    expect(curvaAbcPura([item("a", 0)])).toEqual([]);
  });

  it("resumoAbcPura fecha com o todo", () => {
    const r = curvaAbcPura([item("a", 70), item("b", 20), item("c", 10)]);
    const resumo = resumoAbcPura(r);
    expect(resumo.reduce((s, x) => s + x.itens, 0)).toBe(3);
    expect(resumo.reduce((s, x) => s + x.valor, 0)).toBeCloseTo(100, 6);
    expect(resumo.reduce((s, x) => s + x.pct, 0)).toBeCloseTo(100, 6);
  });
});
