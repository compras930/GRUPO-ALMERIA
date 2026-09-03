import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import ReceitaForm from "@/components/ReceitaForm";

export default async function NovaReceitaPage({ searchParams }: { searchParams: { unidade?: string } }) {
  await requireAdmin();
  const unidade = searchParams.unidade
    ? await prisma.unidade.findUnique({ where: { id: searchParams.unidade } })
    : null;
  if (!unidade) notFound();

  const [produtos, subReceitas] = await Promise.all([
    prisma.produto.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, unidadeMedida: true },
    }),
    prisma.receita.findMany({
      where: { unidadeId: unidade.id },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, rendimentoUnidade: true },
    }),
  ]);

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">
          <Link href={`/receitas?unidade=${unidade.id}`}>← Sub-receitas</Link>
        </p>
        <h1>Nova sub-receita — {unidade.nome}</h1>
      </div>

      <div className="card">
        <ReceitaForm
          receitaId={null}
          unidadeId={unidade.id}
          nomeInicial=""
          modoPreparoInicial=""
          rendimentoQtdInicial={null}
          rendimentoUnidadeInicial=""
          ingredientesIniciais={[]}
          opcoesProduto={produtos}
          opcoesSubReceita={subReceitas}
        />
      </div>
    </div>
  );
}
