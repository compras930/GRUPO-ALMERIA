import { describe, it, expect } from "vitest";
import { quantidadePorPesoPura, avisoDePesagemPura, podePesarPura } from "@/lib/pesagem";

// Whisky 700 ml: o líquido cheio pesa 660 g (álcool é mais leve que água), e a
// garrafa vazia com tampa e rótulo, 480 g.
const WHISKY = { taraG: 480, liquidoCheioG: 660 };

describe("quantidadePorPesoPura", () => {
  it("garrafa cheia dá 1", () => {
    expect(quantidadePorPesoPura(1140, WHISKY)).toBeCloseTo(1, 10);
  });

  it("garrafa pela metade dá 0,5", () => {
    expect(quantidadePorPesoPura(810, WHISKY)).toBeCloseTo(0.5, 10);
  });

  it("garrafa vazia dá 0 — e zero aqui é medição, não ausência de resposta", () => {
    expect(quantidadePorPesoPura(480, WHISKY)).toBe(0);
  });

  it("desconta a tara, que é o erro que mais custaria caro", () => {
    // Sem descontar os 480 g do vidro, 810 g viraria 1,23 garrafa em vez de
    // 0,5 — contando a mais justamente no item mais caro da adega.
    expect(quantidadePorPesoPura(810, WHISKY)).toBeLessThan(0.6);
  });

  it("sem tara declarada, assume que foi pesado só o líquido", () => {
    expect(quantidadePorPesoPura(330, { taraG: null, liquidoCheioG: 660 })).toBeCloseTo(0.5, 10);
  });

  it("recusa peso abaixo da tara em vez de devolver negativo", () => {
    // Balança mal zerada, tara errada ou o frasco errado na mão. Negativo
    // entraria na contagem como estoque negativo e viraria "sumiço" na
    // Conferência, escondendo o erro de medição atrás de um de estoque.
    expect(quantidadePorPesoPura(300, WHISKY)).toBe(null);
  });

  it("recusa quando não há como responder, em vez de devolver zero", () => {
    expect(quantidadePorPesoPura(800, { taraG: 480, liquidoCheioG: null })).toBe(null);
    expect(quantidadePorPesoPura(800, { taraG: 480, liquidoCheioG: 0 })).toBe(null);
    expect(quantidadePorPesoPura(Number.NaN, WHISKY)).toBe(null);
    expect(quantidadePorPesoPura(-5, WHISKY)).toBe(null);
  });
});

describe("podePesarPura", () => {
  it("basta o líquido cheio", () => {
    expect(podePesarPura({ taraG: null, liquidoCheioG: 660 })).toBe(true);
    expect(podePesarPura({ taraG: 480, liquidoCheioG: null })).toBe(false);
    expect(podePesarPura(null)).toBe(false);
  });
});

describe("avisoDePesagemPura", () => {
  it("traz a fórmula inteira, porque é lida em pé na frente da prateleira", () => {
    expect(avisoDePesagemPura(WHISKY, "UND")).toBe(
      "pese: (peso − 480 g da garrafa vazia) ÷ 660 g = und"
    );
  });

  it("sem tara, não manda descontar nada", () => {
    expect(avisoDePesagemPura({ taraG: null, liquidoCheioG: 660 }, "UND")).toBe(
      "pese: peso do líquido ÷ 660 g = und"
    );
  });

  it("não inventa aviso para item que não se pesa", () => {
    expect(avisoDePesagemPura(null, "KG")).toBe(null);
    expect(avisoDePesagemPura({ taraG: 480, liquidoCheioG: null }, "UND")).toBe(null);
  });
});
