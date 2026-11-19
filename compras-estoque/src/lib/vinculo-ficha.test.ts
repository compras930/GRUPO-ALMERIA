import { describe, it, expect } from "vitest";
import { casamentosSegurosPuros } from "@/lib/casamento-por-nome";
import { sugerirFichasPuras, semPrefixoDeTipo, conjuntoDePalavras } from "@/lib/vinculo-ficha";

const item = (nome: string, id = nome) => ({ id, nome });
const ficha = (nome: string, id = nome) => ({ id, nome });

describe("sugerir a ficha de cada item do cardápio", () => {
  it("nome idêntico vira EXATA e entra no lote", () => {
    const [s] = sugerirFichasPuras([item("ACQUA PAZZA")], [ficha("Acqua Pazza", "f1")]);
    expect(s).toMatchObject({ candidatoId: "f1", confianca: "EXATA" });
    expect(casamentosSegurosPuros([s])).toHaveLength(1);
  });

  it("a montagem casa com o prato do cardápio — mas só como PARCIAL", () => {
    // "MONTAGEM - " é marcação de tipo na planilha do chef, não parte do nome.
    // Sem tirar o prefixo, nenhuma montagem acha o prato que ela monta.
    const [s] = sugerirFichasPuras(
      [item("Tartar de Atum")],
      [ficha("MONTAGEM - TARTAR DE ATUM", "f1")]
    );
    expect(s).toMatchObject({ candidatoId: "f1", confianca: "PARCIAL" });
    // E PARCIAL fica de fora do botão de lote, de propósito.
    expect(casamentosSegurosPuros([s])).toHaveLength(0);
  });

  it("palavra a mais, ordem trocada e ligação diferente ainda casam", () => {
    const [s] = sugerirFichasPuras(
      [item("Salada de Quinoa e Feijão")],
      [ficha("SALADA DE QUINOA COM FEIJÃO", "f1")]
    );
    expect(s).toMatchObject({ candidatoId: "f1", confianca: "PARCIAL" });
  });

  it("montagem com o marcador no fim do nome também casa", () => {
    const [s] = sugerirFichasPuras(
      [item("Rigatoni Amatriciana")],
      [ficha("RIGATONI AMATRICIANA MONTAGEM", "f1")]
    );
    expect(s.candidatoId).toBe("f1");
  });

  it("duas fichas com o mesmo nome: não escolhe sozinho", () => {
    const [s] = sugerirFichasPuras(
      [item("FALAFEL")],
      [ficha("FALAFEL", "f1"), ficha("falafel", "f2")]
    );
    expect(s.candidatoId).toBeNull();
    expect(s.motivo).toMatch(/2 com esse mesmo nome/);
  });

  it("sem candidato, devolve NENHUMA em vez de chutar", () => {
    const [s] = sugerirFichasPuras([item("Pudim da Casa")], [ficha("ACQUA PAZZA", "f1")]);
    expect(s).toMatchObject({ candidatoId: null, confianca: "NENHUMA" });
  });

  it("o prefixo não engole o nome: SB - BECHAMEL continua bechamel", () => {
    expect(semPrefixoDeTipo("SB - BECHAMEL")).toBe("bechamel");
    expect(semPrefixoDeTipo("SB- COMPOTA DE TOMATE")).toBe("compota de tomate");
    // "SOBRASSADA" começa com SB como letras, não como marcação.
    expect(semPrefixoDeTipo("SOBRASSADA")).toBe("sobrassada");
  });

  it("conjunto ignora ordem e palavra de ligação", () => {
    expect(conjuntoDePalavras("MOLHO DE TOMATE")).toBe(conjuntoDePalavras("TOMATE MOLHO"));
  });

  it("a ficha que já está ligada a outro prato continua sendo oferecida", () => {
    // Quem decide se duas linhas do cardápio dividem a mesma ficha é a casa:
    // meia porção e porção inteira são o caso comum.
    const s = sugerirFichasPuras(
      [item("Acqua Pazza", "a"), item("ACQUA PAZZA", "b")],
      [ficha("ACQUA PAZZA", "f1")]
    );
    expect(s.map((x) => x.candidatoId)).toEqual(["f1", "f1"]);
  });
});
