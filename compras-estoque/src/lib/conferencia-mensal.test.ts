import { describe, it, expect } from "vitest";
import {
  conferenciaMensalPura,
  contagensPorSemanaPura,
  semanasDoMesPuras,
  segundaPura,
  type ContagemBruta,
} from "@/lib/conferencia-mensal";

const ENTRADAS = ["ENTRADA_NOTA", "ENTRADA_RECEBIMENTO", "AJUSTE_MANUAL"] as const;
const PERDAS = ["PERDA_QUEBRA", "PERDA_VALIDADE"] as const;

const c = (produtoId: string, quantidade: number, iso: string): ContagemBruta => ({
  produtoId,
  quantidade,
  em: new Date(iso),
});

const base = {
  movimentos: [],
  precoPorProduto: new Map([["carne", 100]]),
  tiposDeEntrada: ENTRADAS,
  tiposDePerda: PERDAS,
};

describe("as semanas da tela", () => {
  it("começa na segunda da virada, mesmo que ela seja do mês anterior", () => {
    // 01/12/2026 é uma terça: a semana dela começou em 30/11.
    const s = semanasDoMesPuras(new Date("2026-12-01T00:00:00Z"), new Date("2026-12-31T23:59:59Z"));
    expect(s[0]).toBe("2026-11-30");
    expect(s).toContain("2026-12-28");
  });

  it("a segunda de uma data é a dela mesma", () => {
    expect(segundaPura(new Date("2026-11-16T12:00:00Z"))).toBe("2026-11-16");
    expect(segundaPura(new Date("2026-11-22T12:00:00Z"))).toBe("2026-11-16"); // domingo
  });
});

describe("a conferência mês a mês", () => {
  const semanas = ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"];

  it("cada período cai na semana da contagem que o ABRIU", () => {
    const [linha] = conferenciaMensalPura({
      ...base,
      semanas,
      contagens: [
        c("carne", 10, "2026-11-09T12:00:00Z"),
        c("carne", 7, "2026-11-16T12:00:00Z"),
      ],
    });
    expect(linha.celulas[0]).toBeNull(); // semana de 02/11: não houve período
    expect(linha.celulas[1]).not.toBeNull(); // semana de 09/11: o período que saiu
    expect(linha.celulas[1]!.diferenca).toBe(-3);
    expect(linha.celulas[1]!.diferencaEmReais).toBe(-300);
    expect(linha.celulas[2]).toBeNull();
  });

  it("semana sem contagem fica VAZIA, e não zero", () => {
    // Zero diria "conferido, nada faltou". Vazio diz "ninguém contou".
    const [linha] = conferenciaMensalPura({
      ...base,
      semanas,
      contagens: [
        c("carne", 10, "2026-11-02T12:00:00Z"),
        c("carne", 8, "2026-11-09T12:00:00Z"),
        // nada na semana de 16/11
        c("carne", 5, "2026-11-23T12:00:00Z"),
      ],
    });
    expect(linha.celulas[0]!.diferenca).toBe(-2);
    expect(linha.celulas[1]!.diferenca).toBe(-3); // 09 -> 23 cai na semana de 09
    expect(linha.celulas[2]).toBeNull();
    expect(linha.semanasConferidas).toBe(2);
  });

  it("conta em quantas semanas o produto faltou — é o padrão que interessa", () => {
    const [linha] = conferenciaMensalPura({
      ...base,
      semanas,
      contagens: [
        c("carne", 10, "2026-11-02T12:00:00Z"),
        c("carne", 8, "2026-11-09T12:00:00Z"),
        c("carne", 6, "2026-11-16T12:00:00Z"),
        c("carne", 6, "2026-11-23T12:00:00Z"),
      ],
    });
    expect(linha.semanasComFalta).toBe(2);
    expect(linha.semanasConferidas).toBe(3);
    expect(linha.totalEmReais).toBe(-400);
    // A quantidade é o que quem contou reconhece: 4 kg, não R$ 400.
    expect(linha.totalQuantidade).toBe(-4);
  });

  it("soma a compra do mês na unidade do produto", () => {
    const [linha] = conferenciaMensalPura({
      ...base,
      semanas,
      contagens: [
        c("carne", 10, "2026-11-09T12:00:00Z"),
        c("carne", 12, "2026-11-16T12:00:00Z"),
        c("carne", 9, "2026-11-23T12:00:00Z"),
      ],
      movimentos: [
        { produtoId: "carne", tipo: "ENTRADA_NOTA", quantidade: 6, em: new Date("2026-11-11T10:00:00Z") },
        { produtoId: "carne", tipo: "ENTRADA_RECEBIMENTO", quantidade: 4, em: new Date("2026-11-18T10:00:00Z") },
      ],
    });
    expect(linha.compradoNoMes).toBe(10);
  });

  it("desconta compra e venda do período, não do mês", () => {
    const [linha] = conferenciaMensalPura({
      ...base,
      semanas,
      contagens: [
        c("carne", 10, "2026-11-09T12:00:00Z"),
        c("carne", 10, "2026-11-16T12:00:00Z"),
      ],
      movimentos: [
        { produtoId: "carne", tipo: "ENTRADA_NOTA", quantidade: 5, em: new Date("2026-11-11T10:00:00Z") },
        { produtoId: "carne", tipo: "SAIDA_CONSUMO", quantidade: -5, em: new Date("2026-11-12T10:00:00Z") },
        // fora do período: não pode entrar
        { produtoId: "carne", tipo: "ENTRADA_NOTA", quantidade: 99, em: new Date("2026-11-20T10:00:00Z") },
      ],
    });
    expect(linha.celulas[1]!.comprado).toBe(5);
    expect(linha.celulas[1]!.vendido).toBe(5);
    expect(linha.celulas[1]!.diferenca).toBe(0);
  });

  it("maior falta primeiro", () => {
    const linhas = conferenciaMensalPura({
      ...base,
      semanas,
      precoPorProduto: new Map([["carne", 100], ["sal", 1]]),
      contagens: [
        c("sal", 10, "2026-11-09T12:00:00Z"),
        c("sal", 9, "2026-11-16T12:00:00Z"),
        c("carne", 10, "2026-11-09T12:00:00Z"),
        c("carne", 2, "2026-11-16T12:00:00Z"),
      ],
    });
    expect(linhas.map((l) => l.produtoId)).toEqual(["carne", "sal"]);
  });

  it("produto contado uma vez só não entra: é marco zero", () => {
    expect(
      conferenciaMensalPura({ ...base, semanas, contagens: [c("carne", 10, "2026-11-09T12:00:00Z")] })
    ).toEqual([]);
  });
});

describe("o aviso de casa que não contou", () => {
  const semanas = ["2026-11-02", "2026-11-09", "2026-11-16"];

  it("conta produtos distintos por semana", () => {
    const r = contagensPorSemanaPura(
      [
        c("carne", 1, "2026-11-09T12:00:00Z"),
        c("sal", 1, "2026-11-09T13:00:00Z"),
        c("carne", 1, "2026-11-09T14:00:00Z"), // recontagem do mesmo produto
      ],
      semanas
    );
    expect(r.map((x) => x.produtos)).toEqual([0, 2, 0]);
  });

  it("semana sem contagem nenhuma vem com zero — é o que dispara o aviso", () => {
    const r = contagensPorSemanaPura([], semanas);
    expect(r.every((x) => x.produtos === 0)).toBe(true);
  });
});
