import { describe, it, expect } from "vitest";
import { calcularConsumoDoMesPuro, contagemAncora } from "@/lib/consumo-mensal";

const em = (iso: string) => new Date(`${iso}T12:00:00.000Z`);
const c = (produtoId: string, quantidade: number, dia: string) => ({ produtoId, quantidade, em: em(dia) });
const e = (produtoId: string, quantidade: number, dia: string) => ({ produtoId, quantidade, em: em(dia) });

// Outubro de 2026 termina num sábado; a contagem de domingo 01/11 fecha o mês.
const OUTUBRO = { inicio: new Date("2026-10-01T00:00:00.000Z"), fim: new Date("2026-11-01T00:00:00.000Z") };
const NOVEMBRO = { inicio: new Date("2026-11-01T00:00:00.000Z"), fim: new Date("2026-12-01T00:00:00.000Z") };

describe("contagemAncora", () => {
  it("pega a contagem mais próxima da virada, antes ou depois", () => {
    const lista = [c("p", 1, "2026-10-31"), c("p", 2, "2026-11-01"), c("p", 3, "2026-11-09")];
    // 01/11 ao meio-dia está 12h depois da virada; 31/10 ao meio-dia, 12h antes.
    // Empate em distância: fica a mais antiga, para a mesma contagem poder
    // fechar um mês e abrir o outro.
    expect(contagemAncora(lista, OUTUBRO.fim)!.quantidade).toBe(1);
  });

  it("ignora contagem fora da tolerância", () => {
    expect(contagemAncora([c("p", 1, "2026-11-09")], NOVEMBRO.inicio)).toBe(null);
  });
});

describe("calcularConsumoDoMesPuro", () => {
  it("fecha outubro com a contagem da virada, não com a última do calendário", () => {
    const contagens = [
      c("p", 100, "2026-10-01"), // abre outubro
      c("p", 80, "2026-10-19"), // semanal, no meio — não é âncora de nada
      c("p", 60, "2026-11-01"), // fecha outubro e abre novembro
      c("p", 50, "2026-11-09"), // semanal de novembro
    ];
    const entradas = [e("p", 200, "2026-10-15"), e("p", 30, "2026-11-05")];
    const [l] = calcularConsumoDoMesPuro(contagens, entradas, OUTUBRO);
    expect(l.saldoInicial).toBe(100);
    expect(l.saldoFinal).toBe(60);
    // Só a compra de outubro entra: a de 05/11 está fora da janela.
    expect(l.entradas).toBe(200);
    expect(l.consumo).toBe(240);
  });

  it("não deixa a última contagem do mês virar CMV do mês", () => {
    // Este é o bug que o arquivo existe para evitar: em 10/11 as duas últimas
    // contagens são de novembro, e usá-las daria "CMV de outubro" para uma
    // semana de novembro.
    const contagens = [c("p", 100, "2026-10-01"), c("p", 60, "2026-11-01"), c("p", 50, "2026-11-09")];
    const [l] = calcularConsumoDoMesPuro(contagens, [], OUTUBRO);
    expect(l.de).toEqual(em("2026-10-01"));
    expect(l.ate).toEqual(em("2026-11-01"));
  });

  it("a mesma contagem fecha um mês e abre o outro, sem buraco", () => {
    const contagens = [c("p", 100, "2026-10-01"), c("p", 60, "2026-11-01"), c("p", 20, "2026-12-01")];
    const [out] = calcularConsumoDoMesPuro(contagens, [], OUTUBRO);
    const [nov] = calcularConsumoDoMesPuro(contagens, [], NOVEMBRO);
    expect(out.ate).toEqual(nov.de);
    expect(out.saldoFinal).toBe(nov.saldoInicial);
  });

  it("deixa de fora o produto que só tem uma das pontas", () => {
    // Contado em 20/10 e nunca mais: medir daí até a virada diria "outubro"
    // para onze dias, e onze dias contra o faturamento do mês dariam um CMV
    // baixo que alguém usaria numa decisão.
    const contagens = [c("meia-janela", 100, "2026-10-20"), c("meia-janela", 50, "2026-11-01")];
    expect(calcularConsumoDoMesPuro(contagens, [], OUTUBRO)).toEqual([]);
  });

  it("deixa de fora o produto contado uma vez só", () => {
    expect(calcularConsumoDoMesPuro([c("p", 10, "2026-11-01")], [], OUTUBRO)).toEqual([]);
  });

  it("aceita a contagem de fechamento feita no dia 02, quando o dia 01 caiu em feriado", () => {
    const contagens = [c("p", 100, "2026-10-01"), c("p", 60, "2026-11-02")];
    const [l] = calcularConsumoDoMesPuro(contagens, [], OUTUBRO);
    expect(l.consumo).toBe(40);
  });

  it("marca consumo negativo em vez de escondê-lo", () => {
    const contagens = [c("p", 10, "2026-10-01"), c("p", 50, "2026-11-01")];
    const [l] = calcularConsumoDoMesPuro(contagens, [], OUTUBRO);
    expect(l.consumo).toBe(-40);
    expect(l.alerta).toBe("CONSUMO_NEGATIVO");
  });

  it("separa os produtos: cada um fecha com as próprias contagens", () => {
    const contagens = [
      c("a", 10, "2026-10-01"),
      c("a", 4, "2026-11-01"),
      c("b", 7, "2026-10-01"),
      c("b", 1, "2026-11-01"),
    ];
    const linhas = calcularConsumoDoMesPuro(contagens, [e("a", 2, "2026-10-10")], OUTUBRO);
    expect(linhas.find((l) => l.produtoId === "a")!.consumo).toBe(8);
    expect(linhas.find((l) => l.produtoId === "b")!.consumo).toBe(6);
  });
});
