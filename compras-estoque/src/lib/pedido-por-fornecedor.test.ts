import { describe, it, expect } from "vitest";
import {
  agruparPorFornecedorPura,
  mensagemDoFornecedorPura,
  SEM_FORNECEDOR,
  type LinhaDoPedido,
} from "@/lib/pedido-por-fornecedor";

const l = (fornecedor: string | null, nome: string, qtd = 1, preco = 0): LinhaDoPedido => ({
  fornecedor,
  nome,
  unidade: "KG",
  quantidade: qtd,
  precoUnitEsperado: preco,
});

describe("agrupar por fornecedor", () => {
  it("junta os itens de cada fornecedor, em ordem alfabética", () => {
    const g = agruparPorFornecedorPura([l("JM", "TOMATE"), l("ALIMENTE", "QUEIJO"), l("JM", "ALHO")]);
    expect(g.map((x) => x.fornecedor)).toEqual(["ALIMENTE", "JM"]);
    expect(g[1].itens.map((i) => i.nome)).toEqual(["ALHO", "TOMATE"]);
  });

  it("quem não tem fornecedor vai para o fim, com nome próprio", () => {
    const g = agruparPorFornecedorPura([l(null, "BACALHAU"), l("ZZZ ULTIMO", "VINHO")]);
    expect(g.map((x) => x.fornecedor)).toEqual(["ZZZ ULTIMO", SEM_FORNECEDOR]);
  });

  it("fornecedor vazio ou só espaço conta como a definir", () => {
    const g = agruparPorFornecedorPura([l("   ", "SAL")]);
    expect(g[0].fornecedor).toBe(SEM_FORNECEDOR);
  });

  it("soma o total só de quem tem preço", () => {
    const g = agruparPorFornecedorPura([l("JM", "TOMATE", 3, 10), l("JM", "ALHO", 2, 0)]);
    expect(g[0].total).toBe(30);
    expect(g[0].itens.find((i) => i.nome === "ALHO")!.total).toBe(0);
  });
});

describe("mensagem do fornecedor", () => {
  const msg = mensagemDoFornecedorPura({
    fornecedor: "Alimente",
    saudacao: "Boa tarde",
    casas: [
      {
        nome: "Wine Garden",
        cnpj: "35.116.878/0001-71",
        itens: [
          { quantidade: 5, unidade: "kg", nome: "CALABRESA FATIADA" },
          { quantidade: 0.5, unidade: "KG", nome: "QUEIJO PECORINO" },
        ],
      },
      { nome: "Casa Almeria Noroeste", cnpj: null, itens: [{ quantidade: 70, unidade: "und", nome: "IOGURTE" }] },
    ],
  });

  it("mantém o formato que os fornecedores já leem", () => {
    expect(msg).toContain("==================== ALIMENTE ====================");
    expect(msg).toContain("Boa tarde!");
    expect(msg).toContain("*Segue pedido para Wine Garden*");
    expect(msg).toContain("CNPJ 35.116.878/0001-71");
    expect(msg).toContain("• 5 KG – CALABRESA FATIADA");
    expect(msg.trimEnd().endsWith("Obrigado!")).toBe(true);
  });

  it("quantidade quebrada sai com vírgula, inteira sai sem casa", () => {
    expect(msg).toContain("• 0,5 KG – QUEIJO PECORINO");
    expect(msg).toContain("• 70 UND – IOGURTE");
  });

  it("separa as casas com a régua, e não antes da primeira", () => {
    expect(msg.split("------------------------------")).toHaveLength(2);
    expect(msg.indexOf("------------------------------")).toBeGreaterThan(msg.indexOf("Wine Garden"));
  });

  it("casa sem CNPJ não imprime linha de CNPJ vazia", () => {
    const depois = msg.slice(msg.indexOf("Casa Almeria Noroeste"));
    expect(depois).not.toContain("CNPJ");
  });
});
