import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { criarItemVenda } from "@/actions/cmv";
import { TIPO_ITEM_VENDA, TIPO_ITEM_VENDA_LABEL, type TipoItemVenda } from "@/lib/constants";

export default async function NovoItemVendaPage({
  searchParams,
}: {
  searchParams: { unidade?: string; tipo?: string };
}) {
  await requireAdmin();
  const unidades = await prisma.unidade.findMany({ orderBy: { nome: "asc" } });
  const unidadeInicial = unidades.find((u) => u.id === searchParams.unidade) ?? unidades[0];
  const tipoInicial: TipoItemVenda = (TIPO_ITEM_VENDA as readonly string[]).includes(searchParams.tipo || "")
    ? (searchParams.tipo as TipoItemVenda)
    : "PRATO";

  if (!unidadeInicial) {
    return <div className="empty">Nenhuma unidade cadastrada ainda.</div>;
  }

  const categorias = await prisma.itemVenda.findMany({
    where: { categoria: { not: null } },
    select: { categoria: true },
    distinct: ["categoria"],
    orderBy: { categoria: "asc" },
  });

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">
          <Link href={`/cmv?unidade=${unidadeInicial.id}&tipo=${tipoInicial}`}>← CMV</Link>
        </p>
        <h1>Novo item de venda</h1>
      </div>

      <div className="card">
        <form action={criarItemVenda}>
          <div className="field-row">
            <div className="field-group">
              <label htmlFor="unidadeId">Unidade</label>
              <select id="unidadeId" name="unidadeId" defaultValue={unidadeInicial.id} required>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label htmlFor="tipo">Tipo</label>
              <select id="tipo" name="tipo" defaultValue={tipoInicial} required>
                {TIPO_ITEM_VENDA.map((t) => (
                  <option key={t} value={t}>
                    {TIPO_ITEM_VENDA_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field-group">
              <label htmlFor="nome">Nome</label>
              <input id="nome" name="nome" required />
            </div>
            <div className="field-group">
              <label htmlFor="categoria">Categoria</label>
              <input id="categoria" name="categoria" list="categorias-conhecidas" />
              <datalist id="categorias-conhecidas">
                {categorias.map((c) => (
                  <option key={c.categoria} value={c.categoria!} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="field-row">
            <div className="field-group">
              <label htmlFor="precoVenda">Preço de venda (R$)</label>
              <input id="precoVenda" name="precoVenda" type="number" step="0.01" min="0" required />
            </div>
            <div className="field-group">
              <label htmlFor="codigoPdv">Código PDV (opcional)</label>
              <input id="codigoPdv" name="codigoPdv" />
            </div>
          </div>
          <button className="btn primary" type="submit">
            Criar e preencher ficha
          </button>
        </form>
      </div>
    </div>
  );
}
