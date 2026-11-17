// O relatório semanal que vai pelo WhatsApp toda segunda-feira.

import { prisma } from "@/lib/prisma";
import { chamadosDoPeriodo, isoBrasilia, inicioDoDiaBrasilia } from "./consultas";
import { montarRelatorio } from "./relatorio";
import { fmtDuracao } from "./regras";
import { enviarTemplate, urlBase } from "./whatsapp";
import { fmtTelefone } from "./regras";

/** A semana fechada anterior a `hoje`: segunda a domingo, em Brasília. */
export function semanaAnterior(hoje: Date) {
  const isoHoje = isoBrasilia(hoje);
  const meiaNoite = inicioDoDiaBrasilia(isoHoje)!;
  const diaSemana = new Date(`${isoHoje}T12:00:00Z`).getUTCDay(); // 0 = domingo
  const desdeSegunda = (diaSemana + 6) % 7;
  const ate = new Date(meiaNoite.getTime() - desdeSegunda * 86_400_000); // segunda desta semana, 00:00
  const de = new Date(ate.getTime() - 7 * 86_400_000);
  return { de, ate, deIso: isoBrasilia(de), ateIso: isoBrasilia(new Date(ate.getTime() - 1)) };
}

export async function montarResumoSemanal(hoje = new Date()) {
  const { de, ate, deIso, ateIso } = semanaAnterior(hoje);
  const [abertosNaSemana, finalizadosNaSemana, emAberto, emAndamento, atrasados] = await Promise.all([
    chamadosDoPeriodo(de, ate, {}),
    prisma.chamadoManutencao.findMany({
      where: { status: "FINALIZADO", finalizadoEm: { gte: de, lt: ate } },
      select: { abertoEm: true, finalizadoEm: true },
    }),
    prisma.chamadoManutencao.count({ where: { status: { in: ["ABERTO", "ENCAMINHADO"] } } }),
    prisma.chamadoManutencao.count({ where: { status: { in: ["EM_ANDAMENTO", "AGUARDANDO_APROVACAO"] } } }),
    prisma.chamadoManutencao.count({ where: { status: "EM_ANDAMENTO", prazoFinal: { lt: hoje } } }),
  ]);
  const r = montarRelatorio(abertosNaSemana, hoje);
  const resolucoes = finalizadosNaSemana.map((c) => c.finalizadoEm!.getTime() - c.abertoEm.getTime());
  const mediaResolucao = resolucoes.length ? resolucoes.reduce((s, x) => s + x, 0) / resolucoes.length : null;
  const top = r.porCategoria[0];
  const fmt = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");
  return {
    periodo: `${fmt(deIso)} a ${fmt(ateIso)}`,
    abertos: r.total,
    finalizados: finalizadosNaSemana.length,
    emAberto,
    emAndamento,
    atrasados,
    resolucaoMedia: fmtDuracao(mediaResolucao),
    maiorDemanda: top ? `${top.rotulo} (${top.total})` : "nenhuma",
    link: `${urlBase()}/manutencao/relatorio?de=${deIso}&ate=${ateIso}`,
  };
}

export async function enviarResumoSemanal(hoje = new Date()) {
  const resumo = await montarResumoSemanal(hoje);
  const destinos = await prisma.contatoUsuario.findMany({
    where: { recebeRelatorioSemanal: true, usuario: { ativo: true } },
    include: { usuario: { select: { nome: true } } },
  });
  const params = [
    resumo.periodo,
    resumo.abertos,
    resumo.finalizados,
    resumo.emAberto,
    resumo.emAndamento,
    resumo.atrasados,
    resumo.resolucaoMedia,
    resumo.maiorDemanda,
    resumo.link,
  ];
  const envios = [];
  for (const d of destinos) {
    const r = await enviarTemplate(d.telefone, "relatorio_semanal_manutencao", params);
    envios.push({ para: `${d.usuario.nome} (${fmtTelefone(d.telefone)})`, ok: r.ok, erro: r.ok ? null : r.motivo });
  }
  return { resumo, envios };
}
