import { describe, it, expect } from "vitest";
import { resolverSelecaoPura, valorDeCookiePura, TODAS } from "@/lib/selecao";

const CASAS = [
  { id: "bl", nome: "Beira Lago" },
  { id: "104", nome: "104 Sul" },
];
const MESES = ["2026-11", "2026-10", "2026-09"];
const PADRAO = "2026-11";

const r = (pedido: Parameters<typeof resolverSelecaoPura>[2]) =>
  resolverSelecaoPura(CASAS, MESES, pedido, PADRAO);

describe("resolverSelecaoPura", () => {
  it("sem nada, cai na primeira casa visível e no mês corrente", () => {
    expect(r({})).toEqual({ casaId: "bl", mes: "2026-11", daUrl: false });
  });

  it("o cookie manda quando a URL não traz nada", () => {
    expect(r({ casaCookie: "104", mesCookie: "2026-09" })).toMatchObject({
      casaId: "104",
      mes: "2026-09",
    });
  });

  it("a URL manda sobre o cookie — link compartilhado abre o que mandaram", () => {
    const s = r({ casaSp: "bl", mesSp: "2026-10", casaCookie: "104", mesCookie: "2026-09" });
    expect(s).toMatchObject({ casaId: "bl", mes: "2026-10", daUrl: true });
  });

  it("'todas' é escolha, e sobrevive no cookie", () => {
    expect(r({ casaCookie: TODAS })).toMatchObject({ casaId: null });
    expect(r({ casaSp: TODAS, casaCookie: "bl" })).toMatchObject({ casaId: null, daUrl: true });
  });

  it("casa que não existe na lista é descartada, não mostra dado de quem não se pode ver", () => {
    // Cookie velho de quem mudou de casa.
    expect(r({ casaCookie: "wine-garden" })).toMatchObject({ casaId: "bl" });
    expect(r({ casaSp: "wine-garden", casaCookie: "104" })).toMatchObject({ casaId: "104" });
  });

  it("mês fora da faixa cai no padrão", () => {
    expect(r({ mesSp: "2020-01" }).mes).toBe(PADRAO);
    expect(r({ mesCookie: "nao-e-mes" }).mes).toBe(PADRAO);
  });

  it("a URL com casa e sem mês não zera o mês do cookie", () => {
    expect(r({ casaSp: "104", mesCookie: "2026-10" })).toMatchObject({
      casaId: "104",
      mes: "2026-10",
    });
  });

  it("sem casa visível nenhuma, devolve nulo em vez de quebrar", () => {
    expect(resolverSelecaoPura([], MESES, {}, PADRAO)).toMatchObject({ casaId: null });
  });
});

describe("valorDeCookiePura", () => {
  it("guarda 'todas' quando não há casa", () => {
    expect(valorDeCookiePura(null)).toBe(TODAS);
    expect(valorDeCookiePura("bl")).toBe("bl");
  });
});
