import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireGestaoManutencao } from "@/lib/manutencao/guarda";
import { chamadosDoPeriodo, escopoChamados, periodoDosParametros } from "@/lib/manutencao/consultas";
import { montarRelatorio, temposDoChamado, type LinhaAgrupada } from "@/lib/manutencao/relatorio";
import { estaAtrasado, fmtDataHora, fmtDuracao } from "@/lib/manutencao/regras";
import { rotuloCategoria } from "@/lib/manutencao/constantes";
import TagStatus from "@/components/manutencao/TagStatus";

function Tabela({ titulo, linhas, rotulo }: { titulo: string; linhas: LinhaAgrupada[]; rotulo: string }) {
  if (linhas.length === 0) return null;
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 className="titulo-secao">{titulo}</h2>
      <div className="tabela-rolavel">
        <table>
          <thead>
            <tr>
              <th>{rotulo}</th>
              <th className="num">Chamados</th>
              <th className="num">Em aberto</th>
              <th className="num">Andamento</th>
              <th className="num">Finalizados</th>
              <th className="num">Atrasados</th>
              <th className="num">Reprovações</th>
              <th className="num">Execução média</th>
              <th className="num">Resolução média</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.chave}>
                <td>{l.rotulo}</td>
                <td className="num">
                  <strong>{l.total}</strong>
                </td>
                <td className="num">{l.emAberto || ""}</td>
                <td className="num">{l.emAndamento || ""}</td>
                <td className="num">{l.finalizados || ""}</td>
                <td className="num">{l.atrasados || ""}</td>
                <td className="num">{l.reprovacoes || ""}</td>
                <td className="num">{fmtDuracao(l.tempoMedioExecucao)}</td>
                <td className="num">{fmtDuracao(l.tempoMedioTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function RelatorioManutencao({
  searchParams,
}: {
  searchParams: { de?: string; ate?: string; casa?: string };
}) {
  const user = await requireGestaoManutencao();
  const { deIso, ateIso, de, ate } = periodoDosParametros(searchParams);
  const casas = await prisma.unidade.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } });
  const casa = searchParams.casa || null;
  const escopo = escopoChamados({ papel: user.papel, unidadeId: user.unidadeId ?? null }, casa);
  const chamados = await chamadosDoPeriodo(de, ate, escopo);
  const agora = new Date();
  const r = montarRelatorio(chamados, agora);
  const exportar = `/api/manutencao/relatorio?${new URLSearchParams({ de: deIso, ate: ateIso, ...(casa ? { casa } : {}) })}`;

  return (
    <div>
      <div className="page-header cabecalho-acao">
        <div>
          <p className="eyebrow">
            <Link href="/manutencao">Manutenção</Link>
          </p>
          <h1>Relatório de manutenção</h1>
        </div>
        <a href={exportar} className="btn">
          Baixar Excel
        </a>
      </div>

      <form className="card filtros" method="get">
        <div className="field-row" style={{ marginBottom: 0, alignItems: "flex-end" }}>
          <div className="field-group">
            <label htmlFor="de">Abertos de</label>
            <input id="de" name="de" type="date" defaultValue={deIso} />
          </div>
          <div className="field-group">
            <label htmlFor="ate">até</label>
            <input id="ate" name="ate" type="date" defaultValue={ateIso} />
          </div>
          <div className="field-group">
            <label htmlFor="casa">Casa</label>
            <select id="casa" name="casa" defaultValue={casa ?? ""}>
              <option value="">Todas</option>
              {casas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <button className="btn primary" type="submit">
            Filtrar
          </button>
        </div>
      </form>

      <div className="kpis">
        <div className="kpi destaque">
          <p className="lbl">Chamados no período</p>
          <p className="val">{r.total}</p>
        </div>
        <div className="kpi ok">
          <p className="lbl">🟢 Finalizados</p>
          <p className="val">{r.finalizados}</p>
        </div>
        <div className="kpi warn">
          <p className="lbl">🟡 Em andamento</p>
          <p className="val">{r.emAndamento}</p>
        </div>
        <div className="kpi bad">
          <p className="lbl">🔴 Em aberto</p>
          <p className="val">{r.emAberto}</p>
        </div>
      </div>
      <div className="kpis">
        <div className="kpi">
          <p className="lbl">Tempo até triagem</p>
          <p className="val pequeno">{fmtDuracao(r.tempos.triagem)}</p>
        </div>
        <div className="kpi">
          <p className="lbl">Tempo até o OK</p>
          <p className="val pequeno">{fmtDuracao(r.tempos.resposta)}</p>
        </div>
        <div className="kpi">
          <p className="lbl">Execução média</p>
          <p className="val pequeno">{fmtDuracao(r.tempos.execucao)}</p>
        </div>
        <div className="kpi destaque">
          <p className="lbl">Resolução média (total)</p>
          <p className="val pequeno">{fmtDuracao(r.tempos.total)}</p>
        </div>
      </div>
      <div className="kpis">
        <div className="kpi">
          <p className="lbl">Concluídos no prazo</p>
          <p className="val pequeno">{r.noPrazoPct == null ? "—" : `${Math.round(r.noPrazoPct)}%`}</p>
        </div>
        <div className={`kpi ${r.atrasados ? "bad" : ""}`}>
          <p className="lbl">Atrasados</p>
          <p className="val pequeno">{r.atrasados}</p>
        </div>
        <div className="kpi">
          <p className="lbl">Serviços reprovados</p>
          <p className="val pequeno">{r.reprovacoes}</p>
        </div>
        <div className="kpi">
          <p className="lbl">Duplicados · Recusados</p>
          <p className="val pequeno">
            {r.duplicados} · {r.recusados}
          </p>
        </div>
      </div>

      <Tabela titulo="Maiores demandas — por categoria" linhas={r.porCategoria} rotulo="Categoria" />
      <Tabela titulo="Por casa" linhas={r.porUnidade} rotulo="Casa" />
      <Tabela titulo="Por colaborador" linhas={r.porColaborador} rotulo="Colaborador" />
      <Tabela titulo="Locais / equipamentos com mais de um chamado" linhas={r.porLocal} rotulo="Local" />

      <div style={{ marginBottom: 24 }}>
        <h2 className="titulo-secao">Chamados repetidos (mesmo problema voltando em até 30 dias)</h2>
        {r.repetidos.length === 0 ? (
          <p className="hint">Nenhuma repetição no período.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Casa</th>
                <th>Categoria</th>
                <th>Local</th>
                <th>Chamados</th>
                <th className="num">Em quantos dias</th>
              </tr>
            </thead>
            <tbody>
              {r.repetidos.map((g, i) => (
                <tr key={i}>
                  <td>{g.unidade}</td>
                  <td>{g.categoria}</td>
                  <td>{g.local}</td>
                  <td>{g.numeros.map((n) => `nº ${n}`).join(", ")}</td>
                  <td className="num">{g.intervaloDias}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="titulo-secao">Todos os chamados do período</h2>
      <div className="tabela-rolavel">
        <table>
          <thead>
            <tr>
              <th>Nº</th>
              <th>Casa</th>
              <th>Problema</th>
              <th>Situação</th>
              <th>Abertura</th>
              <th>Atendimento (OK)</th>
              <th>Resolução</th>
              <th className="num">Tempo total</th>
            </tr>
          </thead>
          <tbody>
            {[...chamados].reverse().map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/manutencao/${c.id}`}>{c.numero}</Link>
                </td>
                <td>{c.unidade}</td>
                <td>
                  {c.titulo}
                  <div className="cat">
                    {rotuloCategoria(c.categoria)}
                    {c.colaborador ? ` · ${c.colaborador}` : ""}
                  </div>
                </td>
                <td>
                  <TagStatus status={c.status} atrasado={estaAtrasado(c, agora)} />
                </td>
                <td className="cat sem-quebra">{fmtDataHora(c.abertoEm)}</td>
                <td className="cat sem-quebra">{fmtDataHora(c.aceitoEm)}</td>
                <td className="cat sem-quebra">{fmtDataHora(c.finalizadoEm)}</td>
                <td className="num">{fmtDuracao(temposDoChamado(c).total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
