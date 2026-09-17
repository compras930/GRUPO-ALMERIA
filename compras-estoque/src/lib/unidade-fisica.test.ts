import { describe, it, expect } from "vitest";
import { resolverUnidadeFisicaPura, type MapaEstoque } from "./unidade-fisica";

// Noroeste guarda a despensa; Matri é a outra casa da mesma cozinha.
const mapa: MapaEstoque = new Map([
  ["un-noroeste", null],
  ["un-matri", "un-noroeste"],
  ["un-104sul", null],
  ["un-wine", null],
  ["un-beira", null],
]);

describe("resolverUnidadeFisicaPura", () => {
  it("casa com estoque próprio resolve pra ela mesma", () => {
    expect(resolverUnidadeFisicaPura("un-104sul", mapa)).toBe("un-104sul");
    expect(resolverUnidadeFisicaPura("un-noroeste", mapa)).toBe("un-noroeste");
  });

  it("Matri resolve pra Noroeste — é a mesma despensa", () => {
    expect(resolverUnidadeFisicaPura("un-matri", mapa)).toBe("un-noroeste");
  });

  it("unidade fora do mapa resolve pra ela mesma", () => {
    // Uma casa criada depois do mapa ser carregado não pode fazer o custo
    // desaparecer: o pior caso aceitável é ela ler o próprio estoque.
    expect(resolverUnidadeFisicaPura("un-nova", mapa)).toBe("un-nova");
  });

  it("não segue cadeia: para no primeiro salto", () => {
    // A -> B -> C é erro de cadastro. Devolver B (que existe) é visível;
    // seguir até C em silêncio esconderia o erro.
    const cadeia: MapaEstoque = new Map([
      ["a", "b"],
      ["b", "c"],
      ["c", null],
    ]);
    expect(resolverUnidadeFisicaPura("a", cadeia)).toBe("b");
  });
});
