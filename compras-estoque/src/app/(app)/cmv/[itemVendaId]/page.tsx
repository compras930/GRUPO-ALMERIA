import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { custoItemVenda } from "@/lib/cmv";
import { fmtCurrency } from "@/lib/format";
import { TIPO_ITEM_VENDA_LABEL, type TipoItemVenda } from "@/lib/constants";
import FichaForm from "@/components/FichaForm";

function fmtPct(v: number | null) {
  if (v === null) return "—";
  return (v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}

export default async function ItemVendaPage({ params }: { params: { itemVendaId: string } }) {
  await requireAdmin();
  const resultado = await custoItemVenda(params.itemVendaId);
  if (!resultado) notFound();
  const { item, custo, cmv, status } = resultado;

  const [receita, produtos, subReceitas, itensDaUnidade] = await Promise.all([
    item.receitaId
      ? prisma.receita.findUnique({
          where: { id: item.receitaId },
          include: { ingredientes: { include: { produto: true, subReceita: true } } },
        })
      : Promise.resolve(null),
    prisma.produto.findMany({ orderBy: { nome: "asc" }, select: { nome: true } }),
    prisma.receita.findMany({
      where: { unidadeId: item.unidadeId, NOT: { id: item.receitaId ?? undefined } },
      orderBy: { nome: "asc" },
      select: { nome: true },
    }),
    prisma.itemVenda.findMany({ where: { unidadeId: item.unidadeId, tipo: item.tipo }, select: { categoria: true } }),
  ]);

  const ingredientesIniciais = (receita?.ingredientes ?? []).map((i) => ({
    tipo: (i.produtoId ? "INSUMO" : "SUBRECEITA") as "INSUMO" | "SUBRECEITA",
    nome: i.produto?.nome ?? i.subReceita?.nome ?? "",
    unidadeMedida: i.unidadeMedida,
    quantidade: i.quantidade,
  }));
  const categoriasConhecidas = [...new Set(itensDaUnidade.map((i) => i.categoria).filter((c): c is string => !!c))].sort(
    (a, b) => a.localeCompare(b, "pt-BR")
  );

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">
          <Link href={`/cmv?unidade=${item.unidadeId}&tipo=${item.tipo}`}>← {TIPO_ITEM_VENDA_LABEL[item.tipo as TipoItemVenda]}</Link>
        </p>
        <h1>{item.nome}</h1>
      </div>

      <div className="kpis" style={{ marginBottom: 24 }}>
        <div className="kpi">
          <p className="lbl">Custo</p>
          <div className="val">{fmtCurrency(custo)}</div>
        </div>
        <div className="kpi">
          <p className="lbl">Preço venda</p>
          <div className="val">{fmtCurrency(item.precoVenda)}</div>
        </div>
        <div className="kpi">
          <p className="lbl">CMV</p>
          <div className="val">{fmtPct(cmv)}</div>
        </div>
      </div>

      {status === "CICLO" && (
        <p className="error-msg" style={{ marginBottom: 18 }}>
          Essa ficha tem um ciclo (uma sub-receita que aponta, direta ou indiretamente, de volta
          pra si mesma) — o custo não pode ser calculado até isso ser corrigido. Reveja os
          ingredientes marcados como "Sub-receita" abaixo.
        </p>
      )}
      {status === "SEM_FICHA" && (
        <p className="sub" style={{ marginBottom: 18 }}>
          Esse item ainda não tem ficha técnica — adicione os ingredientes abaixo e salve.
        </p>
      )}

      <div className="card">
        <FichaForm
          itemVendaId={item.id}
          nomeInicial={item.nome}
          categoriaInicial={item.categoria ?? ""}
          precoVendaInicial={item.precoVenda}
          modoPreparoInicial={receita?.modoPreparo ?? ""}
          rendimentoQtdInicial={receita?.rendimentoQtd ?? null}
          rendimentoUnidadeInicial={receita?.rendimentoUnidade ?? ""}
          ingredientesIniciais={ingredientesIniciais}
          nomesInsumos={produtos.map((p) => p.nome)}
          nomesSubReceitas={subReceitas.map((r) => r.nome)}
          categoriasConhecidas={categoriasConhecidas}
        />
      </div>
    </div>
  );
}
