import { describe, it, expect } from "vitest";
import { agruparPorCategoriaPura, SEM_CATEGORIA_CONTAGEM, type ItemContagem } from "@/lib/agrupar-contagem";

const item = (nome: string, categoria: string | null, classeAbc: string | null = "A"): ItemContagem => ({
  id: nome,
  nome,
  unidadeMedida: "KG",
  classeAbc,
  categoria,
});

describe("agruparPorCategoriaPura", () => {
  it("junta cada categoria num grupo, em ordem alfabética", () => {
    const grupos = agruparPorCategoriaPura([
      item("Malbec", "VINHOS"),
      item("Picanha", "CARNES"),
      item("Arroz", "MERCEARIA"),
      item("Chianti", "VINHOS"),
    ]);
    expect(grupos.map((g) => g.categoria)).toEqual(["CARNES", "MERCEARIA", "VINHOS"]);
    expect(grupos[2].itens.map((i) => i.nome)).toEqual(["Chianti", "Malbec"]);
  });

  it("ordena pelo nome DENTRO do grupo, respeitando acento", () => {
    const [g] = agruparPorCategoriaPura([
      item("Órégano", "MERCEARIA"),
      item("Açúcar", "MERCEARIA"),
      item("Arroz", "MERCEARIA"),
    ]);
    expect(g.itens.map((i) => i.nome)).toEqual(["Açúcar", "Arroz", "Órégano"]);
  });

  it("põe 'Sem categoria' por último, por maior que seja", () => {
    const grupos = agruparPorCategoriaPura([
      item("X", null),
      item("Y", null),
      item("Z", null),
      item("Picanha", "CARNES"),
    ]);
    expect(grupos.map((g) => g.categoria)).toEqual(["CARNES", SEM_CATEGORIA_CONTAGEM]);
  });

  it("trata categoria em branco como sem categoria", () => {
    const grupos = agruparPorCategoriaPura([item("X", "   "), item("Y", null)]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].categoria).toBe(SEM_CATEGORIA_CONTAGEM);
    expect(grupos[0].itens).toHaveLength(2);
  });

  it("numera de forma CONTÍNUA entre os grupos", () => {
    // Quem conta confere "45 de 112" no fim; três listas começando do 1
    // tornariam essa conferência impossível.
    const grupos = agruparPorCategoriaPura([
      item("Picanha", "CARNES"),
      item("Alcatra", "CARNES"),
      item("Arroz", "MERCEARIA"),
      item("Malbec", "VINHOS"),
      item("Chianti", "VINHOS"),
    ]);
    expect(grupos.map((g) => [g.categoria, g.primeiroNumero])).toEqual([
      ["CARNES", 1],
      ["MERCEARIA", 3],
      ["VINHOS", 4],
    ]);
  });

  it("não perde nem duplica item nenhum", () => {
    const entrada = [
      item("A", "X"),
      item("B", null),
      item("C", "Y"),
      item("D", "X"),
      item("E", null),
    ];
    const grupos = agruparPorCategoriaPura(entrada);
    const saida = grupos.flatMap((g) => g.itens.map((i) => i.nome));
    expect(saida.sort()).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("devolve lista vazia para entrada vazia, sem inventar grupo", () => {
    expect(agruparPorCategoriaPura([])).toEqual([]);
  });

  it("a classe ABC não interfere na ordem", () => {
    // De propósito: saber que um item vale mais convida a caprichar nele e
    // correr nos outros, e errar a contagem de um item barato estraga o CMV
    // igual.
    const [g] = agruparPorCategoriaPura([
      item("Zucchini", "LEGUMES", "C"),
      item("Alho", "LEGUMES", "A"),
    ]);
    expect(g.itens.map((i) => i.nome)).toEqual(["Alho", "Zucchini"]);
  });
});
