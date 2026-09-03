import { describe, it, expect } from "vitest";
import {
  resolverIngredientesPura,
  type ContextoResolucao,
  type ProdutoResumo,
  type ReceitaResumo,
} from "./resolucao-ingredientes";

const burrataMaiuscula: ProdutoResumo = { id: "prod-burrata-A", nome: "BURRATA", unidadeMedida: "KG" };
const burrataMinuscula: ProdutoResumo = { id: "prod-burrata-B", nome: "Burrata", unidadeMedida: "KG" };
const azeite: ProdutoResumo = { id: "prod-azeite", nome: "AZEITE EXTRA VIRGEM", unidadeMedida: "LT" };

const molho: ReceitaResumo = { id: "rec-molho", nome: "MOLHO PESTO", unidadeId: "un-1", rendimentoUnidade: "KG" };
const marinada: ReceitaResumo = { id: "rec-marinada", nome: "MARINADA", unidadeId: "un-1", rendimentoUnidade: null };
const molhoDeOutraCasa: ReceitaResumo = { id: "rec-outra", nome: "MOLHO DA OUTRA CASA", unidadeId: "un-2", rendimentoUnidade: "KG" };
const fichaAtual: ReceitaResumo = { id: "rec-atual", nome: "BURRATA COM PESTO", unidadeId: "un-1", rendimentoUnidade: null };

function contexto(over: Partial<ContextoResolucao> = {}): ContextoResolucao {
  return {
    produtosPorId: new Map([burrataMaiuscula, burrataMinuscula, azeite].map((p) => [p.id, p])),
    receitasPorId: new Map([molho, marinada, molhoDeOutraCasa, fichaAtual].map((r) => [r.id, r])),
    receitaAtualId: "rec-atual",
    unidadeId: "un-1",
    ...over,
  };
}

describe("resolverIngredientesPura", () => {
  it("resolve insumo e sub-receita válidos", () => {
    const r = resolverIngredientesPura(
      [
        { tipo: "INSUMO", produtoId: "prod-azeite", unidadeMedida: "LT", quantidade: 0.02 },
        { tipo: "SUBRECEITA", subReceitaId: "rec-molho", unidadeMedida: "KG", quantidade: 0.05 },
      ],
      contexto()
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ingredientes).toEqual([
      { produtoId: "prod-azeite", subReceitaId: null, quantidade: 0.02, unidadeMedida: "LT" },
      { produtoId: null, subReceitaId: "rec-molho", quantidade: 0.05, unidadeMedida: "KG" },
    ]);
  });

  // O ponto central do fix: com dois produtos de nome homônimo (só diferindo o
  // case), a resolução por id grava exatamente o que foi escolhido — o que era
  // impossível de garantir resolvendo por nome.
  it("distingue dois produtos homônimos (mesma unidade, case diferente) pelo id", () => {
    const escolhaA = resolverIngredientesPura(
      [{ tipo: "INSUMO", produtoId: "prod-burrata-A", unidadeMedida: "KG", quantidade: 0.1 }],
      contexto()
    );
    const escolhaB = resolverIngredientesPura(
      [{ tipo: "INSUMO", produtoId: "prod-burrata-B", unidadeMedida: "KG", quantidade: 0.1 }],
      contexto()
    );
    expect(escolhaA.ok && escolhaA.ingredientes[0].produtoId).toBe("prod-burrata-A");
    expect(escolhaB.ok && escolhaB.ingredientes[0].produtoId).toBe("prod-burrata-B");
  });

  it("erro quando o produtoId não existe", () => {
    const r = resolverIngredientesPura(
      [{ tipo: "INSUMO", produtoId: "prod-fantasma", unidadeMedida: "KG", quantidade: 1 }],
      contexto()
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erros).toHaveLength(1);
    expect(r.erros[0]).toContain("Linha 1");
    expect(r.erros[0]).toContain("prod-fantasma");
  });

  it("erro quando o subReceitaId não existe", () => {
    const r = resolverIngredientesPura(
      [{ tipo: "SUBRECEITA", subReceitaId: "rec-fantasma", unidadeMedida: "KG", quantidade: 1 }],
      contexto()
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erros[0]).toContain("sub-receita não encontrada");
  });

  it("erro quando a sub-receita é de outra unidade", () => {
    const r = resolverIngredientesPura(
      [{ tipo: "SUBRECEITA", subReceitaId: "rec-outra", unidadeMedida: "KG", quantidade: 1 }],
      contexto()
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erros[0]).toContain("outra unidade");
  });

  it("erro de auto-referência (a receita usando a si mesma)", () => {
    const r = resolverIngredientesPura(
      [{ tipo: "SUBRECEITA", subReceitaId: "rec-atual", unidadeMedida: "KG", quantidade: 1 }],
      contexto()
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erros[0]).toContain("a si mesma");
  });

  it("erro quando a unidade da linha não bate com a unidade do produto", () => {
    const r = resolverIngredientesPura(
      // 80 "G" contra um produto cadastrado em KG: sem essa checagem, o custo
      // sairia 1000x errado (explodirReceitaPura não converte unidade).
      [{ tipo: "INSUMO", produtoId: "prod-burrata-A", unidadeMedida: "G", quantidade: 80 }],
      contexto()
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erros[0]).toContain("BURRATA");
    expect(r.erros[0]).toContain("KG");
  });

  it("erro quando a unidade da linha não bate com o rendimento da sub-receita", () => {
    const r = resolverIngredientesPura(
      [{ tipo: "SUBRECEITA", subReceitaId: "rec-molho", unidadeMedida: "LT", quantidade: 1 }],
      contexto()
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erros[0]).toContain("MOLHO PESTO");
  });

  it("sub-receita sem rendimentoUnidade: não valida unidade, passa", () => {
    const r = resolverIngredientesPura(
      [{ tipo: "SUBRECEITA", subReceitaId: "rec-marinada", unidadeMedida: "QUALQUER COISA", quantidade: 2 }],
      contexto()
    );
    expect(r.ok).toBe(true);
  });

  // Requisito "nunca descartar/silenciar": quem salvou precisa ver TODOS os
  // problemas de uma vez, não descobrir um por vez a cada tentativa.
  it("junta os erros de TODAS as linhas problemáticas, não só a primeira", () => {
    const r = resolverIngredientesPura(
      [
        { tipo: "INSUMO", produtoId: "prod-azeite", unidadeMedida: "LT", quantidade: 0.01 }, // ok
        { tipo: "INSUMO", produtoId: "prod-fantasma", unidadeMedida: "KG", quantidade: 1 }, // erro
        { tipo: "INSUMO", produtoId: "prod-burrata-A", unidadeMedida: "G", quantidade: 80 }, // erro
        { tipo: "SUBRECEITA", subReceitaId: "rec-outra", unidadeMedida: "KG", quantidade: 1 }, // erro
      ],
      contexto()
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erros).toHaveLength(3);
    expect(r.erros[0]).toContain("Linha 2");
    expect(r.erros[1]).toContain("Linha 3");
    expect(r.erros[2]).toContain("Linha 4");
  });

  it("receita nova (receitaAtualId null): não trava nenhuma sub-receita por auto-referência", () => {
    const r = resolverIngredientesPura(
      [{ tipo: "SUBRECEITA", subReceitaId: "rec-molho", unidadeMedida: "KG", quantidade: 0.1 }],
      contexto({ receitaAtualId: null })
    );
    expect(r.ok).toBe(true);
  });

  it("lista vazia é válida (ficha sem ingrediente ainda)", () => {
    const r = resolverIngredientesPura([], contexto());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ingredientes).toEqual([]);
  });
});
