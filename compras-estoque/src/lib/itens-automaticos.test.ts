import { describe, it, expect } from "vitest";
import { itensAutomaticosPuros } from "@/lib/itens-automaticos";

describe("itensAutomaticosPuros", () => {
  it("cria um item por código, com o preço da própria carga", () => {
    const r = itensAutomaticosPuros([
      { nome: "Filetto di Manzo", codigo: "70039502030", quantidadeVendida: 4, valorTotal: 400 },
    ]);
    expect(r.criar).toEqual([{ codigoPdv: "70039502030", nome: "FILETTO DI MANZO", precoVenda: 100 }]);
    expect(r.semCodigo).toBe(0);
  });

  it("junta as linhas do mesmo código e tira o preço do total", () => {
    const r = itensAutomaticosPuros([
      { nome: "TARTARE", codigo: "123", quantidadeVendida: 1, valorTotal: 100 },
      { nome: "TARTARE", codigo: "123", quantidadeVendida: 3, valorTotal: 180 },
    ]);
    expect(r.criar).toHaveLength(1);
    expect(r.criar[0].precoVenda).toBe(70); // 280 / 4, não os 100 da primeira linha
  });

  it("não cria nada sem código, e conta quantas ficaram", () => {
    const r = itensAutomaticosPuros([
      { nome: "SEM CODIGO", codigo: null, quantidadeVendida: 1, valorTotal: 50 },
      { nome: "VAZIO", codigo: "   ", quantidadeVendida: 1, valorTotal: 50 },
    ]);
    expect(r.criar).toHaveLength(0);
    expect(r.semCodigo).toBe(2);
  });

  it("preço zero quando a origem não manda valor — não inventa", () => {
    const r = itensAutomaticosPuros([{ nome: "X", codigo: "1", quantidadeVendida: 5, valorTotal: null }]);
    expect(r.criar[0].precoVenda).toBe(0);
  });

  it("quantidade zero não divide por zero", () => {
    const r = itensAutomaticosPuros([{ nome: "X", codigo: "1", quantidadeVendida: 0, valorTotal: 90 }]);
    expect(r.criar[0].precoVenda).toBe(0);
  });

  it("normaliza o nome: espaço e caixa", () => {
    const r = itensAutomaticosPuros([
      { nome: "  doppio   ravioli ", codigo: "9", quantidadeVendida: 1, valorTotal: 10 },
    ]);
    expect(r.criar[0].nome).toBe("DOPPIO RAVIOLI");
  });

  it("ordem estável por código", () => {
    const r = itensAutomaticosPuros([
      { nome: "B", codigo: "222", quantidadeVendida: 1, valorTotal: 1 },
      { nome: "A", codigo: "111", quantidadeVendida: 1, valorTotal: 1 },
    ]);
    expect(r.criar.map((c) => c.codigoPdv)).toEqual(["111", "222"]);
  });
});
