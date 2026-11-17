import { describe, it, expect } from "vitest";
import { PAPEIS } from "@/lib/constants";
import {
  exigeUnidade,
  unidadeVisivel,
  podeVerPedidos,
  podeCriarPedido,
  podeAprovarPedido,
  podeVerChamado,
  podeAbrirChamado,
  podeTriarChamado,
  podeAprovarServico,
} from "@/lib/permissions";

describe("exigeUnidade", () => {
  it("dispensa só o ADMIN e o responsável da manutenção", () => {
    expect(exigeUnidade("ADMIN")).toBe(false);
    expect(exigeUnidade("MANUTENCAO")).toBe(false);
    expect(exigeUnidade("AGENTE_MANUTENCAO")).toBe(false);
    for (const papel of PAPEIS.filter((p) => p !== "ADMIN" && p !== "MANUTENCAO" && p !== "AGENTE_MANUTENCAO")) {
      expect(exigeUnidade(papel), papel).toBe(true);
    }
  });

  it("cobre todo papel que existir, sem lista repetida", () => {
    // Papel novo entra nesta regra por omissão: se um dia aparecer outro que
    // possa ficar sem casa, é aqui que o teste quebra e obriga a decidir.
    for (const papel of PAPEIS) {
      expect(exigeUnidade(papel)).toBe(papel !== "ADMIN" && papel !== "MANUTENCAO" && papel !== "AGENTE_MANUTENCAO");
    }
  });
});

describe("unidadeVisivel", () => {
  it("deixa o ADMIN ver qualquer casa, inclusive sem casa própria", () => {
    expect(unidadeVisivel("ADMIN", null, "beira-lago")).toBe(true);
    expect(unidadeVisivel("ADMIN", "wine-garden", "beira-lago")).toBe(true);
  });

  it("prende o gerente na própria casa", () => {
    expect(unidadeVisivel("GERENTE", "beira-lago", "beira-lago")).toBe(true);
    expect(unidadeVisivel("GERENTE", "beira-lago", "wine-garden")).toBe(false);
  });

  it("nega tudo pra não-admin sem casa, em vez de liberar", () => {
    // O contrário disto é o vazamento que `exigeUnidade` existe pra impedir:
    // nulo não pode significar "todas".
    expect(unidadeVisivel("GERENTE", null, "beira-lago")).toBe(false);
  });
});

describe("pedidos", () => {
  it("todo papel vê a tela de pedidos — o gerente agora cria os da própria casa", () => {
    for (const papel of PAPEIS) {
      expect(podeVerPedidos(papel), papel).toBe(true);
    }
  });

  it("o gerente cria pedido, mas continua sem aprovar o próprio", () => {
    expect(podeCriarPedido("GERENTE")).toBe(true);
    expect(podeAprovarPedido("GERENTE")).toBe(false);
  });

  it("recebedor não cria pedido", () => {
    expect(podeCriarPedido("RECEBEDOR")).toBe(false);
  });
});

describe("podeVerChamado", () => {
  const chamado = { unidadeId: "bl", colaboradorUsuarioId: "agente-1" };
  it("agente vê só o que foi encaminhado a ele", () => {
    expect(podeVerChamado({ id: "agente-1", papel: "AGENTE_MANUTENCAO", unidadeId: null }, chamado)).toBe(true);
    expect(podeVerChamado({ id: "agente-2", papel: "AGENTE_MANUTENCAO", unidadeId: null }, chamado)).toBe(false);
  });
  it("gerente vê os da casa dele; responsável e admin veem todos", () => {
    expect(podeVerChamado({ id: "g", papel: "GERENTE", unidadeId: "bl" }, chamado)).toBe(true);
    expect(podeVerChamado({ id: "g", papel: "GERENTE", unidadeId: "ns" }, chamado)).toBe(false);
    expect(podeVerChamado({ id: "m", papel: "MANUTENCAO", unidadeId: null }, chamado)).toBe(true);
    expect(podeVerChamado({ id: "a", papel: "ADMIN", unidadeId: null }, chamado)).toBe(true);
  });
  it("agente não abre chamado nem faz triagem", () => {
    expect(podeAbrirChamado("AGENTE_MANUTENCAO")).toBe(false);
    expect(podeTriarChamado("AGENTE_MANUTENCAO")).toBe(false);
    expect(podeAprovarServico("AGENTE_MANUTENCAO")).toBe(false);
  });
});
