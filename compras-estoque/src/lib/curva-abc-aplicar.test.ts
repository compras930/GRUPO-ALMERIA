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
      [atual("x", "A", 0), atual("y", "C")]
    );
    expect(p.mudancas).toHaveLength(0);
    expect(p.entramNaA).toHaveLength(0);
    expect(p.saemDaA).toHaveLength(0);
  });

  it("separa quem entra de quem sai da curva A", () => {
    const p = planejarCurvaAbcPura(
      [nova("novo", "A", 900), nova("velho", "B", 50)],
      [atual("velho", "A", 0)]
    );
    expect(p.entramNaA.map((l) => l.produtoId)).toEqual(["novo"]);
    expect(p.saemDaA.map((l) => l.produtoId)).toEqual(["velho"]);
  });

  it("toda a curva A vai para o grupo zero — contagem semanal em todas as casas", () => {
    const p = planejarCurvaAbcPura([nova("a", "A", 9), nova("b", "A", 8)], []);
    expect(p.entramNaA.map((l) => l.grupoContagem)).toEqual([0, 0]);
  });

  it("a curva B é dividida em duas metades, alternada por valor", () => {
    const p = planejarCurvaAbcPura(
      [nova("a", "B", 100), nova("b", "B", 90), nova("c", "B", 80), nova("d", "B", 70)],
      []
    );
    // Alternado pela ordem de valor: as duas metades ficam com metade do
    // dinheiro, em vez de uma levar os mais caros.
    expect(p.mudancas.map((l) => l.grupoContagem)).toEqual([1, 2, 1, 2]);
  });

  it("mudança SÓ de grupo entra no plano — é o que aplica a rotina nova", () => {
    // Curva A gravada no grupo 1 (rodízio antigo) continua A, mas tem que ir
    // para o grupo 0. Antes isto não entrava em `mudancas` e a troca de rotina
    // não teria efeito nenhum.
    const p = planejarCurvaAbcPura([nova("x", "A", 100)], [atual("x", "A", 1)]);
    expect(p.mudancas.map((l) => [l.produtoId, l.grupoContagem])).toEqual([["x", 0]]);
    // Não "entra" nem "sai" da curva A: a classe não mudou.
    expect(p.entramNaA).toHaveLength(0);
    expect(p.saemDaA).toHaveLength(0);
  });

  it("curva B em grupo 3 do rodízio antigo é remanejada para uma das metades", () => {
    const p = planejarCurvaAbcPura([nova("x", "B", 10)], [atual("x", "B", 3)]);
    expect(p.mudancas[0].grupoContagem).toBe(1);
  });

  it("curva C fica fora do rodízio", () => {
    const p = planejarCurvaAbcPura([nova("x", "C", 1)], [atual("x", "A", 0)]);
    expect(p.mudancas[0].grupoContagem).toBeNull();
  });

  it("classificado hoje e sem compra na janela vira C e aparece em lista própria", () => {
    const p = planejarCurvaAbcPura([nova("vivo", "A", 10)], [atual("parado", "A", 0)]);
    expect(p.semCompraNaJanela.map((l) => l.produtoId)).toEqual(["parado"]);
    expect(p.saemDaA.map((l) => l.produtoId)).toEqual(["parado"]);
    expect(p.mudancas.map((l) => l.produtoId).sort()).toEqual(["parado", "vivo"]);
  });

  it("produto fora do escopo sai da folha e aparece em lista PRÓPRIA", () => {
    // Travessa classificada em A por ter sido comprada: vira C e some da
    // folha — mas por outro motivo que "a casa parou de comprar", e quem lê a
    // tela precisa ver a diferença.
    const p = planejarCurvaAbcPura([nova("vivo", "A", 10)], [atual("travessa", "A", 0)], new Set(["travessa"]));
    expect(p.foraDoEscopo.map((l) => l.produtoId)).toEqual(["travessa"]);
    expect(p.semCompraNaJanela).toHaveLength(0);
    expect(p.mudancas.map((l) => l.produtoId).sort()).toEqual(["travessa", "vivo"]);
  });

  it("produto sem classe e sem compra não entra em nada", () => {
    const p = planejarCurvaAbcPura([], [atual("nunca", null)]);
    expect(p.mudancas).toHaveLength(0);
    expect(p.semCompraNaJanela).toHaveLength(0);
  });

  it("o resumo conta todo mundo que fica em cada classe", () => {
    const p = planejarCurvaAbcPura(
      [nova("a", "A", 100), nova("b", "B", 10), nova("c", "C", 1)],
      [atual("sumiu", "B")]
    );
    expect(p.resumo).toEqual({ A: 1, B: 1, C: 2 }); // o "sumiu" entra em C
  });

  it("é estável: a mesma entrada dá o mesmo plano", () => {
    const entrada: ClassificacaoNova[] = [nova("b", "A", 50), nova("a", "A", 50)];
    const um = planejarCurvaAbcPura(entrada, []);
    const dois = planejarCurvaAbcPura([...entrada].reverse(), []);
    expect(um.entramNaA).toEqual(dois.entramNaA);
  });
});
