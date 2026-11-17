// Regras puras dos chamados — sem banco, testadas em regras.test.ts.

import { grupoDoStatus } from "./constantes";

/** Minúsculo, sem acento, sem pontuação, espaços únicos. "Câmara Fria 2" e
 *  "camara  fria 2." viram a mesma chave. */
export function chaveTexto(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const k = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return k || null;
}

const PALAVRAS_VAZIAS = new Set([
  "a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "em", "no", "na", "nos", "nas",
  "um", "uma", "com", "sem", "para", "pra", "por", "que", "nao", "esta", "ta", "se", "ao",
]);

function palavras(texto: string): Set<string> {
  const k = chaveTexto(texto) ?? "";
  return new Set(k.split(" ").filter((p) => p.length > 2 && !PALAVRAS_VAZIAS.has(p)));
}

/** Semelhança de Jaccard entre as palavras relevantes de dois textos (0 a 1). */
export function semelhanca(a: string, b: string): number {
  const pa = palavras(a);
  const pb = palavras(b);
  if (pa.size === 0 || pb.size === 0) return 0;
  let comum = 0;
  for (const p of pa) if (pb.has(p)) comum++;
  return comum / (pa.size + pb.size - comum);
}

export type ChamadoComparavel = {
  id: string;
  numero: number;
  unidadeId: string;
  categoria: string;
  titulo: string;
  descricao: string;
  localChave: string | null;
  status: string;
};

/**
 * DUPLICADO = alguém da mesma casa já abriu um chamado para a mesma coisa e
 * ele ainda não acabou. Hoje isso acontece no grupo do WhatsApp toda semana:
 * o turno da noite reabre o que o da manhã já tinha pedido.
 *
 * Critério: mesma casa, mesma categoria, ainda em aberto/andamento, e (mesmo
 * local) OU (texto parecido). Só categoria não basta — a casa pode ter duas
 * tomadas queimadas em lugares diferentes, e isso são dois chamados.
 */
export function possiveisDuplicados<T extends ChamadoComparavel>(
  novo: Pick<ChamadoComparavel, "unidadeId" | "categoria" | "titulo" | "descricao" | "localChave">,
  existentes: T[],
  limiar = 0.34
): T[] {
  const textoNovo = `${novo.titulo} ${novo.descricao}`;
  return existentes.filter((c) => {
    if (c.unidadeId !== novo.unidadeId || c.categoria !== novo.categoria) return false;
    const g = grupoDoStatus(c.status);
    if (g !== "ABERTO" && g !== "ANDAMENTO") return false;
    if (novo.localChave && c.localChave && novo.localChave === c.localChave) return true;
    return semelhanca(textoNovo, `${c.titulo} ${c.descricao}`) >= limiar;
  });
}

/** Prazo final = OK do colaborador + horas combinadas. */
export function calcularPrazoFinal(aceitoEm: Date, prazoHoras: number): Date {
  return new Date(aceitoEm.getTime() + prazoHoras * 3_600_000);
}

/** Atrasado: passou do prazo e o colaborador ainda não terminou. Depois de
 *  concluído, conta se terminou depois do prazo. */
export function estaAtrasado(
  c: { prazoFinal: Date | null; concluidoEm: Date | null; status: string },
  agora: Date = new Date()
): boolean {
  if (!c.prazoFinal) return false;
  if (c.concluidoEm) return c.concluidoEm.getTime() > c.prazoFinal.getTime();
  if (c.status !== "EM_ANDAMENTO") return false;
  return agora.getTime() > c.prazoFinal.getTime();
}

/** "2 d 4 h", "3 h 20 min", "45 min" — duração legível para a tela e o relatório. */
export function fmtDuracao(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const neg = ms < 0;
  let min = Math.round(Math.abs(ms) / 60_000);
  const d = Math.floor(min / 1440);
  min -= d * 1440;
  const h = Math.floor(min / 60);
  min -= h * 60;
  let s: string;
  if (d > 0) s = h > 0 ? `${d} d ${h} h` : `${d} d`;
  else if (h > 0) s = min > 0 ? `${h} h ${min} min` : `${h} h`;
  else s = `${min} min`;
  return neg ? `-${s}` : s;
}

/**
 * Telefone para o WhatsApp: só dígitos, com DDI 55. Aceita como as pessoas
 * digitam — "(61) 99999-1234", "61999991234", "+55 61 9 9999 1234".
 * Devolve null se não parecer um celular/fixo brasileiro ou internacional.
 */
export function normalizarTelefone(bruto: string | null | undefined): string | null {
  if (!bruto) return null;
  let d = bruto.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = `55${d}`; // DDD + número, sem DDI
  if (d.length < 12 || d.length > 15) return null;
  return d;
}

/** "5561999991234" → "(61) 99999-1234". */
export function fmtTelefone(norm: string | null | undefined): string {
  if (!norm) return "—";
  if (norm.startsWith("55") && (norm.length === 12 || norm.length === 13)) {
    const ddd = norm.slice(2, 4);
    const n = norm.slice(4);
    return n.length === 9 ? `(${ddd}) ${n.slice(0, 5)}-${n.slice(5)}` : `(${ddd}) ${n.slice(0, 4)}-${n.slice(4)}`;
  }
  return `+${norm}`;
}

const FUSO = "America/Sao_Paulo";

export function fmtDataHora(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleString("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtData(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" });
}
