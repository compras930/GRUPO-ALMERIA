import { describe, it, expect } from "vitest";
import { sobrepoePura, mensagemDeConflitoPura } from "@/lib/periodo-venda";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("sobrepoePura", () => {
  it("período idêntico se sobrepõe", () => {
    expect(sobrepoePura(d("2026-11-02"), d("2026-11-08"), d("2026-11-02"), d("2026-11-08"))).toBe(true);
  });

  it("semanas encostadas pela borda se sobrepõem — o dia em comum conta duas vezes", () => {
    // 02 a 08 e 08 a 15: o domingo 08 está nas duas.
    expect(sobrepoePura(d("2026-11-02"), d("2026-11-08"), d("2026-11-08"), d("2026-11-15"))).toBe(true);
  });

  it("semanas vizinhas de verdade não se sobrepõem", () => {
    expect(sobrepoePura(d("2026-11-02"), d("2026-11-08"), d("2026-11-09"), d("2026-11-15"))).toBe(false);
  });

  it("um dentro do outro se sobrepõe, nos dois sentidos", () => {
    const mes = [d("2026-10-01"), d("2026-10-31")] as const;
    const semana = [d("2026-10-12"), d("2026-10-18")] as const;
    expect(sobrepoePura(mes[0], mes[1], semana[0], semana[1])).toBe(true);
    expect(sobrepoePura(semana[0], semana[1], mes[0], mes[1])).toBe(true);
  });

  it("meses seguidos não se sobrepõem", () => {
    expect(sobrepoePura(d("2026-10-01"), d("2026-10-31"), d("2026-11-01"), d("2026-11-30"))).toBe(false);
  });

  it("um dia só, igual, se sobrepõe", () => {
    expect(sobrepoePura(d("2026-11-01"), d("2026-11-01"), d("2026-11-01"), d("2026-11-01"))).toBe(true);
  });
});

describe("mensagemDeConflitoPura", () => {
  it("período igual: diz que já existe", () => {
    const m = mensagemDeConflitoPura("Wine Garden", d("2026-11-02"), d("2026-11-08"), d("2026-11-02"), d("2026-11-08"));
    expect(m).toContain("Já existe uma venda semanal registrada");
    expect(m).toContain("02/11/2026 a 08/11/2026");
  });

  it("sobreposição: diz com qual período, e por que isso importa", () => {
    const m = mensagemDeConflitoPura("104 Sul", d("2026-11-05"), d("2026-11-12"), d("2026-11-02"), d("2026-11-08"));
    expect(m).toContain("se sobrepõe");
    expect(m).toContain("02/11/2026 a 08/11/2026");
    expect(m).toContain("duas vezes");
  });
});
