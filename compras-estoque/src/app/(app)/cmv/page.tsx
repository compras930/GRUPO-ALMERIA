import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { listarItensComCusto } from "@/lib/cmv";
import { fmtCurrency } from "@/lib/format";
import { TIPO_ITEM_VENDA, TIPO_ITEM_VENDA_LABEL, type TipoItemVenda } from "@/lib/constants";

function fmtPct(v: number | null) {
  if (v === null) return "—";
  return (v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}

export default async function CmvPage({
  searchParams,
}: {
  searchParams: { unidade?: string; tipo?: string };
}) {
  await requireAdmin();
  const unidades = await prisma.unidade.findMany({ orderBy: { nome: "asc" } });
  const unidadeSelecionada = unidades.find((u) => u.id === searchParams.unidade) ?? unidades[0];
  const tipo = (TIPO_ITEM_VENDA as readonly string[]).includes(searchParams.tipo || "")
    ? (searchParams.tipo as TipoItemVenda)
    : "PRATO";

  if (!unidadeSelecionada) {
    return <div className="empty">Nenhuma unidade cadastrada ainda.</div>;
  }

  const itens = await listarItensComCusto(unidadeSelecionada.id, tipo);
  const meta =
    tipo === "PRATO"
      ? unidadeSelecionada.metaCmvPratos
      : tipo === "BEBIDA"
        ? unidadeSelecionada.metaCmvBebidas
        : unidadeSelecionada.metaCmvVinhos;

  const comFicha = itens.filter((i) => i.status === "OK");
  const semFicha = itens.filter((i) => i.status === "SEM_FICHA");
  const comCiclo = itens.filter((i) => i.status === "CICLO");
  const cmvMedio = comFicha.length
    ? comFicha.reduce((s, i) => s + (i.cmv ?? 0), 0) / comFicha.length
    : null;

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">CMV</p>
        <h1>Fichas técnicas e custo</h1>
      </div>

      <div className="field-row" style={{ marginBottom: 18 }}>
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
            <input type="hidden" name="tipo" value={tipo} />
            <button className="btn small" type="submit">
              Ver
            </button>
          </form>
        </div>
      </div>

      <div className="tabbar" style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        {TIPO_ITEM_VENDA.map((t) => (
          <Link
            key={t}
            href={`/cmv?unidade=${unidadeSelecionada.id}&tipo=${t}`}
            className={`btn small ${t === tipo ? "primary" : ""}`}
          >
            {TIPO_ITEM_VENDA_LABEL[t]}
          </Link>
        ))}
      </div>

      <div className="kpis" style={{ marginBottom: 24 }}>
        <div className="kpi">
          <p className="lbl">Total de itens</p>
          <div className="val">{itens.length}</div>
        </div>
        <div className="kpi">
          <p className="lbl">CMV médio</p>
          <div className="val">{fmtPct(cmvMedio)}</div>
          <p className="sub">meta: {fmtPct(meta)}</p>
        </div>
        <div className="kpi">
          <p className="lbl">Sem ficha técnica</p>
          <div className="val">{semFicha.length}</div>
        </div>
        <div className="kpi">
          <p className="lbl">Com ciclo pendente</p>
          <div className="val">{comCiclo.length}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Categoria</th>
            <th>Nome</th>
            <th className="num">Custo</th>
            <th className="num">Venda</th>
            <th className="num">CMV</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => (
            <tr key={item.id}>
              <td>{item.categoria || "—"}</td>
              <td>{item.nome}</td>
              <td className="num">{fmtCurrency(item.custo)}</td>
              <td className="num">{fmtCurrency(item.precoVenda)}</td>
              <td className="num">{fmtPct(item.cmv)}</td>
              <td>
                {item.status === "OK" && <span className="tag ok">OK</span>}
                {item.status === "SEM_FICHA" && <span className="tag warn">Sem ficha</span>}
                {item.status === "CICLO" && <span className="tag bad">Ciclo pendente</span>}
              </td>
              <td className="num">
                <Link href={`/cmv/${item.id}`} className="btn small">
                  {item.status === "SEM_FICHA" ? "Criar ficha" : "Editar"}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
