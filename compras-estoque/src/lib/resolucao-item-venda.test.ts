import { describe, it, expect } from "vitest";
import { resolverItensVendaPura, type ItemVendaResumo } from "./resolucao-item-venda";

// Caso real do Wine Garden: o PDV vende "FILE AU POIVRE WINE", o cadastro tem
// "Filé au Poivre". Por nome nunca casa; por código casa sempre.
const filePoivre: ItemVendaResumo = { id: "iv-poivre", nome: "Filé au Poivre", codigoPdv: "70039501916" };
const tabuaMista: ItemVendaResumo = { id: "iv-tabua", nome: "TABUA MISTA", codigoPdv: null };
// Mesmo vinho em taça e em garrafa: mesmo nome, dois ItemVenda (é o motivo do
// @@unique incluir categoria).
const vinhoTaca: ItemVendaResumo = { id: "iv-vinho-taca", nome: "Boya Pinot Noir", codigoPdv: "1001720100" };
const vinhoGarrafa: ItemVendaResumo = { id: "iv-vinho-gf", nome: "Boya Pinot Noir", codigoPdv: "1001720101" };

const catalogo = [filePoivre, tabuaMista, vinhoTaca, vinhoGarrafa];

describe("resolverItensVendaPura", () => {
  it("casa por código mesmo com o nome completamente diferente", () => {
    const [r] = resolverItensVendaPura(
      [{ nome: "FILE AU POIVRE WINE", codigo: "70039501916", quantidadeVendida: 12 }],
      catalogo
    );
    expect(r.itemVendaId).toBe("iv-poivre");
    expect(r.via).toBe("CODIGO");
    expect(r.motivo).toBeNull();
  });

  it("o código desempata nomes iguais que por nome seriam ambíguos", () => {
    const [taca, garrafa] = resolverItensVendaPura(
      [
        { nome: "BOYA PINOT NOIR - CHILE", codigo: "1001720100", quantidadeVendida: 3 },
        { nome: "BOYA PINOT NOIR - CHILE", codigo: "1001720101", quantidadeVendida: 1 },
      ],
      catalogo
    );
    expect(taca.itemVendaId).toBe("iv-vinho-taca");
    expect(garrafa.itemVendaId).toBe("iv-vinho-gf");
  });

  it("sem código, cai pro nome (comportamento das planilhas antigas)", () => {
    const [r] = resolverItensVendaPura([{ nome: "tabua mista", quantidadeVendida: 4 }], catalogo);
    expect(r.itemVendaId).toBe("iv-tabua");
    expect(r.via).toBe("NOME");
    expect(r.codigoSugerido).toBeNull();
  });

  it("casou por nome e trouxe código novo: sugere o código, mas não decide sozinho", () => {
    const [r] = resolverItensVendaPura(
      [{ nome: "TABUA MISTA", codigo: "70039502007", quantidadeVendida: 4 }],
      catalogo
    );
    expect(r.itemVendaId).toBe("iv-tabua");
    expect(r.via).toBe("NOME");
    expect(r.codigoSugerido).toBe("70039502007");
  });

  it("nome casa mas o item já declara OUTRO código: não casa, reporta conflito", () => {
    const [r] = resolverItensVendaPura(
      [{ nome: "Filé au Poivre", codigo: "99999999999", quantidadeVendida: 2 }],
      catalogo
    );
    expect(r.itemVendaId).toBeNull();
    expect(r.motivo).toBe("CONFLITO_DE_CODIGO");
  });

  it("código desconhecido e nome inédito: não casa", () => {
    const [r] = resolverItensVendaPura(
      [{ nome: "CARAMELLI DE CAMARAO", codigo: "70039502762", quantidadeVendida: 134 }],
      catalogo
    );
    expect(r.itemVendaId).toBeNull();
    expect(r.motivo).toBe("NOME_NAO_ENCONTRADO");
  });

  it("nome ambíguo sem código continua ambíguo", () => {
    const [r] = resolverItensVendaPura([{ nome: "Boya Pinot Noir", quantidadeVendida: 1 }], catalogo);
    expect(r.itemVendaId).toBeNull();
    expect(r.motivo).toBe("NOME_AMBIGUO");
  });

  it("código vazio, em branco ou nulo é tratado como ausente", () => {
    const r = resolverItensVendaPura(
      [
        { nome: "TABUA MISTA", codigo: "", quantidadeVendida: 1 },
        { nome: "TABUA MISTA", codigo: "   ", quantidadeVendida: 1 },
        { nome: "TABUA MISTA", codigo: null, quantidadeVendida: 1 },
      ],
      catalogo
    );
    expect(r.map((x) => x.itemVendaId)).toEqual(["iv-tabua", "iv-tabua", "iv-tabua"]);
    expect(r.map((x) => x.codigoSugerido)).toEqual([null, null, null]);
  });

  it("código com espaço em volta casa igual (Excel devolve assim)", () => {
    const [r] = resolverItensVendaPura(
      [{ nome: "qualquer coisa", codigo: " 70039501916 ", quantidadeVendida: 1 }],
      catalogo
    );
    expect(r.itemVendaId).toBe("iv-poivre");
  });

  it("resolve a lista inteira, uma decisão por linha", () => {
    const r = resolverItensVendaPura(
      [
        { nome: "FILE AU POIVRE WINE", codigo: "70039501916", quantidadeVendida: 12 },
        { nome: "ITEM QUE NAO EXISTE", codigo: "123", quantidadeVendida: 1 },
        { nome: "TABUA MISTA", quantidadeVendida: 4 },
      ],
      catalogo
    );
    expect(r).toHaveLength(3);
    expect(r.map((x) => x.via)).toEqual(["CODIGO", null, "NOME"]);
  });
});
