import { describe, it, expect } from "vitest";
import { explodirReceitaPura, CicloReceitaError, type IndiceReceitas } from "./receita";

describe("explodirReceitaPura", () => {
  it("explosão simples: só insumos, sem sub-receita", () => {
    const indice: IndiceReceitas = new Map([
      [
        "prato-1",
        {
          rendimentoQtd: null,
          ingredientes: [
            { produtoId: "tomate", subReceitaId: null, quantidade: 0.2 },
            { produtoId: "queijo", subReceitaId: null, quantidade: 0.1 },
          ],
        },
      ],
    ]);
    const totais = explodirReceitaPura("prato-1", 3, indice); // vendeu 3 unidades do prato
    expect(totais.get("tomate")).toBeCloseTo(0.6);
    expect(totais.get("queijo")).toBeCloseTo(0.3);
  });

  it("explosão com sub-receita SEM rendimento definido (equivale a 'Und')", () => {
    const indice: IndiceReceitas = new Map([
      [
        "molho",
        {
          rendimentoQtd: null,
          ingredientes: [{ produtoId: "tomate", subReceitaId: null, quantidade: 0.5 }],
        },
      ],
      [
        "prato-1",
        {
          rendimentoQtd: null,
          ingredientes: [{ produtoId: null, subReceitaId: "molho", quantidade: 2 }],
        },
      ],
    ]);
    // vendeu 1 prato, que usa 2 "unidades" do molho (sem rendimento = 2 lotes inteiros)
    const totais = explodirReceitaPura("prato-1", 1, indice);
    expect(totais.get("tomate")).toBeCloseTo(1); // 2 lotes * 0.5 tomate cada
  });

  it("explosão com sub-receita COM rendimento definido (fração de lote)", () => {
    const indice: IndiceReceitas = new Map([
      [
        "manteiga-noisete",
        {
          rendimentoQtd: 0.5, // o lote inteiro rende 0.5kg
          ingredientes: [{ produtoId: "manteiga", subReceitaId: null, quantidade: 1 }], // 1kg de manteiga crua rende 0.5kg de manteiga noisete
        },
      ],
      [
        "prato-1",
        {
          rendimentoQtd: null,
          ingredientes: [{ produtoId: null, subReceitaId: "manteiga-noisete", quantidade: 0.05 }], // usa 0.05kg de manteiga noisete
        },
      ],
    ]);
    const totais = explodirReceitaPura("prato-1", 1, indice);
    // fração de lote usada = 0.05 / 0.5 = 0.1 lote -> 0.1 * 1kg manteiga crua = 0.1kg
    expect(totais.get("manteiga")).toBeCloseTo(0.1);
  });

  it("soma corretamente quando o mesmo insumo aparece em mais de um lugar da árvore", () => {
    const indice: IndiceReceitas = new Map([
      [
        "sub-a",
        { rendimentoQtd: null, ingredientes: [{ produtoId: "sal", subReceitaId: null, quantidade: 1 }] },
      ],
      [
        "prato-1",
        {
          rendimentoQtd: null,
          ingredientes: [
            { produtoId: "sal", subReceitaId: null, quantidade: 2 },
            { produtoId: null, subReceitaId: "sub-a", quantidade: 3 },
          ],
        },
      ],
    ]);
    const totais = explodirReceitaPura("prato-1", 1, indice);
    expect(totais.get("sal")).toBeCloseTo(2 + 3 * 1); // 2 direto + 3 lotes de sub-a (1 sal cada)
  });

  it("detecta ciclo (A usa B, B usa A de volta) e lança CicloReceitaError em vez de travar", () => {
    const indice: IndiceReceitas = new Map([
      ["a", { rendimentoQtd: null, ingredientes: [{ produtoId: null, subReceitaId: "b", quantidade: 1 }] }],
      ["b", { rendimentoQtd: null, ingredientes: [{ produtoId: null, subReceitaId: "a", quantidade: 1 }] }],
    ]);
    expect(() => explodirReceitaPura("a", 1, indice)).toThrow(CicloReceitaError);
  });

  it("receita referenciada ausente do índice não trava, só não contribui ingredientes", () => {
    const indice: IndiceReceitas = new Map();
    const totais = explodirReceitaPura("nao-existe", 1, indice);
    expect(totais.size).toBe(0);
  });
});
