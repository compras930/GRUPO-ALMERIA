// Normaliza nome de produto/receita/item de venda pra comparação e matching
// (import do dashboard, upload de nota de compra, upload de venda semanal).
// Sem isso, "BISTECA FIORENTINA" e "BISTECA FIORENTINA " (variante real
// encontrada nos dados do dashboard-fichas-tecnicas.html) viram dois
// registros diferentes.
export function normalizarNome(nome: string): string {
  return nome.trim().replace(/\s+/g, " ");
}

// Chave de comparação case-insensitive, pra usar em Map/Set de matching
// (ex.: achar o Produto correspondente a uma linha de planilha). Não é o
// valor a persistir — pra persistir, use normalizarNome (mantém a grafia
// original, só limpa espaço).
export function chaveComparacao(nome: string): string {
  return normalizarNome(nome).toLowerCase();
}
