/** A mensagem de `{ erro }` devolvida por uma server action, se houver.
 *  Ver `comErro` em src/actions/manutencao.ts — por que o erro volta como
 *  valor em vez de ser lançado. */
export function erroDe(r: unknown): string | null {
  if (r && typeof r === "object" && "erro" in r && typeof (r as any).erro === "string") return (r as any).erro;
  return null;
}
