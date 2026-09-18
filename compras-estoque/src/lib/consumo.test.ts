import { describe, expect, it } from "vitest";
import { calcularConsumoPuro } from "@/lib/consumo";

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
