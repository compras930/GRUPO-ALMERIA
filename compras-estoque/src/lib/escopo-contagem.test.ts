import { describe, it, expect } from "vitest";
import { ehContavel } from "@/lib/escopo-contagem";

describe("o que entra na folha de contagem", () => {
  it("insumo entra, nos dois vocabulários", () => {
    for (const c of ["MATERIA PRIMA", "BEBIDAS", "MERCEARIA", "PROTEINAS", "VINHOS", "HORTIFRUTIGRANJEIRO"]) {
      expect(ehContavel(c), c).toBe(true);
    }
  });

  it("o que não fica na prateleira fica de fora", () => {
    for (const c of ["ATIVO IMOBILIZADO", "TAXAS", "SERVIÇOS", "UTILIDADE PÚBLICA", "MANUTENÇÃO"]) {
      expect(ehContavel(c), c).toBe(false);
    }
  });

  it("ignora acento, caixa e espaço — a categoria é texto livre", () => {
    expect(ehContavel("ativo imobilizado")).toBe(false);
    expect(ehContavel("  Ativo   Imobilizado ")).toBe(false);
    expect(ehContavel("SERVIÇOS")).toBe(false);
  });

  it("descartável, limpeza e refeição de funcionário CONTINUAM entrando", () => {
    // Não viram prato vendido (ficam fora do CMV enxuto), mas ficam na
    // prateleira e somem de lá — então são contáveis.
    for (const c of ["DESCARTAVEIS", "LIMPEZA", "EMBALAGENS", "ALIMENTAÇÃO FUNCIONÁRIO"]) {
      expect(ehContavel(c), c).toBe(true);
    }
  });

  it("sem categoria ENTRA: cadastro incompleto não é motivo para parar de medir", () => {
    expect(ehContavel(null)).toBe(true);
    expect(ehContavel("")).toBe(true);
    expect(ehContavel(undefined)).toBe(true);
  });

  it("categoria nova e desconhecida entra — a régua é por exclusão", () => {
    expect(ehContavel("CATEGORIA QUE NINGUEM VIU AINDA")).toBe(true);
  });
});
