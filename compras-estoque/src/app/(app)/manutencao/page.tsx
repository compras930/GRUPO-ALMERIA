import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { podeGerenciarManutencao, veTodosOsChamados } from "@/lib/permissions";
import {
  GRUPO_PAINEL_LABEL,
  STATUS_DO_GRUPO,
  rotuloCategoria,
  type GrupoPainel,
} from "@/lib/manutencao/constantes";
import { estaAtrasado, fmtDataHora, fmtDuracao } from "@/lib/manutencao/regras";
import { escopoChamados } from "@/lib/manutencao/consultas";
import TagStatus, { classeGrupo } from "@/components/manutencao/TagStatus";
import SubmenuManutencao from "@/components/manutencao/SubmenuManutencao";

const FILTROS: { chave: string; rotulo: string; grupos: GrupoPainel[] }[] = [
  { chave: "ativos", rotulo: "Abertos e em andamento", grupos: ["ABERTO", "ANDAMENTO"] },
  { chave: "aberto", rotulo: "Em aberto", grupos: ["ABERTO"] },
  { chave: "andamento", rotulo: "Em andamento", grupos: ["ANDAMENTO"] },
  { chave: "finalizado", rotulo: "Finalizados", grupos: ["FINALIZADO"] },
  { chave: "encerrado", rotulo: "Recusados / cancelados", grupos: ["ENCERRADO"] },
  { chave: "todos", rotulo: "Todos", grupos: ["ABERTO", "ANDAMENTO", "FINALIZADO", "ENCERRADO"] },
];

export default async function PainelManutencao({
  searchParams,
}: {
  searchParams: { filtro?: string; casa?: string };
}) {
  const user = await requireSession();
  const todas = veTodosOsChamados(user.papel);
  const casas = todas
    ? await prisma.unidade.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } })
    : [];
  const casa = todas && searchParams.casa ? searchParams.casa : null;
  const escopo = escopoChamados({ papel: user.papel, unidadeId: user.unidadeId ?? null }, casa);
  const filtro = FILTROS.find((f) => f.chave === searchParams.filtro) ?? FILTROS[0];
  const agora = new Date();
  const trintaDias = new Date(agora.getTime() - 30 * 86_400_000);

  const [contagem, finalizados30, chamados] = await Promise.all([
    prisma.chamadoManutencao.groupBy({ by: ["status"], where: escopo, _count: true }),
    prisma.chamadoManutencao.count({ where: { ...escopo, status: "FINALIZADO", finalizadoEm: { gte: trintaDias } } }),
    prisma.chamadoManutencao.findMany({
      where: {
        ...escopo,
        status: { in: filtro.grupos.flatMap((g) => STATUS_DO_GRUPO[g]) },
        // Finalizado e encerrado acumulam para sempre; no painel, só os recentes.
        ...(filtro.grupos.includes("ABERTO") ? {} : { abertoEm: { gte: new Date(agora.getTime() - 90 * 86_400_000) } }),
      },
      include: { unidade: { select: { nome: true } }, colaborador: { select: { nome: true } } },
      orderBy: [{ abertoEm: "desc" }],
      take: 300,
    }),
  ]);
  const qtd = (g: GrupoPainel) =>
    contagem.filter((c) => STATUS_DO_GRUPO[g].includes(c.status as never)).reduce((s, c) => s + c._count, 0);
  const atrasados = await prisma.chamadoManutencao.count({
    where: { ...escopo, status: "EM_ANDAMENTO", prazoFinal: { lt: agora } },
  });
  const qs = (o: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const v = { filtro: filtro.chave, casa, ...o };
    for (const [k, x] of Object.entries(v)) if (x) p.set(k, x);
    return `?${p.toString()}`;
  };

  return (
    <div>
      <div className="page-header cabecalho-acao">
        <div>
          <p className="eyebrow">Manutenção</p>
          <h1>Chamados</h1>
        </div>
        <Link href="/manutencao/novo" className="btn primary">
          + Abrir chamado
        </Link>
      </div>
      <SubmenuManutencao papel={user.papel} />

      <div className="kpis">
        <Link href={qs({ filtro: "aberto" })} className="kpi bad">
          <p className="lbl">🔴 {GRUPO_PAINEL_LABEL.ABERTO}</p>
          <p className="val">{qtd("ABERTO")}</p>
        </Link>
        <Link href={qs({ filtro: "andamento" })} className="kpi warn">
          <p className="lbl">🟡 {GRUPO_PAINEL_LABEL.ANDAMENTO}</p>
          <p className="val">{qtd("ANDAMENTO")}</p>
        </Link>
        <Link href={qs({ filtro: "finalizado" })} className="kpi ok">
          <p className="lbl">🟢 Finalizados (30 dias)</p>
          <p className="val">{finalizados30}</p>
        </Link>
        <div className={`kpi ${atrasados ? "bad" : ""}`}>
          <p className="lbl">Fora do prazo agora</p>
          <p className="val">{atrasados}</p>
        </div>
      </div>

      <div className="tabbar discreta" style={{ marginBottom: 12 }}>
        {FILTROS.map((f) => (
          <Link key={f.chave} href={qs({ filtro: f.chave })} className={`chip${f.chave === filtro.chave ? " ativo" : ""}`}>
            {f.rotulo}
          </Link>
        ))}
      </div>
      {todas && (
        <div className="tabbar discreta" style={{ marginBottom: 18 }}>
          <Link href={qs({ casa: null })} className={`chip${!casa ? " ativo" : ""}`}>
            Todas as casas
          </Link>
          {casas.map((c) => (
            <Link key={c.id} href={qs({ casa: c.id })} className={`chip${casa === c.id ? " ativo" : ""}`}>
              {c.nome}
            </Link>
          ))}
        </div>
      )}

      {chamados.length === 0 ? (
        <div className="empty">Nenhum chamado aqui.</div>
      ) : (
        <div className="tabela-rolavel">
          <table className="tabela-chamados">
            <thead>
              <tr>
                <th>Nº</th>
                {todas && <th>Casa</th>}
                <th>Problema</th>
                <th>Situação</th>
                <th>Quem atende</th>
                <th>Aberto em</th>
                <th>Prazo</th>
              </tr>
            </thead>
            <tbody>
              {chamados.map((c) => {
                const atrasado = estaAtrasado(c, agora);
                return (
                  <tr key={c.id} className={classeGrupo(c.status)}>
                    <td>
                      <Link href={`/manutencao/${c.id}`}>
                        <strong>{c.numero}</strong>
                      </Link>
                    </td>
                    {todas && <td>{c.unidade.nome}</td>}
                    <td className="col-problema">
                      <Link href={`/manutencao/${c.id}`}>{c.titulo}</Link>
                      <div className="cat">
                        {rotuloCategoria(c.categoria)}
                        {c.local ? ` · ${c.local}` : ""}
                        {c.urgencia === "URGENTE" ? " · URGENTE" : ""}
                      </div>
                    </td>
                    <td>
                      <TagStatus status={c.status} atrasado={atrasado} />
                    </td>
                    <td>{c.colaborador?.nome ?? "—"}</td>
                    <td className="cat sem-quebra">{fmtDataHora(c.abertoEm)}</td>
                    <td className="cat">
                      {c.prazoFinal && c.status === "EM_ANDAMENTO"
                        ? atrasado
                          ? `vencido há ${fmtDuracao(agora.getTime() - c.prazoFinal.getTime())}`
                          : `faltam ${fmtDuracao(c.prazoFinal.getTime() - agora.getTime())}`
                        : c.prazoFinal
                          ? fmtDataHora(c.prazoFinal)
                          : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {podeGerenciarManutencao(user.papel) && qtd("ABERTO") > 0 && filtro.chave !== "aberto" && (
        <p className="hint" style={{ marginTop: 12 }}>
          Chamados em vermelho esperam triagem ou o OK do colaborador.
        </p>
      )}
    </div>
  );
}
