import * as XLSX from "xlsx";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { podeGerenciarManutencao } from "@/lib/permissions";
import { chamadosDoPeriodo, escopoChamados, periodoDosParametros } from "@/lib/manutencao/consultas";
import { montarRelatorio, temposDoChamado, type LinhaAgrupada } from "@/lib/manutencao/relatorio";
import { estaAtrasado, fmtDataHora, fmtDuracao } from "@/lib/manutencao/regras";
import { STATUS_CHAMADO_LABEL, URGENCIA_LABEL, rotuloCategoria, type StatusChamado, type Urgencia } from "@/lib/manutencao/constantes";

const horas = (ms: number | null) => (ms == null ? "" : Math.round((ms / 3_600_000) * 10) / 10);

function folhaAgrupada(linhas: LinhaAgrupada[], rotulo: string) {
  return XLSX.utils.json_to_sheet(
    linhas.map((l) => ({
      [rotulo]: l.rotulo,
      Chamados: l.total,
      "Em aberto": l.emAberto,
      "Em andamento": l.emAndamento,
      Finalizados: l.finalizados,
      Atrasados: l.atrasados,
      Reprovações: l.reprovacoes,
      "Execução média (h)": horas(l.tempoMedioExecucao),
      "Resolução média (h)": horas(l.tempoMedioTotal),
    }))
  );
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !podeGerenciarManutencao(session.user.papel)) return new Response("Sem acesso.", { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const { deIso, ateIso, de, ate } = periodoDosParametros(sp);
  const escopo = escopoChamados({ papel: session.user.papel, unidadeId: session.user.unidadeId ?? null }, sp.casa || null);
  const cs = await chamadosDoPeriodo(de, ate, escopo);
  const agora = new Date();
  const r = montarRelatorio(cs, agora);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      cs.map((c) => {
        const t = temposDoChamado(c);
        return {
          Nº: c.numero,
          Casa: c.unidade,
          Categoria: rotuloCategoria(c.categoria),
          Urgência: URGENCIA_LABEL[c.urgencia as Urgencia] ?? c.urgencia,
          Problema: c.titulo,
          Local: c.local ?? "",
          Situação: STATUS_CHAMADO_LABEL[c.status as StatusChamado] ?? c.status,
          Colaborador: c.colaborador ?? "",
          Abertura: fmtDataHora(c.abertoEm),
          Triagem: fmtDataHora(c.triadoEm),
          "Atendimento (OK)": fmtDataHora(c.aceitoEm),
          "Prazo final": fmtDataHora(c.prazoFinal),
          "Serviço concluído": fmtDataHora(c.concluidoEm),
          "Resolução (aprovado)": fmtDataHora(c.finalizadoEm),
          "Até triagem (h)": horas(t.triagem),
          "Até o OK (h)": horas(t.resposta),
          "Execução (h)": horas(t.execucao),
          "Total (h)": horas(t.total),
          Atrasado: estaAtrasado(c, agora) ? "Sim" : "",
          Reprovações: c.reprovacoes,
          Duplicado: c.duplicadoDeId ? "Sim" : "",
        };
      })
    ),
    "Chamados"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Período", `${deIso} a ${ateIso}`],
      ["Chamados abertos", r.total],
      ["Finalizados", r.finalizados],
      ["Em andamento", r.emAndamento],
      ["Em aberto", r.emAberto],
      ["Atrasados", r.atrasados],
      ["Concluídos no prazo (%)", r.noPrazoPct == null ? "" : Math.round(r.noPrazoPct)],
      ["Duplicados", r.duplicados],
      ["Recusados", r.recusados],
      ["Reprovações", r.reprovacoes],
      ["Tempo médio até triagem", fmtDuracao(r.tempos.triagem)],
      ["Tempo médio até o OK", fmtDuracao(r.tempos.resposta)],
      ["Execução média", fmtDuracao(r.tempos.execucao)],
      ["Resolução média", fmtDuracao(r.tempos.total)],
    ]),
    "Resumo"
  );
  XLSX.utils.book_append_sheet(wb, folhaAgrupada(r.porCategoria, "Categoria"), "Por categoria");
  XLSX.utils.book_append_sheet(wb, folhaAgrupada(r.porUnidade, "Casa"), "Por casa");
  XLSX.utils.book_append_sheet(wb, folhaAgrupada(r.porColaborador, "Colaborador"), "Por colaborador");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      r.repetidos.map((g) => ({
        Casa: g.unidade,
        Categoria: g.categoria,
        Local: g.local,
        Chamados: g.numeros.join(", "),
        "Em quantos dias": g.intervaloDias,
      }))
    ),
    "Repetidos"
  );
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="manutencao-${deIso}-a-${ateIso}.xlsx"`,
    },
  });
}
