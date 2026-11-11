import { describe, it, expect } from "vitest";
import {
  avaliarPedidoPura,
  diaEmBrasiliaPura,
  segundaDaSemanaPura,
  semanaDePedidoPura,
  ehMotivoValido,
} from "@/lib/regra-de-pedido";
import { pascoaPura, feriadoDePura } from "@/lib/feriados";

describe("a semana do pedido", () => {
  it("começa na segunda e termina no domingo", () => {
    // 11/11/2026 é uma quarta.
    const s = semanaDePedidoPura("2026-11-11");
    expect(s.inicio).toBe("2026-11-09");
    expect(s.fim).toBe("2026-11-15");
  });

  it("domingo pertence à semana que começou na segunda anterior, não à seguinte", () => {
    expect(segundaDaSemanaPura("2026-11-15")).toBe("2026-11-09");
    expect(segundaDaSemanaPura("2026-11-16")).toBe("2026-11-16");
  });

  it("segunda comum: o dia do pedido é ela mesma", () => {
    const s = semanaDePedidoPura("2026-11-09");
    expect(s.diaPreferido).toBe("2026-11-09");
    expect(s.feriadoQueEmpurrou).toBeNull();
  });

  it("segunda em feriado empurra o pedido para a terça", () => {
    // 02/11/2026 (Finados) cai numa segunda.
    const s = semanaDePedidoPura("2026-11-02");
    expect(feriadoDePura("2026-11-02")).toBe("Finados");
    expect(s.diaPreferido).toBe("2026-11-03");
    expect(s.feriadoQueEmpurrou).toEqual({ dia: "2026-11-02", nome: "Finados" });
  });

  it("segunda e terça de carnaval empurram para a quarta", () => {
    // Páscoa de 2027: 28/03. Carnaval = 08 e 09/02.
    expect(pascoaPura(2027)).toBe("2027-03-28");
    const s = semanaDePedidoPura("2027-02-08");
    expect(s.diaPreferido).toBe("2027-02-10");
  });
});

describe("o pedido da semana e o extra", () => {
  const base = { hoje: "2026-11-09", jaFeitosNaSemana: 0 };

  it("o primeiro da semana é normal e não pede motivo", () => {
    const a = avaliarPedidoPura(base);
    expect(a.tipo).toBe("NORMAL");
    expect(a.exigeMotivo).toBe(false);
    expect(a.erro).toBeNull();
    expect(a.aviso).toBeNull();
  });

  it("o segundo da semana é extra e não sai sem motivo", () => {
    const a = avaliarPedidoPura({ ...base, jaFeitosNaSemana: 1 });
    expect(a.tipo).toBe("EXTRA");
    expect(a.exigeMotivo).toBe(true);
    expect(a.erro).toMatch(/extra/i);
  });

  it("extra com motivo da lista passa", () => {
    const a = avaliarPedidoPura({ ...base, jaFeitosNaSemana: 1, motivo: "FALTA" });
    expect(a.erro).toBeNull();
  });

  it("motivo fora da lista não passa — senão a contagem por causa vira lixo", () => {
    const a = avaliarPedidoPura({ ...base, jaFeitosNaSemana: 1, motivo: "PORQUE_SIM" });
    expect(a.erro).toMatch(/inválido/i);
    expect(ehMotivoValido("PORQUE_SIM")).toBe(false);
  });

  it("“Outro” exige descrição: campo preenchido no vazio não é motivo", () => {
    expect(avaliarPedidoPura({ ...base, jaFeitosNaSemana: 1, motivo: "OUTRO" }).erro).toMatch(/descreva/i);
    expect(
      avaliarPedidoPura({ ...base, jaFeitosNaSemana: 1, motivo: "OUTRO", detalhe: "pedido do chef" }).erro
    ).toBeNull();
  });

  it("o terceiro, o quarto: continuam extras", () => {
    expect(avaliarPedidoPura({ ...base, jaFeitosNaSemana: 3, motivo: "EVENTO" }).tipo).toBe("EXTRA");
  });
});

describe("preferência não é proibição", () => {
  it("pedido da semana fora da segunda passa, com aviso", () => {
    const a = avaliarPedidoPura({ hoje: "2026-11-11", jaFeitosNaSemana: 0 });
    expect(a.erro).toBeNull(); // a diretriz diz "de preferência", e recusar ensina a burlar
    expect(a.aviso).toMatch(/segunda, 09\/11/);
  });

  it("na semana de feriado, o aviso nomeia o feriado e o dia certo", () => {
    const a = avaliarPedidoPura({ hoje: "2026-11-05", jaFeitosNaSemana: 0 });
    expect(a.aviso).toMatch(/terça, 03\/11/);
    expect(a.aviso).toMatch(/Finados/);
  });

  it("pedido no dia certo depois do feriado não avisa nada", () => {
    expect(avaliarPedidoPura({ hoje: "2026-11-03", jaFeitosNaSemana: 0 }).aviso).toBeNull();
  });
});

describe("o dia é o de Brasília, não o do servidor", () => {
  it("21h de domingo em Brasília ainda é domingo, embora já seja segunda em UTC", () => {
    // 2026-11-09T00:30Z = 08/11 21h30 em Brasília.
    expect(diaEmBrasiliaPura(new Date("2026-11-09T00:30:00.000Z"))).toBe("2026-11-08");
    // E, sendo domingo, a semana do pedido é a que começa no dia 02.
    expect(semanaDePedidoPura("2026-11-08").inicio).toBe("2026-11-02");
  });

  it("meio-dia bate nos dois fusos", () => {
    expect(diaEmBrasiliaPura(new Date("2026-11-09T12:00:00.000Z"))).toBe("2026-11-09");
  });
});
