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
