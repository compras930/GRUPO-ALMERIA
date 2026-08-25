export function fmtCurrency(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
