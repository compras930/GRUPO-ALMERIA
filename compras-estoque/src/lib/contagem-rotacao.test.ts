import { describe, expect, it } from "vitest";
import { entraNaSemanaPura, gruposDaSemana, semanaDoMes, GRUPO_TODA_SEMANA } from "@/lib/contagem-rotacao";

const semanasDe = (p: { classeAbc: string | null; grupoContagem: number | null }) =>
  [1, 2, 3, 4].filter((s) => entraNaSemanaPura(p, s as 1 | 2 | 3 | 4));

describe("rodízio de contagem — regra de 09/11/2026", () => {
  it("a curva A inteira entra TODA semana", () => {
    expect(semanasDe({ classeAbc: "A", grupoContagem: GRUPO_TODA_SEMANA })).toEqual([1, 2, 3, 4]);
  });

  it("a curva B cai em duas metades, uma a cada semana", () => {
    expect(semanasDe({ classeAbc: "B", grupoContagem: 1 })).toEqual([1, 3]);
    expect(semanasDe({ classeAbc: "B", grupoContagem: 2 })).toEqual([2, 4]);
  });

  it("A e B são contadas pelo menos duas vezes por mês — é o que a decisão pediu", () => {
    expect(semanasDe({ classeAbc: "A", grupoContagem: 0 }).length).toBeGreaterThanOrEqual(2);
    for (const grupo of [1, 2]) {
      expect(semanasDe({ classeAbc: "B", grupoContagem: grupo }).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("curva C e produto sem classe ficam fora do rodízio", () => {
    expect(entraNaSemanaPura({ classeAbc: "C", grupoContagem: 1 }, 1)).toBe(false);
    expect(entraNaSemanaPura({ classeAbc: null, grupoContagem: null }, 1)).toBe(false);
    // 0 é frequência, não promoção: zerar o grupo sem querer não pode colocar
    // um item de curva C na folha semanal.
    expect(semanasDe({ classeAbc: "C", grupoContagem: GRUPO_TODA_SEMANA })).toEqual([]);
  });

  it("os grupos da semana são os combinados", () => {
    expect(gruposDaSemana(1)).toEqual({ a: GRUPO_TODA_SEMANA, b: 1 });
    expect(gruposDaSemana(2)).toEqual({ a: GRUPO_TODA_SEMANA, b: 2 });
    expect(gruposDaSemana(3)).toEqual({ a: GRUPO_TODA_SEMANA, b: 1 });
    expect(gruposDaSemana(4)).toEqual({ a: GRUPO_TODA_SEMANA, b: 2 });
  });

  it("semana do mês vai de 1 a 4 e o fim do mês não cria uma quinta", () => {
    expect(semanaDoMes(new Date("2026-09-01T12:00:00Z"))).toBe(1);
    expect(semanaDoMes(new Date("2026-09-07T12:00:00Z"))).toBe(1);
    expect(semanaDoMes(new Date("2026-09-08T12:00:00Z"))).toBe(2);
    expect(semanaDoMes(new Date("2026-09-22T12:00:00Z"))).toBe(4);
    expect(semanaDoMes(new Date("2026-09-30T12:00:00Z"))).toBe(4);
    expect(semanaDoMes(new Date("2026-08-31T12:00:00Z"))).toBe(4);
  });
});

describe("herança do rodízio antigo — nada pode sumir da folha antes da reaplicação", () => {
  // Enquanto a curva ABC não for reaplicada em cada casa, o banco ainda tem a
  // curva A em grupos 1 e 2 e a B em 1 a 4. A folha de HOJE tem que funcionar
  // com esses valores: a decisão era "pra hoje".

  it("curva A gravada em grupo 1 ou 2 já entra toda semana", () => {
    expect(semanasDe({ classeAbc: "A", grupoContagem: 1 })).toEqual([1, 2, 3, 4]);
    expect(semanasDe({ classeAbc: "A", grupoContagem: 2 })).toEqual([1, 2, 3, 4]);
  });

  it("curva B em grupo 3 ou 4 vira a metade correspondente, em vez de nunca cair", () => {
    expect(semanasDe({ classeAbc: "B", grupoContagem: 3 })).toEqual([1, 3]);
    expect(semanasDe({ classeAbc: "B", grupoContagem: 4 })).toEqual([2, 4]);
  });

  it("curva B em grupo 0 (Beira Lago) continua entrando toda semana", () => {
    expect(semanasDe({ classeAbc: "B", grupoContagem: GRUPO_TODA_SEMANA })).toEqual([1, 2, 3, 4]);
  });
});
