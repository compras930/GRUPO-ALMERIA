import { describe, it, expect } from "vitest";
import { conciliarPuro, totalizarPuro, type ParcelasProduto } from "@/lib/conciliacao";

const base: ParcelasProduto = {
  produtoId: "p",
  saldoInicial: 0,
  comprado: 0,
  vendido: 0,
  perdaDeclarada: 0,
  saldoContado: 0,
  preco: 0,
};

describe("conciliarPuro", () => {
  it("fecha em zero quando a ficha explica tudo", () => {
    const [l] = conciliarPuro([
      { ...base, saldoInicial: 10, comprado: 20, vendido: 25, saldoContado: 5, preco: 30 },
    ]);
    expect(l.esperado).toBe(5);
    expect(l.diferenca).toBe(0);
    expect(l.diferencaEmReais).toBe(0);
    expect(l.alerta).toBe(null);
  });

  it("acusa falta e converte em dinheiro pelo preço do produto", () => {
    const [l] = conciliarPuro([
      { ...base, saldoInicial: 10, comprado: 20, vendido: 25, saldoContado: 3, preco: 84.9 },
    ]);
    expect(l.diferenca).toBe(-2);
    expect(l.diferencaEmReais).toBeCloseTo(-169.8, 10);
  });

  it("desconta a perda declarada, que já foi explicada pelo gerente", () => {
    // Sem isto, tudo que o gerente lançou como quebra voltaria como falta — e
    // ele seria cobrado justamente pelo que teve o trabalho de declarar.
    const [l] = conciliarPuro([
      { ...base, saldoInicial: 10, comprado: 0, vendido: 4, perdaDeclarada: 3, saldoContado: 3, preco: 10 },
    ]);
    expect(l.esperado).toBe(3);
    expect(l.diferenca).toBe(0);
  });

  it("marca SEM_FICHA em vez de gritar sumiço quando nenhuma ficha usa o insumo", () => {
    const [l] = conciliarPuro([
      { ...base, saldoInicial: 10, comprado: 0, vendido: 0, saldoContado: 2, preco: 50 },
    ]);
    expect(l.alerta).toBe("SEM_FICHA");
    expect(l.diferenca).toBe(-8);
  });

  it("não marca SEM_FICHA quando o insumo nem se moveu", () => {
    const [l] = conciliarPuro([{ ...base, saldoInicial: 10, saldoContado: 10, preco: 50 }]);
    expect(l.alerta).toBe(null);
  });

  it("marca SOBRA quando o estoque rendeu mais do que a conta previa", () => {
    const [l] = conciliarPuro([
      { ...base, saldoInicial: 10, comprado: 0, vendido: 2, saldoContado: 12, preco: 10 },
    ]);
    expect(l.diferenca).toBe(4);
    expect(l.alerta).toBe("SOBRA");
  });

  it("ordena pela maior FALTA em dinheiro, não pela maior diferença absoluta", () => {
    const linhas = conciliarPuro([
      { ...base, produtoId: "sobra", saldoInicial: 0, comprado: 100, saldoContado: 100, vendido: 0, preco: 10 },
      { ...base, produtoId: "falta-cara", saldoInicial: 10, vendido: 1, saldoContado: 0, preco: 500 },
      { ...base, produtoId: "falta-barata", saldoInicial: 100, vendido: 1, saldoContado: 0, preco: 1 },
    ]);
    // Falta cara primeiro; a sobra, por maior que seja, nunca disputa o topo.
    expect(linhas.map((l) => l.produtoId)).toEqual(["falta-cara", "falta-barata", "sobra"]);
  });

  it("trata diferença de balança como zero, não como achado", () => {
    const [l] = conciliarPuro([
      { ...base, saldoInicial: 1.0005, saldoContado: 1.001, vendido: 0, preco: 10 },
    ]);
    expect(l.alerta).toBe(null);
  });
});

describe("totalizarPuro", () => {
  it("separa falta de sobra em vez de só somar", () => {
    const linhas = conciliarPuro([
      // Os dois COM ficha de propósito: aqui o que se testa é falta contra
      // sobra, e `vendido: 0` jogaria a linha "a" para o balde de sem ficha.
      { ...base, produtoId: "a", saldoInicial: 11, vendido: 1, saldoContado: 0, preco: 300 },
      { ...base, produtoId: "b", saldoInicial: 0, comprado: 11, vendido: 1, saldoContado: 20, preco: 290 },
    ]);
    const t = totalizarPuro(linhas);
    expect(t.faltaEmReais).toBeCloseTo(3000, 10);
    expect(t.sobraEmReais).toBeCloseTo(2900, 10);
    // O líquido é pequeno e MENTE: são dois problemas grandes que por acaso
    // quase se cancelam. Por isso as três colunas aparecem juntas na tela.
    expect(t.liquidoEmReais).toBeCloseTo(-100, 10);
    expect(t.produtos).toBe(2);
  });

  it("conta quantos produtos ainda não têm ficha", () => {
    const linhas = conciliarPuro([
      { ...base, produtoId: "a", saldoInicial: 5, vendido: 0, saldoContado: 1, preco: 10 },
      { ...base, produtoId: "b", saldoInicial: 5, vendido: 4, saldoContado: 1, preco: 10 },
    ]);
    expect(totalizarPuro(linhas).semFicha).toBe(1);
  });
});

describe("falta sem ficha, separada", () => {
  it("não mistura ficha por escrever com mercadoria sumida", () => {
    const linhas = conciliarPuro([
      // tem ficha e falta de verdade
      { ...base, produtoId: "com-ficha", saldoInicial: 10, vendido: 5, saldoContado: 3, preco: 100 },
      // nenhuma ficha menciona: toda a saída vira "falta" por construção
      { ...base, produtoId: "sem-ficha", saldoInicial: 10, vendido: 0, saldoContado: 2, preco: 100 },
    ]);
    const t = totalizarPuro(linhas);
    expect(t.faltaEmReais).toBeCloseTo(200, 10);
    expect(t.faltaSemFichaEmReais).toBeCloseTo(800, 10);
    // O líquido continua fechando tudo que a prateleira contradiz.
    expect(t.liquidoEmReais).toBeCloseTo(-1000, 10);
  });
});
