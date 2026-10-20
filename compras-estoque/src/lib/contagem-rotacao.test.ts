import { describe, expect, it } from "vitest";
import { entraNaSemanaPura, gruposDaSemana, semanaDoMes, GRUPO_TODA_SEMANA } from "@/lib/contagem-rotacao";

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

describe("grupo 0 — contagem toda semana", () => {
  // O Beira Lago quer CMV SEMANAL, e consumo só existe entre duas contagens do
  // MESMO item. Com o rodízio de dois grupos, um item da curva A fecha período
  // de quinze em quinze dias — o que dá CMV quinzenal, não semanal.
  const todasAsSemanas = (p: { classeAbc: string | null; grupoContagem: number | null }) =>
    [1, 2, 3, 4].filter((s) => entraNaSemanaPura(p, s as 1 | 2 | 3 | 4));

  it("curva A no grupo 0 entra nas quatro semanas", () => {
    expect(todasAsSemanas({ classeAbc: "A", grupoContagem: GRUPO_TODA_SEMANA })).toEqual([1, 2, 3, 4]);
  });

  it("curva B no grupo 0 também", () => {
    expect(todasAsSemanas({ classeAbc: "B", grupoContagem: GRUPO_TODA_SEMANA })).toEqual([1, 2, 3, 4]);
  });

  it("NÃO muda o rodízio de quem usa 1 e 2 — é o 104 Sul que não pode quebrar", () => {
    expect(todasAsSemanas({ classeAbc: "A", grupoContagem: 1 })).toEqual([1, 3]);
    expect(todasAsSemanas({ classeAbc: "A", grupoContagem: 2 })).toEqual([2, 4]);
    expect(todasAsSemanas({ classeAbc: "B", grupoContagem: 4 })).toEqual([4]);
  });

  it("grupo 0 na curva C continua fora: 0 é frequência, não promoção", () => {
    // Senão, zerar o grupo de um item sem querer o colocaria na folha semanal.
    expect(todasAsSemanas({ classeAbc: "C", grupoContagem: GRUPO_TODA_SEMANA })).toEqual([]);
    expect(todasAsSemanas({ classeAbc: null, grupoContagem: GRUPO_TODA_SEMANA })).toEqual([]);
  });
});
