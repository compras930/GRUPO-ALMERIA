import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { listarItensComCusto, type ItemComCusto } from "@/lib/cmv";
import { fmtCurrency } from "@/lib/format";
import { TIPO_ITEM_VENDA, TIPO_ITEM_VENDA_LABEL, type TipoItemVenda } from "@/lib/constants";
import NovoItemVenda from "@/components/NovoItemVenda";
import AcoesItemVenda from "@/components/AcoesItemVenda";

function fmtPct(v: number | null) {
  if (v === null) return "—";
  return (v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}

function LinhaItem({ item, fora }: { item: ItemComCusto; fora?: boolean }) {
  return (
    <tr className={fora ? "linha-inativa" : undefined}>
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
        <AcoesItemVenda
          id={item.id}
          nome={item.nome}
          fora={!!fora}
          semFicha={item.status === "SEM_FICHA"}
        />
      </td>
    </tr>
  );
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

  const todos = await listarItensComCusto(unidadeSelecionada.id, tipo);
  // Item fora do cardápio não entra em contagem nem em média: ele não é
  // vendido hoje, e deixá-lo no CMV médio faria o indicador responder por
  // prato que não existe mais.
  const itens = todos.filter((i) => i.ativo);
  const foraDoCardapio = todos.filter((i) => !i.ativo);

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

  // As categorias que já existem nessa casa e nesse tipo, pra o formulário
  // sugerir em vez de deixar digitar uma variante nova de algo existente.
  const categorias = [...new Set(todos.map((i) => i.categoria).filter((c): c is string => !!c))].sort(
    (a, b) => a.localeCompare(b, "pt-BR")
  );

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

      <div className="tabbar">
        {TIPO_ITEM_VENDA.map((t) => (
          <Link
            key={t}
            href={`/cmv?unidade=${unidadeSelecionada.id}&tipo=${t}`}
            className={`chip ${t === tipo ? "ativo" : ""}`}
          >
            {TIPO_ITEM_VENDA_LABEL[t]}
          </Link>
        ))}
      </div>

      <div className="kpis" style={{ marginBottom: 24 }}>
        <div className="kpi">
          <p className="lbl">Itens no cardápio</p>
          <div className="val">{itens.length}</div>
          {foraDoCardapio.length > 0 && <p className="sub">{foraDoCardapio.length} fora do cardápio</p>}
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

      <NovoItemVenda
        unidadeId={unidadeSelecionada.id}
        unidadeNome={unidadeSelecionada.nome}
        tipo={tipo}
        tipoLabel={TIPO_ITEM_VENDA_LABEL[tipo]}
        categorias={categorias}
      />

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
            <LinhaItem key={item.id} item={item} />
          ))}
        </tbody>
      </table>

      {itens.length === 0 && (
        <div className="empty">
          Nenhum item de {TIPO_ITEM_VENDA_LABEL[tipo].toLowerCase()} no cardápio de {unidadeSelecionada.nome}.
        </div>
      )}

      {foraDoCardapio.length > 0 && (
        <>
          <div className="page-header" style={{ marginTop: 34 }}>
            <p className="eyebrow">Fora do cardápio</p>
            <h2 style={{ fontSize: 18 }}>
              {foraDoCardapio.length} {foraDoCardapio.length === 1 ? "item saiu" : "itens saíram"} do cardápio
            </h2>
            <p className="sub-explica">
              Continuam aqui porque a venda das semanas em que existiram é deles. Não entram no CMV médio
              nem na contagem acima. &ldquo;Excluir&rdquo; só funciona em item que nunca vendeu.
            </p>
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
              {foraDoCardapio.map((item) => (
                <LinhaItem key={item.id} item={item} fora />
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
