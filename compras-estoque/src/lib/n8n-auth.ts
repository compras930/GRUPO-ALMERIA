// Autenticação das rotas /api/n8n/* — chamadas feitas pelo n8n (fora do
// navegador, sem sessão NextAuth). Token fixo em "Authorization: Bearer
// <token>", comparado em tempo constante contra N8N_API_TOKEN.
//
// Suficiente pra uma integração de confiança única (não é multi-tenant);
// se um dia precisar de mais de uma integração externa, trocar por tokens
// individuais numa tabela é o próximo passo natural.
import { timingSafeEqual } from "node:crypto";

export function verificarTokenN8n(request: Request): boolean {
  const esperado = process.env.N8N_API_TOKEN;
  if (!esperado) return false; // token não configurado no ambiente — nunca autoriza

  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const recebido = auth.slice("Bearer ".length);

  const bufEsperado = Buffer.from(esperado);
  const bufRecebido = Buffer.from(recebido);
  if (bufEsperado.length !== bufRecebido.length) return false;
  return timingSafeEqual(bufEsperado, bufRecebido);
}

export function respostaNaoAutorizada() {
  return Response.json({ erro: "Token inválido ou ausente." }, { status: 401 });
}
