import { describe, it, expect } from "vitest";
import {
  planejarCurvaAbcPura,
  type ClassificacaoAtual,
  type ClassificacaoNova,
} from "@/lib/curva-abc-aplicar";

const nova = (produtoId: string, classe: "A" | "B" | "C", valor: number): ClassificacaoNova => ({
  produtoId,
  classe,
  valor,
});
const atual = (produtoId: string, classeAbc: string | null, grupoContagem: number | null = null): ClassificacaoAtual => ({
  produtoId,
  classeAbc,
  grupoContagem,
});

describe("planejarCurvaAbcPura", () => {
  it("curva em dia não produz mudança nenhuma", () => {
    const p = planejarCurvaAbcPura(
      [nova("x", "A", 100), nova("y", "C", 1)],
      [atual("x", "A", 0), atual("y", "C")],
      true
    );
    expect(p.mudancas).toHaveLength(0);
    expect(p.entramNaA).toHaveLength(0);
    expect(p.saemDaA).toHaveLength(0);
  });

  it("separa quem entra de quem sai da curva A", () => {
    const p = planejarCurvaAbcPura(
      [nova("novo", "A", 900), nova("velho", "B", 50)],
      [atual("velho", "A", 0)],
      true
    );
    expect(p.entramNaA.map((l) => l.produtoId)).toEqual(["novo"]);
    expect(p.saemDaA.map((l) => l.produtoId)).toEqual(["velho"]);
  });

  it("casa de CMV semanal põe toda a curva A no grupo zero", () => {
    const p = planejarCurvaAbcPura([nova("a", "A", 9), nova("b", "A", 8)], [], true);
    expect(p.entramNaA.map((l) => l.grupoContagem)).toEqual([0, 0]);
  });

  it("casa com rodízio alterna a curva A entre os grupos 1 e 2, por valor", () => {
    const p = planejarCurvaAbcPura(
      [nova("a", "A", 100), nova("b", "A", 90), nova("c", "A", 80), nova("d", "A", 70)],
      [],
      false
    );
    // Alternado pela ordem de valor: os dois grupos ficam com metade do
    // dinheiro, em vez de um levar os mais caros.
    expect(p.entramNaA.map((l) => l.grupoContagem)).toEqual([1, 2, 1, 2]);
  });

  it("curva C fica fora do rodízio", () => {
    const p = planejarCurvaAbcPura([nova("x", "C", 1)], [atual("x", "A", 0)], true);
    expect(p.mudancas[0].grupoContagem).toBeNull();
  });

  it("classificado hoje e sem compra na janela vira C e aparece em lista própria", () => {
    const p = planejarCurvaAbcPura([nova("vivo", "A", 10)], [atual("parado", "A", 0)], true);
    expect(p.semCompraNaJanela.map((l) => l.produtoId)).toEqual(["parado"]);
    expect(p.saemDaA.map((l) => l.produtoId)).toEqual(["parado"]);
    expect(p.mudancas.map((l) => l.produtoId).sort()).toEqual(["parado", "vivo"]);
  });

  it("produto sem classe e sem compra não entra em nada", () => {
    const p = planejarCurvaAbcPura([], [atual("nunca", null)], true);
    expect(p.mudancas).toHaveLength(0);
    expect(p.semCompraNaJanela).toHaveLength(0);
  });

  it("o resumo conta todo mundo que fica em cada classe", () => {
    const p = planejarCurvaAbcPura(
      [nova("a", "A", 100), nova("b", "B", 10), nova("c", "C", 1)],
      [atual("sumiu", "B")],
      true
    );
    expect(p.resumo).toEqual({ A: 1, B: 1, C: 2 }); // o "sumiu" entra em C
  });

  it("é estável: a mesma entrada dá o mesmo plano", () => {
    const entrada: ClassificacaoNova[] = [nova("b", "A", 50), nova("a", "A", 50)];
    const um = planejarCurvaAbcPura(entrada, [], false);
    const dois = planejarCurvaAbcPura([...entrada].reverse(), [], false);
    expect(um.entramNaA).toEqual(dois.entramNaA);
  });
});
