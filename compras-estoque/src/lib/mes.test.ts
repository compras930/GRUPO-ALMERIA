import { describe, it, expect } from "vitest";
import { mesDe, mesDaChave, mesDaData, ultimosMeses, rotuloCurto } from "@/lib/mes";

describe("mesDe", () => {
  it("vai da meia-noite UTC do dia 1 à meia-noite UTC do 1º do mês seguinte", () => {
    const m = mesDe(2026, 8);
    expect(m.inicio.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(m.fim.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(m.chave).toBe("2026-08");
    expect(m.rotulo).toBe("agosto de 2026");
  });

  it("vira o ano em dezembro", () => {
    expect(mesDe(2026, 12).fim.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("pega fevereiro bissexto sem ajuda", () => {
    expect(mesDe(2028, 2).fim.toISOString()).toBe("2028-03-01T00:00:00.000Z");
  });

  it("a compra do dia 1 e a do último dia ficam DENTRO", () => {
    // É o erro de um dia em cada ponta que some sem ninguém ver.
    const m = mesDe(2026, 8);
    const primeira = new Date("2026-08-01T00:00:00.000Z");
    const ultima = new Date("2026-08-31T00:00:00.000Z");
    expect(primeira >= m.inicio && primeira < m.fim).toBe(true);
    expect(ultima >= m.inicio && ultima < m.fim).toBe(true);
    expect(new Date("2026-09-01T00:00:00.000Z") < m.fim).toBe(false);
  });
});

describe("mesDaChave", () => {
  it("lê o formato certo", () => {
    expect(mesDaChave("2026-08")?.chave).toBe("2026-08");
  });

  it("devolve null em vez de palpite", () => {
    for (const ruim of ["", "2026", "2026-13", "2026-00", "agosto", "26-08", undefined, null]) {
      expect(mesDaChave(ruim as string)).toBeNull();
    }
  });
});

describe("ultimosMeses", () => {
  it("volta do mais novo ao mais velho, atravessando o ano", () => {
    const m = ultimosMeses(new Date("2026-02-10T00:00:00.000Z"), 4);
    expect(m.map((x) => x.chave)).toEqual(["2026-02", "2026-01", "2025-12", "2025-11"]);
  });

  it("o primeiro é o mês da data dada", () => {
    expect(mesDaData(new Date("2026-10-20T23:59:00.000Z")).chave).toBe("2026-10");
    expect(ultimosMeses(new Date("2026-10-20T00:00:00.000Z"), 1)[0].chave).toBe("2026-10");
  });

  it("rótulo curto cabe num chip", () => {
    expect(rotuloCurto(mesDe(2026, 8))).toBe("ago/26");
    expect(rotuloCurto(mesDe(2026, 3))).toBe("mar/26");
  });
});
