import { describe, it, expect } from "vitest";
import { PAPEIS } from "@/lib/constants";
import { exigeUnidade, unidadeVisivel, podeVerPedidos } from "@/lib/permissions";

describe("exigeUnidade", () => {
  it("dispensa só o ADMIN", () => {
    expect(exigeUnidade("ADMIN")).toBe(false);
    for (const papel of PAPEIS.filter((p) => p !== "ADMIN")) {
      expect(exigeUnidade(papel), papel).toBe(true);
    }
  });

  it("cobre todo papel que existir, sem lista repetida", () => {
    // Papel novo entra nesta regra por omissão: se um dia aparecer outro que
    // possa ficar sem casa, é aqui que o teste quebra e obriga a decidir.
    for (const papel of PAPEIS) {
      expect(exigeUnidade(papel)).toBe(papel !== "ADMIN");
    }
  });
});

describe("unidadeVisivel", () => {
  it("deixa o ADMIN ver qualquer casa, inclusive sem casa própria", () => {
    expect(unidadeVisivel("ADMIN", null, "beira-lago")).toBe(true);
    expect(unidadeVisivel("ADMIN", "wine-garden", "beira-lago")).toBe(true);
  });

  it("prende o gerente na própria casa", () => {
    expect(unidadeVisivel("GERENTE", "beira-lago", "beira-lago")).toBe(true);
    expect(unidadeVisivel("GERENTE", "beira-lago", "wine-garden")).toBe(false);
  });

  it("nega tudo pra não-admin sem casa, em vez de liberar", () => {
    // O contrário disto é o vazamento que `exigeUnidade` existe pra impedir:
    // nulo não pode significar "todas".
    expect(unidadeVisivel("GERENTE", null, "beira-lago")).toBe(false);
  });
});

describe("podeVerPedidos", () => {
  it("esconde pedido do gerente e mostra pro resto", () => {
    expect(podeVerPedidos("GERENTE")).toBe(false);
    for (const papel of PAPEIS.filter((p) => p !== "GERENTE")) {
      expect(podeVerPedidos(papel), papel).toBe(true);
    }
  });
});
