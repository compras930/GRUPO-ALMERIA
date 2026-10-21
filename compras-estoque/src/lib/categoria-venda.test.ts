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
  it("sobe tudo para MAIÚSCULA, que é a convenção da casa", () => {
    expect(categoriaCanonicaPura("Carnes")).toBe("CARNES");
    expect(categoriaCanonicaPura("Pescados")).toBe("PESCADOS");
    expect(categoriaCanonicaPura("Rosé")).toBe("ROSÉ");
    expect(categoriaCanonicaPura("Espumante")).toBe("ESPUMANTE");
  });

  it("resolve o plural, que a caixa sozinha não resolve", () => {
    // Subir a caixa de "Tintos" dá "TINTOS" e de "TINTO" dá "TINTO": duas
    // barras ainda. É esta a decisão que o mapa carrega.
    expect(categoriaCanonicaPura("TINTO")).toBe("TINTOS");
    expect(categoriaCanonicaPura("Tintos")).toBe("TINTOS");
    expect(categoriaCanonicaPura("BRANCO")).toBe("BRANCOS");
    expect(categoriaCanonicaPura("Brancos")).toBe("BRANCOS");
    expect(categoriaCanonicaPura("Entradas")).toBe("ENTRADAS");
    expect(categoriaCanonicaPura("SOBREMESA")).toBe("SOBREMESAS");
  });

  it("deixa quem já está certo em paz", () => {
    for (const nome of ["TINTOS", "BRANCOS", "ESPUMANTE", "ROSÉ", "ENTRADAS", "PRINCIPAIS"]) {
      expect(categoriaCanonicaPura(nome)).toBe(nome);
    }
  });

  it("é idempotente: aplicar duas vezes dá o mesmo", () => {
    const uma = categoriaCanonicaPura("TINTO");
    expect(categoriaCanonicaPura(uma)).toBe(uma);
  });

  it("não inventa plural para quem não está no mapa", () => {
    // Pluralizar por conta própria criaria "TAXASS", "CAFÉSS" ou coisa pior.
    // Fora do mapa, a única coisa que acontece é subir a caixa.
    expect(categoriaCanonicaPura("TAXAS")).toBe("TAXAS");
    expect(categoriaCanonicaPura("CAFÉS")).toBe("CAFÉS");
    expect(categoriaCanonicaPura("Antipasti")).toBe("ANTIPASTI");
    expect(categoriaCanonicaPura("SERVICOS")).toBe("SERVICOS");
  });

  it("devolve null para vazio, em vez de uma sexta forma de dizer 'sem categoria'", () => {
    expect(categoriaCanonicaPura("")).toBe(null);
    expect(categoriaCanonicaPura("   ")).toBe(null);
    expect(categoriaCanonicaPura(null)).toBe(null);
    expect(categoriaCanonicaPura(undefined)).toBe(null);
  });

  it("apara espaço de sobra do export", () => {
    expect(categoriaCanonicaPura("  TINTO  ")).toBe("TINTOS");
    expect(categoriaCanonicaPura("  Massas  ")).toBe("MASSAS");
  });
});

describe("ehCategoriaDeEventoPura", () => {
  it("reconhece as quatro categorias de evento", () => {
    for (const c of ["EVENTOS · MENU", "EVENTOS · BEBIDAS", "Eventos · Serviços", "EVENTOS · VINHOS"]) {
      expect(ehCategoriaDeEventoPura(c)).toBe(true);
    }
  });

  it("não confunde com a venda do salão", () => {
    for (const c of ["TINTOS", "BRANCOS", "ENTRADAS", "PRINCIPAIS", "BEBIDAS", "MENU", null, ""]) {
      expect(ehCategoriaDeEventoPura(c), String(c)).toBe(false);
    }
  });
});
