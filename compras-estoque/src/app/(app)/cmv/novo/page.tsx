import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { TIPO_ITEM_VENDA, TIPO_ITEM_VENDA_LABEL, type TipoItemVenda } from "@/lib/constants";
import FormNovoItemVenda from "@/components/FormNovoItemVenda";

export default async function NovoItemVendaPage({
  searchParams,
}: {
  searchParams: { unidade?: string; tipo?: string };
}) {
  await requireAdmin();
  const unidades = await prisma.unidade.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });
  const unidadeInicial = unidades.find((u) => u.id === searchParams.unidade) ?? unidades[0];
  const tipoInicial: TipoItemVenda = (TIPO_ITEM_VENDA as readonly string[]).includes(searchParams.tipo || "")
    ? (searchParams.tipo as TipoItemVenda)
    : "PRATO";

  if (!unidadeInicial) {
    return <div className="empty">Nenhuma unidade cadastrada ainda.</div>;
  }

  // Só as categorias DESTA casa: cada cardápio tem os seus, e sugerir as do
  // Beira Lago a quem está cadastrando no 104 Sul convida a criar categoria
  // que aquela casa não usa.
  const categorias = await prisma.itemVenda.findMany({
    where: { unidadeId: unidadeInicial.id, categoria: { not: null } },
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
        <FormNovoItemVenda
          unidades={unidades}
          unidadeInicial={unidadeInicial.id}
          tipoInicial={tipoInicial}
          categorias={categorias.map((c) => c.categoria!).filter(Boolean)}
        />
      </div>
    </div>
  );
}
