import { describe, it, expect } from "vitest";
import { ehEnxuto } from "@/lib/escopo-cmv";

describe("ehEnxuto", () => {
  it("matéria-prima, bebidas e vinhos entram", () => {
    for (const c of ["MATERIA PRIMA", "BEBIDAS", "VINHOS"]) expect(ehEnxuto(c)).toBe(true);
  });

  it("o resto fica de fora", () => {
    for (const c of ["HIGIENE E LIMPEZA", "DESCARTÁVEIS E EMBALAGENS", "ALIMENTAÇÃO FUNCIONÁRIO", "EVENTOS"]) {
      expect(ehEnxuto(c)).toBe(false);
    }
  });

  it("acento e caixa não tiram um insumo do CMV", () => {
    // A categoria é texto livre: vem do grupo do XMenu em uns produtos e de
    // cadastro à mão em outros.
    for (const c of ["Matéria Prima", "matéria prima", "  MATÉRIA   PRIMA ", "Bebidas"]) {
      expect(ehEnxuto(c)).toBe(true);
    }
  });

  it("sem categoria NÃO é enxuto", () => {
    // Cadastro faltando não pode entrar calado no número da diretoria.
    expect(ehEnxuto(null)).toBe(false);
    expect(ehEnxuto("")).toBe(false);
    expect(ehEnxuto("   ")).toBe(false);
  });

  it("nome parecido não cola", () => {
    expect(ehEnxuto("MATERIA PRIMA FUNCIONARIO")).toBe(false);
    expect(ehEnxuto("BEBIDAS - EVENTOS")).toBe(false);
  });
});
