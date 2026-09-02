import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { carregarIndiceReceitas, explodirReceitaPura, CicloReceitaError } from "@/lib/receita";

export default async function ReceitasPage({ searchParams }: { searchParams: { unidade?: string } }) {
  await requireAdmin();
  const unidades = await prisma.unidade.findMany({ orderBy: { nome: "asc" } });
  const unidadeSelecionada = unidades.find((u) => u.id === searchParams.unidade) ?? unidades[0];

  if (!unidadeSelecionada) {
    return <div className="empty">Nenhuma unidade cadastrada ainda.</div>;
  }

  const receitas = await prisma.receita.findMany({
    where: { unidadeId: unidadeSelecionada.id },
    orderBy: { nome: "asc" },
    include: {
      itensVenda: { select: { nome: true, tipo: true } },
      usadaComoSubReceitaEm: { select: { receita: { select: { nome: true } } } },
    },
  });

  const indice = await carregarIndiceReceitas(unidadeSelecionada.id);

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">Cadastros</p>
        <h1>Sub-receitas</h1>
        <p className="sub">
          Preparos-base (molhos, marinadas, massas...) usados como ingrediente dentro de outras
          fichas. Pratos/bebidas/vinhos vendidos direto se editam em <Link href="/cmv">CMV</Link>.
        </p>
      </div>

      <div className="field-row" style={{ marginBottom: 18, alignItems: "flex-end" }}>
        <div className="field-group">
          <label htmlFor="unidade">Unidade</label>
          <form method="get" style={{ display: "flex", gap: 8 }}>
            <select id="unidade" name="unidade" defaultValue={unidadeSelecionada.id}>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
            <button className="btn small" type="submit">
              Ver
            </button>
          </form>
        </div>
        <div className="field-group" style={{ marginLeft: "auto" }}>
          <Link href={`/receitas/nova?unidade=${unidadeSelecionada.id}`} className="btn primary">
            + Nova sub-receita
          </Link>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Rendimento</th>
            <th>Usada em</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {receitas.map((r) => {
            const usos: string[] = [
              ...r.itensVenda.map((iv) => iv.nome),
              ...r.usadaComoSubReceitaEm.map((i) => i.receita.nome),
            ];
            let status: "OK" | "CICLO" = "OK";
            try {
              explodirReceitaPura(r.id, 1, indice);
            } catch (e) {
              if (e instanceof CicloReceitaError) status = "CICLO";
              else throw e;
            }
            return (
              <tr key={r.id}>
                <td>{r.nome}</td>
                <td>{r.rendimentoQtd ? `${r.rendimentoQtd} ${r.rendimentoUnidade ?? ""}` : "—"}</td>
                <td>
                  {usos.length === 0 ? (
                    <span className="sub">não usada em nenhuma ficha ainda</span>
                  ) : (
                    [...new Set(usos)].join(", ")
                  )}
                </td>
                <td>
                  {status === "OK" && <span className="tag ok">OK</span>}
                  {status === "CICLO" && <span className="tag bad">Ciclo pendente</span>}
                </td>
                <td className="num">
                  <Link href={`/receitas/${r.id}`} className="btn small">
                    Editar
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
