import { describe, expect, it } from "vitest";
import {
  montarIndiceProdutos,
  resolverLinhaCompraPura,
  type ProdutoResumo,
} from "@/lib/resolucao-produto-compra";

const CATALOGO: ProdutoResumo[] = [
  { id: "p1", nome: "ALCATRA BOVINO KG", unidadeMedida: "KG", codigoTeknisa: "100000017104" },
  { id: "p2", nome: "BATATA SURECRISP 7MM", unidadeMedida: "KG", codigoTeknisa: null },
  { id: "p3", nome: "AGUA COM GAS", unidadeMedida: "UND", codigoTeknisa: null },
];

const indice = montarIndiceProdutos(CATALOGO);

describe("resolverLinhaCompraPura", () => {
  it("casa por código mesmo com o nome completamente diferente", () => {
    // O caso que motivou a coluna: o Teknisa manda o nome de compra, o
    // catálogo tem o nome de estoque, e só o código liga os dois.
    const r = resolverLinhaCompraPura(
      { nome: "ALCATRA BOVINA BOMBOM (COMPRA)", unidadeMedida: "KG", codigo: "100000017104" },
      indice
    );
    expect(r.via).toBe("CODIGO");
    expect(r.produto?.id).toBe("p1");
  });

  it("recusa quando o código casa mas a unidade é outra", () => {
    // Preço de caixa não pode virar preço de quilo. Sem esta checagem, casar
    // por código reabre o buraco que o casamento por nome+unidade fechava.
    const r = resolverLinhaCompraPura(
      { nome: "ALCATRA BOVINA BOMBOM (COMPRA)", unidadeMedida: "CX", codigo: "100000017104" },
      indice
    );
    expect(r.via).toBeNull();
    expect(r.motivo).toBe("UNIDADE_DIVERGENTE");
    expect(r.produto?.id).toBe("p1"); // vem junto pra poder reportar qual é
  });

  it("cai pro nome quando não veio código", () => {
    const r = resolverLinhaCompraPura({ nome: "BATATA SURECRISP 7MM", unidadeMedida: "KG" }, indice);
    expect(r.via).toBe("NOME");
    expect(r.produto?.id).toBe("p2");
    expect(r.codigoSugerido).toBeNull();
  });

  it("sugere o código quando casou por nome e o produto ainda não tem código", () => {
    const r = resolverLinhaCompraPura(
      { nome: "BATATA SURECRISP 7MM", unidadeMedida: "KG", codigo: "100000019999" },
      indice
    );
    expect(r.via).toBe("NOME");
    expect(r.codigoSugerido).toBe("100000019999");
  });

  it("não sugere código quando o produto já tem o mesmo código", () => {
    const r = resolverLinhaCompraPura(
      { nome: "ALCATRA BOVINO KG", unidadeMedida: "KG", codigo: "100000017104" },
      indice
    );
    expect(r.via).toBe("CODIGO");
    expect(r.codigoSugerido).toBeNull();
  });

  it("recusa quando o nome casa com produto que declara OUTRO código", () => {
    const r = resolverLinhaCompraPura(
      { nome: "ALCATRA BOVINO KG", unidadeMedida: "KG", codigo: "999999999999" },
      indice
    );
    expect(r.via).toBeNull();
    expect(r.motivo).toBe("CONFLITO_DE_CODIGO");
  });

  it("tira o sufixo redundante de unidade do nome que veio na planilha", () => {
    // Planilha "BATATA SURECRISP 7MM KG" + un KG casa com o cadastro
    // "BATATA SURECRISP 7MM". O contrário NÃO vale: o sufixo é tirado só do
    // lado da planilha, nunca do catálogo — tirar do catálogo criaria colisão
    // entre "X" e "X KG" cadastrados na mesma unidade.
    const r = resolverLinhaCompraPura({ nome: "BATATA SURECRISP 7MM KG", unidadeMedida: "KG" }, indice);
    expect(r.via).toBe("NOME");
    expect(r.produto?.id).toBe("p2");
  });

  it("aceita sinônimo de unidade (UN -> UND)", () => {
    const r = resolverLinhaCompraPura({ nome: "AGUA COM GAS", unidadeMedida: "un" }, indice);
    expect(r.via).toBe("NOME");
    expect(r.produto?.id).toBe("p3");
  });

  it("trata embalagem como sinônimo de contagem: garrafa é unidade, fardo é caixa", () => {
    // R$ 32 mil de compra estavam travados por isto em 18/09/2026: vinho
    // comprado em GF contra cadastro em UND, água em FD contra cadastro em CX.
    const catalogo: ProdutoResumo[] = [
      { id: "v1", nome: "GRAN LEGADO", unidadeMedida: "UND", codigoTeknisa: "900001000349" },
      { id: "a1", nome: "ACQUISSIMA PASSION", unidadeMedida: "CX", codigoTeknisa: "905000005158" },
    ];
    const idx = montarIndiceProdutos(catalogo);
    expect(resolverLinhaCompraPura({ nome: "x", unidadeMedida: "GF", codigo: "900001000349" }, idx).via).toBe("CODIGO");
    expect(resolverLinhaCompraPura({ nome: "x", unidadeMedida: "FD", codigo: "905000005158" }, idx).via).toBe("CODIGO");
  });

  it("NÃO trata como sinônimo o par que exige saber o conteúdo da embalagem", () => {
    // Caixa com 360 ovos contra ovo avulso: falta um número (quantos) que não
    // está no sistema. Aceitar aqui gravaria R$ 170 como preço de um ovo.
    const catalogo: ProdutoResumo[] = [
      { id: "o1", nome: "OVOS GRANDE BRANCO UND", unidadeMedida: "UND", codigoTeknisa: "110030000604" },
    ];
    const r = resolverLinhaCompraPura({ nome: "x", unidadeMedida: "CX", codigo: "110030000604" }, montarIndiceProdutos(catalogo));
    expect(r.via).toBeNull();
    expect(r.motivo).toBe("UNIDADE_DIVERGENTE");
  });

  it("converte quando alguém já disse quanto vale a embalagem", () => {
    const catalogo: ProdutoResumo[] = [
      { id: "m1", nome: "MICROVERDE KG", unidadeMedida: "KG", codigoTeknisa: "110010013603" },
      { id: "o1", nome: "OVOS GRANDE BRANCO UND", unidadeMedida: "UND", codigoTeknisa: "110030000604" },
    ];
    const idx = montarIndiceProdutos(catalogo, [
      { produtoId: "m1", unidadeCompra: "UND", fator: 0.04 }, // bandeja de 40 g
      { produtoId: "o1", unidadeCompra: "CX", fator: 360 },   // caixa de 360 ovos
    ]);

    const bandeja = resolverLinhaCompraPura({ nome: "x", unidadeMedida: "UND", codigo: "110010013603" }, idx);
    expect(bandeja.via).toBe("CODIGO");
    expect(bandeja.fatorConversao).toBe(0.04);
    // R$ 15 a bandeja de 40 g = R$ 375 o quilo.
    expect(15 / bandeja.fatorConversao).toBeCloseTo(375, 6);

    const caixa = resolverLinhaCompraPura({ nome: "x", unidadeMedida: "CX", codigo: "110030000604" }, idx);
    expect(caixa.fatorConversao).toBe(360);
    // R$ 170 a caixa = R$ 0,4722 o ovo, que é o preço já cadastrado.
    expect(170 / caixa.fatorConversao).toBeCloseTo(0.4722, 4);
  });

  it("fator zero ou negativo é ignorado, não obedecido", () => {
    // Dividir o preço por zero daria Infinity, e a entrada de estoque seria 0.
    // Cadastro ruim tem que cair no caminho seguro, que é recusar a linha.
    const catalogo: ProdutoResumo[] = [
      { id: "m1", nome: "MICROVERDE KG", unidadeMedida: "KG", codigoTeknisa: "110010013603" },
    ];
    for (const fator of [0, -1]) {
      const idx = montarIndiceProdutos(catalogo, [{ produtoId: "m1", unidadeCompra: "UND", fator }]);
      const r = resolverLinhaCompraPura({ nome: "x", unidadeMedida: "UND", codigo: "110010013603" }, idx);
      expect(r.motivo).toBe("UNIDADE_DIVERGENTE");
    }
  });

  it("conversão só vale pra unidade declarada — outra embalagem segue recusada", () => {
    const catalogo: ProdutoResumo[] = [
      { id: "m1", nome: "MICROVERDE KG", unidadeMedida: "KG", codigoTeknisa: "110010013603" },
    ];
    const idx = montarIndiceProdutos(catalogo, [{ produtoId: "m1", unidadeCompra: "UND", fator: 0.04 }]);
    const r = resolverLinhaCompraPura({ nome: "x", unidadeMedida: "CX", codigo: "110010013603" }, idx);
    expect(r.motivo).toBe("UNIDADE_DIVERGENTE");
  });

  it("não encontra quando nome e código são desconhecidos", () => {
    const r = resolverLinhaCompraPura(
      { nome: "COISA QUE NAO EXISTE", unidadeMedida: "KG", codigo: "100000088888" },
      indice
    );
    expect(r.via).toBeNull();
    expect(r.motivo).toBe("NAO_ENCONTRADO");
    expect(r.produto).toBeNull();
  });

  it("código desconhecido não impede o casamento por nome", () => {
    // Produto novo no Teknisa, já cadastrado aqui: casa por nome e o código
    // vira sugestão — que é como o pareamento se alimenta sozinho.
    const r = resolverLinhaCompraPura(
      { nome: "AGUA COM GAS", unidadeMedida: "UND", codigo: "100000077777" },
      indice
    );
    expect(r.via).toBe("NOME");
    expect(r.codigoSugerido).toBe("100000077777");
  });
});
