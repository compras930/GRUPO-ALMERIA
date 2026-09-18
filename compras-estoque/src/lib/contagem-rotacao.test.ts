import { describe, expect, it } from "vitest";
import { entraNaSemanaPura, gruposDaSemana, semanaDoMes } from "@/lib/contagem-rotacao";

describe("rodízio de contagem", () => {
  it("a curva A aparece duas vezes por mês e a B uma", () => {
    const itemA1 = { classeAbc: "A", grupoContagem: 1 };
    const itemB3 = { classeAbc: "B", grupoContagem: 3 };
    const semanasComA1 = [1, 2, 3, 4].filter((s) => entraNaSemanaPura(itemA1, s as 1 | 2 | 3 | 4));
    const semanasComB3 = [1, 2, 3, 4].filter((s) => entraNaSemanaPura(itemB3, s as 1 | 2 | 3 | 4));
    expect(semanasComA1).toEqual([1, 3]);
    expect(semanasComB3).toEqual([3]);
  });

  it("todo item da curva A e da B cai em alguma semana", () => {
    for (const grupo of [1, 2]) {
      const semanas = [1, 2, 3, 4].filter((s) => entraNaSemanaPura({ classeAbc: "A", grupoContagem: grupo }, s as any));
      expect(semanas.length).toBe(2);
    }
    for (const grupo of [1, 2, 3, 4]) {
      const semanas = [1, 2, 3, 4].filter((s) => entraNaSemanaPura({ classeAbc: "B", grupoContagem: grupo }, s as any));
      expect(semanas.length).toBe(1);
    }
  });

  it("curva C e produto sem classe ficam fora do rodízio", () => {
    expect(entraNaSemanaPura({ classeAbc: "C", grupoContagem: 1 }, 1)).toBe(false);
    expect(entraNaSemanaPura({ classeAbc: null, grupoContagem: null }, 1)).toBe(false);
  });

  it("semana do mês vai de 1 a 4 e o fim do mês não cria uma quinta", () => {
    expect(semanaDoMes(new Date("2026-09-01T12:00:00Z"))).toBe(1);
    expect(semanaDoMes(new Date("2026-09-07T12:00:00Z"))).toBe(1);
    expect(semanaDoMes(new Date("2026-09-08T12:00:00Z"))).toBe(2);
    expect(semanaDoMes(new Date("2026-09-22T12:00:00Z"))).toBe(4);
    // Dia 29 em diante cairia na "semana 5": sem o teto, o grupo 4 nunca seria
    // contado em mês de 31 dias e o grupo 1 seria contado três vezes.
    expect(semanaDoMes(new Date("2026-09-30T12:00:00Z"))).toBe(4);
    expect(semanaDoMes(new Date("2026-08-31T12:00:00Z"))).toBe(4);
  });

  it("os grupos da semana são os combinados", () => {
    expect(gruposDaSemana(1)).toEqual({ a: 1, b: 1 });
    expect(gruposDaSemana(3)).toEqual({ a: 1, b: 3 });
  });
});
