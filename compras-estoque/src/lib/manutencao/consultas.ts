// Consultas de banco do módulo — escopo por quem está olhando e a carga do
// relatório. A conta em si é pura (relatorio.ts).

import { prisma } from "@/lib/prisma";
import type { Papel } from "@/lib/constants";
import { ehAgente, veTodosOsChamados } from "@/lib/permissions";
import type { ChamadoRelatorio } from "./relatorio";

/** Filtro de casa: quem não vê tudo vê só a própria. */
export function escopoChamados(
  user: { id?: string; papel: Papel; unidadeId: string | null },
  unidadeFiltro?: string | null
) {
  if (veTodosOsChamados(user.papel)) return unidadeFiltro ? { unidadeId: unidadeFiltro } : {};
  // Agente: os encaminhados a ele, de qualquer casa.
  if (ehAgente(user.papel)) return { colaborador: { usuarioId: user.id ?? "__ninguem__" } };
  return { unidadeId: user.unidadeId ?? "__nenhuma__" };
}

/** Chamados ABERTOS no período [de, ate). */
export async function chamadosDoPeriodo(de: Date, ate: Date, escopo: object): Promise<ChamadoRelatorio[]> {
  const cs = await prisma.chamadoManutencao.findMany({
    where: { ...escopo, abertoEm: { gte: de, lt: ate } },
    include: { unidade: { select: { nome: true } }, colaborador: { select: { nome: true, interno: true } } },
    orderBy: { abertoEm: "asc" },
  });
  return cs.map((c) => ({
    id: c.id,
    numero: c.numero,
    status: c.status,
    unidade: c.unidade.nome,
    unidadeId: c.unidadeId,
    categoria: c.categoria,
    urgencia: c.urgencia,
    titulo: c.titulo,
    local: c.local,
    localChave: c.localChave,
    colaborador: c.colaborador?.nome ?? null,
    colaboradorInterno: c.colaborador?.interno ?? null,
    abertoEm: c.abertoEm,
    triadoEm: c.triadoEm,
    encaminhadoEm: c.encaminhadoEm,
    aceitoEm: c.aceitoEm,
    prazoFinal: c.prazoFinal,
    concluidoEm: c.concluidoEm,
    finalizadoEm: c.finalizadoEm,
    reprovacoes: c.reprovacoes,
    duplicadoDeId: c.duplicadoDeId,
  }));
}

/** "2026-11-01" → Date à meia-noite de Brasília. */
export function inicioDoDiaBrasilia(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isoBrasilia(d: Date): string {
  return d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

/** Período padrão do relatório: últimos 30 dias, incluindo hoje. */
export function periodoDosParametros(sp: { de?: string; ate?: string }) {
  const hoje = isoBrasilia(new Date());
  const ateIso = sp.ate && inicioDoDiaBrasilia(sp.ate) ? sp.ate : hoje;
  const ateExclusivo = new Date(inicioDoDiaBrasilia(ateIso)!.getTime() + 86_400_000);
  const deIso =
    sp.de && inicioDoDiaBrasilia(sp.de) ? sp.de : isoBrasilia(new Date(ateExclusivo.getTime() - 30 * 86_400_000));
  return { deIso, ateIso, de: inicioDoDiaBrasilia(deIso)!, ate: ateExclusivo };
}
