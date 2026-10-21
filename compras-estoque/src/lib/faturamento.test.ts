import { describe, it, expect } from "vitest";
import { faturamentoDaLinhaPura, faturamentoTotalPura, linhasEstimadasPura } from "@/lib/faturamento";

describe("faturamentoDaLinhaPura", () => {
  it("o valor declarado pela origem ganha do preço cadastrado", () => {
    // FILETTO DI MANZO: cadastro a 155, cardápio já cobrando 175.
    expect(faturamentoDaLinhaPura({ quantidadeVendida: 81, valorVendido: 14175, precoVenda: 155 })).toBe(14175);
  });

  it("sem valor declarado, estima por quantidade × preço", () => {
    expect(faturamentoDaLinhaPura({ quantidadeVendida: 10, precoVenda: 58 })).toBe(580);
    expect(faturamentoDaLinhaPura({ quantidadeVendida: 10, valorVendido: null, precoVenda: 58 })).toBe(580);
  });

  it("cortesia declarada como R$ 0 fatura 0, não o preço de cardápio", () => {
    // A garrafa lançada a R$ 0,01 entrava valendo R$ 400 no recálculo.
    expect(faturamentoDaLinhaPura({ quantidadeVendida: 3, valorVendido: 0.03, precoVenda: 400 })).toBe(0.03);
    expect(faturamentoDaLinhaPura({ quantidadeVendida: 3, valorVendido: 0, precoVenda: 400 })).toBe(0);
  });

  it("linha sem item casado fatura zero", () => {
    // Sem item não há preço, e não se inventa receita de algo que não se sabe
    // o que é.
    expect(faturamentoDaLinhaPura({ quantidadeVendida: 300, precoVenda: null })).toBe(0);
  });

  it("o total mistura declarado e estimado sem preferir um dos dois", () => {
    const linhas = [
      { quantidadeVendida: 2, valorVendido: 350, precoVenda: 155 },
      { quantidadeVendida: 10, precoVenda: 58 },
      { quantidadeVendida: 1, precoVenda: null },
    ];
    expect(faturamentoTotalPura(linhas)).toBe(930);
    expect(linhasEstimadasPura(linhas)).toBe(2);
  });

  it("lista vazia é zero, não NaN", () => {
    expect(faturamentoTotalPura([])).toBe(0);
    expect(linhasEstimadasPura([])).toBe(0);
  });
});
