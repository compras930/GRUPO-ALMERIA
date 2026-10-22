import { revalidatePath } from "next/cache";

/**
 * As telas que uma carga do n8n muda.
 *
 * POR QUE UMA LISTA SÓ, e não `revalidatePath` espalhado em cada rota: era
 * assim, e as quatro rotas tinham listas DIFERENTES. Três delas não
 * invalidavam `/dashboard` — justamente o Painel, que é a tela que mostra
 * compra, venda, CMV e curva ABC, e a primeira que alguém abre depois de
 * mandar uma carga para conferir se chegou.
 *
 * O sintoma é cruel porque parece outro problema: a carga responde 200, os
 * números no banco estão certos, e a tela continua mostrando os antigos. Quem
 * vê isso conclui que a carga falhou e manda de novo.
 *
 * A lista é a mesma para todas as rotas de propósito. Invalidar demais custa
 * uma renderização; invalidar de menos custa uma hora de diagnóstico.
 */
const TELAS_DA_CARGA = [
  "/dashboard",
  "/estoque",
  "/estoque/consumo",
  "/estoque/conciliacao",
  "/cmv",
  "/receitas",
  "/produtos",
  "/pedidos",
];

export function revalidarTelasDaCarga() {
  for (const tela of TELAS_DA_CARGA) revalidatePath(tela);
}
