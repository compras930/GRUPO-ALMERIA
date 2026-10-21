import { describe, it, expect } from "vitest";
import { categoriaCanonicaPura, chaveCategoria, ehCategoriaDeEventoPura } from "@/lib/categoria-venda";

describe("chaveCategoria", () => {
  it("junta o que só difere em caixa, acento ou plural", () => {
    expect(chaveCategoria("TINTO")).toBe(chaveCategoria("Tintos"));
    expect(chaveCategoria("ROSÉ")).toBe(chaveCategoria("Rosé"));
    expect(chaveCategoria("ENTRADAS")).toBe(chaveCategoria("Entradas"));
    expect(chaveCategoria("  Brancos ")).toBe(chaveCategoria("BRANCO"));
  });

  it("não junta categorias que são de fato diferentes", () => {
    expect(chaveCategoria("Tintos")).not.toBe(chaveCategoria("Brancos"));
    expect(chaveCategoria("Massas")).not.toBe(chaveCategoria("Pescados"));
  });
});

describe("categoriaCanonicaPura", () => {
  it("traz os cinco pares do painel para a grafia do cadastro antigo", () => {
    expect(categoriaCanonicaPura("TINTO")).toBe("Tintos");
    expect(categoriaCanonicaPura("BRANCO")).toBe("Brancos");
    expect(categoriaCanonicaPura("ESPUMANTE")).toBe("Espumante");
    expect(categoriaCanonicaPura("ROSÉ")).toBe("Rosé");
    expect(categoriaCanonicaPura("ENTRADAS")).toBe("Entradas");
  });

  it("deixa quem já está certo em paz", () => {
    for (const nome of ["Tintos", "Brancos", "Espumante", "Rosé", "Entradas"]) {
      expect(categoriaCanonicaPura(nome)).toBe(nome);
    }
  });

  it("é idempotente: aplicar duas vezes dá o mesmo", () => {
    const uma = categoriaCanonicaPura("TINTO");
    expect(categoriaCanonicaPura(uma)).toBe(uma);
  });

  it("NÃO inventa grafia para categoria sem par conhecido", () => {
    // Capitalizar por conta própria criaria "Servicos", "Taxas", "Não
    // alcoólicas" — nomes novos que não casam com nada já gravado. Seria criar
    // a segunda convenção em vez de eliminá-la.
    for (const nome of ["SERVICOS", "TAXAS", "MENU", "PRINCIPAIS", "NÃO ALCOÓLICAS"]) {
      expect(categoriaCanonicaPura(nome)).toBe(nome);
    }
  });

  it("devolve null para vazio, em vez de uma sexta forma de dizer 'sem categoria'", () => {
    expect(categoriaCanonicaPura("")).toBe(null);
    expect(categoriaCanonicaPura("   ")).toBe(null);
    expect(categoriaCanonicaPura(null)).toBe(null);
    expect(categoriaCanonicaPura(undefined)).toBe(null);
  });

  it("apara espaço de sobra do export", () => {
    expect(categoriaCanonicaPura("  TINTO  ")).toBe("Tintos");
    expect(categoriaCanonicaPura("  Massas  ")).toBe("Massas");
  });
});

describe("ehCategoriaDeEventoPura", () => {
  it("reconhece as quatro categorias de evento", () => {
    for (const c of ["Eventos · Menu", "Eventos · Bebidas", "Eventos · Serviços", "Eventos · Vinhos"]) {
      expect(ehCategoriaDeEventoPura(c)).toBe(true);
    }
  });

  it("não confunde com a venda do salão", () => {
    for (const c of ["Tintos", "Brancos", "Entradas", "PRINCIPAIS", "BEBIDAS", "MENU", null, ""]) {
      expect(ehCategoriaDeEventoPura(c), String(c)).toBe(false);
    }
  });
});
