import { describe, expect, it } from "vitest";
import { calcularConsumoPuro, perdasPorProdutoPura, TIPOS_DE_ENTRADA } from "@/lib/consumo";

const d = (dia: number) => new Date(`2026-09-${String(dia).padStart(2, "0")}T12:00:00Z`);

describe("calcularConsumoPuro", () => {
  it("consumo é saldo inicial + entradas - saldo final", () => {
    const r = calcularConsumoPuro(
      [
        { produtoId: "p1", quantidade: 10, em: d(1) },
        { produtoId: "p1", quantidade: 4, em: d(15) },
      ],
      [{ produtoId: "p1", quantidade: 20, em: d(8) }]
    );
    expect(r).toHaveLength(1);
    expect(r[0].consumo).toBe(26); // 10 + 20 - 4
    expect(r[0].alerta).toBeNull();
  });

  it("ignora produto contado uma vez só — ainda não tem período fechado", () => {
    const r = calcularConsumoPuro([{ produtoId: "p1", quantidade: 10, em: d(1) }], []);
    expect(r).toHaveLength(0);
  });

  it("usa as DUAS ÚLTIMAS contagens quando há três", () => {
    const r = calcularConsumoPuro(
      [
        { produtoId: "p1", quantidade: 100, em: d(1) },
        { produtoId: "p1", quantidade: 10, em: d(10) },
        { produtoId: "p1", quantidade: 3, em: d(20) },
      ],
      [{ produtoId: "p1", quantidade: 5, em: d(15) }]
    );
    expect(r[0].saldoInicial).toBe(10);
    expect(r[0].consumo).toBe(12); // 10 + 5 - 3
  });

  it("não conta entrada de fora do período", () => {
    const r = calcularConsumoPuro(
      [
        { produtoId: "p1", quantidade: 10, em: d(10) },
        { produtoId: "p1", quantidade: 10, em: d(20) },
      ],
      [
        { produtoId: "p1", quantidade: 99, em: d(5) },  // antes da 1a contagem
        { produtoId: "p1", quantidade: 99, em: d(25) }, // depois da 2a
        { produtoId: "p1", quantidade: 7, em: d(15) },  // dentro
      ]
    );
    expect(r[0].entradas).toBe(7);
    expect(r[0].consumo).toBe(7);
  });

  it("entrada no instante da contagem anterior fica de fora; no da atual, dentro", () => {
    // A contagem anterior já viu na prateleira o que chegou naquele instante.
    // A atual é feita depois de guardar o que chegou no dia.
    const r = calcularConsumoPuro(
      [
        { produtoId: "p1", quantidade: 10, em: d(10) },
        { produtoId: "p1", quantidade: 10, em: d(20) },
      ],
      [
        { produtoId: "p1", quantidade: 3, em: d(10) },
        { produtoId: "p1", quantidade: 4, em: d(20) },
      ]
    );
    expect(r[0].entradas).toBe(4);
  });

  it("marca consumo negativo, que é fisicamente impossível", () => {
    // Contou 50 onde só podiam existir 10: falta entrada no sistema, ou a
    // contagem foi feita em outra unidade de medida.
    const r = calcularConsumoPuro(
      [
        { produtoId: "p1", quantidade: 10, em: d(1) },
        { produtoId: "p1", quantidade: 50, em: d(15) },
      ],
      []
    );
    expect(r[0].consumo).toBe(-40);
    expect(r[0].alerta).toBe("CONSUMO_NEGATIVO");
  });

  it("separa produtos", () => {
    const r = calcularConsumoPuro(
      [
        { produtoId: "p1", quantidade: 10, em: d(1) },
        { produtoId: "p1", quantidade: 2, em: d(15) },
        { produtoId: "p2", quantidade: 5, em: d(1) },
        { produtoId: "p2", quantidade: 5, em: d(15) },
      ],
      [{ produtoId: "p2", quantidade: 1, em: d(8) }]
    );
    expect(r.find((x) => x.produtoId === "p1")!.consumo).toBe(8);
    expect(r.find((x) => x.produtoId === "p2")!.consumo).toBe(1);
  });
});

describe("perdasPorProdutoPura", () => {
  const d = (s: string) => new Date(s);
  const janela = [{ produtoId: "p1", de: d("2026-10-05T10:00:00Z"), ate: d("2026-10-12T10:00:00Z") }];

  it("soma as baixas dentro da janela do produto", () => {
    const r = perdasPorProdutoPura(janela, [
      { produtoId: "p1", quantidade: -2, em: d("2026-10-07T18:00:00Z") },
      { produtoId: "p1", quantidade: -1.5, em: d("2026-10-09T18:00:00Z") },
    ]);
    expect(r.get("p1")).toBeCloseTo(3.5);
  });

  it("devolve MÓDULO, não o negativo gravado", () => {
    // O movimento é gravado negativo (convenção de MovimentoEstoque). Quem lê a
    // tela quer "perdemos 3 kg". Sinal trocado aqui vira número errado sem
    // ninguém ver.
    const r = perdasPorProdutoPura(janela, [{ produtoId: "p1", quantidade: -3, em: d("2026-10-07T00:00:00Z") }]);
    expect(r.get("p1")).toBe(3);
  });

  it("ignora baixa fora da janela", () => {
    const r = perdasPorProdutoPura(janela, [
      { produtoId: "p1", quantidade: -9, em: d("2026-10-01T00:00:00Z") }, // antes
      { produtoId: "p1", quantidade: -9, em: d("2026-10-20T00:00:00Z") }, // depois
      { produtoId: "p1", quantidade: -1, em: d("2026-10-08T00:00:00Z") }, // dentro
    ]);
    expect(r.get("p1")).toBe(1);
  });

  it("borda: no instante da contagem anterior fica FORA, no da atual fica DENTRO", () => {
    // Mesma regra das entradas: a contagem anterior já viu a prateleira sem
    // aquela baixa.
    const r = perdasPorProdutoPura(janela, [
      { produtoId: "p1", quantidade: -5, em: d("2026-10-05T10:00:00Z") },
      { produtoId: "p1", quantidade: -7, em: d("2026-10-12T10:00:00Z") },
    ]);
    expect(r.get("p1")).toBe(7);
  });

  it("produto sem baixa não aparece no mapa", () => {
    expect(perdasPorProdutoPura(janela, []).has("p1")).toBe(false);
  });

  it("PERDA NÃO ENTRA NO CONSUMO — é o ponto inteiro desta função", () => {
    // A baixa já está dentro do consumo, porque a contagem final já veio menor.
    // Se um dia PERDA_* entrar em TIPOS_DE_ENTRADA, este teste cai.
    expect(TIPOS_DE_ENTRADA.some((t) => t.startsWith("PERDA"))).toBe(false);

    const contagens = [
      { produtoId: "p1", quantidade: 10, em: d("2026-10-05T10:00:00Z") },
      { produtoId: "p1", quantidade: 4, em: d("2026-10-12T10:00:00Z") },
    ];
    // Sem entrada nenhuma: sumiram 6. Desses, 2 foram baixa declarada.
    const [consumo] = calcularConsumoPuro(contagens, []);
    expect(consumo.consumo).toBe(6);

    const perdas = perdasPorProdutoPura([consumo], [
      { produtoId: "p1", quantidade: -2, em: d("2026-10-08T00:00:00Z") },
    ]);
    expect(perdas.get("p1")).toBe(2);
    // 6 no total, dos quais 2 explicados — 4 viraram venda (ou sumiram).
    expect(consumo.consumo - (perdas.get("p1") ?? 0)).toBe(4);
  });
});
