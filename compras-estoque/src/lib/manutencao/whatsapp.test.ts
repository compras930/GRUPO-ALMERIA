import { describe, it, expect } from "vitest";
import { TEMPLATES, qtdParametros, renderizarTemplate, sanitizarParametro, type NomeTemplate } from "./whatsapp";

describe("modelos do WhatsApp", () => {
  for (const nome of Object.keys(TEMPLATES) as NomeTemplate[]) {
    const corpo = TEMPLATES[nome].corpo;
    it(`${nome}: respeita as regras da Meta`, () => {
      // Não começa nem termina em variável.
      expect(corpo.trim().startsWith("{{")).toBe(false);
      expect(corpo.trim().endsWith("}}")).toBe(false);
      // Variáveis numeradas em sequência, sem pular.
      const nums = (corpo.match(/\{\{(\d+)\}\}/g) ?? []).map((m) => Number(m.replace(/\D/g, "")));
      expect(nums).toEqual(nums.map((_, i) => i + 1));
      // Nunca duas variáveis coladas.
      expect(/\}\}\s*\{\{/.test(corpo)).toBe(false);
      expect(corpo.length).toBeLessThan(1024);
    });
  }

  it("renderiza com os parâmetros na ordem", () => {
    const params = Array.from({ length: qtdParametros("chamado_novo") }, (_, i) => `p${i + 1}`);
    const t = renderizarTemplate("chamado_novo", params);
    expect(t).toContain("nº p1 — p2");
    expect(t).toContain("acesse: p6");
  });
});

describe("sanitizarParametro", () => {
  it("tira quebra de linha e espaço repetido, que a Meta recusa", () => {
    expect(sanitizarParametro("linha 1\nlinha 2\t  fim")).toBe("linha 1 · linha 2 · fim");
    expect(sanitizarParametro("a     b")).toBe("a b");
  });
  it("vazio vira travessão", () => {
    expect(sanitizarParametro("")).toBe("—");
    expect(sanitizarParametro(null)).toBe("—");
  });
  it("corta texto longo", () => {
    expect(sanitizarParametro("x".repeat(700), 100)).toHaveLength(100);
  });
});
