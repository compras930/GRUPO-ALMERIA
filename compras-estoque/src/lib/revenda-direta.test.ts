import { describe, it, expect } from "vitest";
import {
  sugerirVinculosPuros,
  sugestoesSegurasPuras,
  type ItemParaVincular,
  type ProdutoCandidato,
} from "@/lib/revenda-direta";

const item = (nome: string, id = nome): ItemParaVincular => ({
  itemVendaId: id,
  nome,
  tipo: "BEBIDA",
  faturamento: 100,
});
const prod = (nome: string, id = nome): ProdutoCandidato => ({
  produtoId: id,
  nome,
  unidadeMedida: "UND",
});

describe("sugerir o produto de cada item de revenda", () => {
  it("nome idêntico vira sugestão exata", () => {
    const [s] = sugerirVinculosPuros(
      [item("AGUA PRATA RETORNAVEL C/G 300ML")],
      [prod("AGUA PRATA RETORNAVEL C/G 300ML", "p1"), prod("COCA COLA 310ML", "p2")]
    );
    expect(s).toMatchObject({ produtoId: "p1", confianca: "EXATA", quantidade: 1 });
  });

  it("ignora acento e caixa — os dois cadastros são digitados por gente diferente", () => {
    const [s] = sugerirVinculosPuros([item("Água Prata Retornável")], [prod("AGUA PRATA RETORNAVEL", "p1")]);
    expect(s.confianca).toBe("EXATA");
  });

  it("nome parecido vira PARCIAL, que ninguém aplica em lote", () => {
    const [s] = sugerirVinculosPuros(
      [item("COCA COLA ZERO")],
      [prod("COCA COLA ZERO 310ML LATA", "p1")]
    );
    expect(s).toMatchObject({ produtoId: "p1", confianca: "PARCIAL" });
    expect(sugestoesSegurasPuras([s])).toHaveLength(0);
  });

  it("dois produtos com o mesmo nome: não escolhe sozinho", () => {
    // Escolher o primeiro seria decidir no escuro por quem vai conferir.
    const [s] = sugerirVinculosPuros(
      [item("VINHO MALBEC")],
      [prod("VINHO MALBEC", "p1"), prod("vinho malbec", "p2")]
    );
    expect(s.produtoId).toBeNull();
    expect(s.motivo).toMatch(/2 produtos/);
  });

  it("sem candidato, devolve NENHUMA em vez de chutar", () => {
    const [s] = sugerirVinculosPuros([item("SUCO DE CAJU DA CASA")], [prod("AGUA PRATA", "p1")]);
    expect(s).toMatchObject({ produtoId: null, confianca: "NENHUMA" });
  });

  it("nome curto não gera casamento por prefixo", () => {
    // "GIN" casaria com "GIN TANQUERAY", "GIN BOMBAY"… e com nada em comum.
    const [s] = sugerirVinculosPuros([item("GIN")], [prod("GIN TANQUERAY 750ML", "p1")]);
    expect(s.confianca).toBe("NENHUMA");
  });

  it("só as exatas entram no lote", () => {
    const s = sugerirVinculosPuros(
      [item("AGUA PRATA", "a"), item("COCA", "b")],
      [prod("AGUA PRATA", "p1"), prod("COCA COLA 310ML", "p2")]
    );
    expect(sugestoesSegurasPuras(s).map((x) => x.itemVendaId)).toEqual(["a"]);
  });
});
