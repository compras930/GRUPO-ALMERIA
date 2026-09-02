import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { carregarIndiceReceitas, explodirReceitaPura, CicloReceitaError } from "@/lib/receita";
import ReceitaForm from "@/components/ReceitaForm";

export default async function EditarReceitaPage({ params }: { params: { receitaId: string } }) {
  await requireAdmin();
  const receita = await prisma.receita.findUnique({
    where: { id: params.receitaId },
    include: {
      unidade: true,
      ingredientes: { include: { produto: true, subReceita: true } },
      itensVenda: { select: { nome: true } },
      usadaComoSubReceitaEm: { select: { receita: { select: { nome: true } } } },
    },
  });
  if (!receita) notFound();

  const [produtos, subReceitas] = await Promise.all([
    prisma.produto.findMany({ orderBy: { nome: "asc" }, select: { nome: true } }),
    prisma.receita.findMany({
      where: { unidadeId: receita.unidadeId, NOT: { id: receita.id } },
      orderBy: { nome: "asc" },
      select: { nome: true },
    }),
  ]);

  const ingredientesIniciais = receita.ingredientes.map((i) => ({
    tipo: (i.produtoId ? "INSUMO" : "SUBRECEITA") as "INSUMO" | "SUBRECEITA",
    nome: i.produto?.nome ?? i.subReceita?.nome ?? "",
    unidadeMedida: i.unidadeMedida,
    quantidade: i.quantidade,
  }));

  const indice = await carregarIndiceReceitas(receita.unidadeId);
  let temCiclo = false;
  try {
    explodirReceitaPura(receita.id, 1, indice);
  } catch (e) {
    if (e instanceof CicloReceitaError) temCiclo = true;
    else throw e;
  }

  const usos = [...new Set([...receita.itensVenda.map((iv) => iv.nome), ...receita.usadaComoSubReceitaEm.map((i) => i.receita.nome)])];

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">
          <Link href={`/receitas?unidade=${receita.unidadeId}`}>← Sub-receitas</Link>
        </p>
        <h1>{receita.nome}</h1>
        <p className="sub">{receita.unidade.nome}</p>
      </div>

      {temCiclo && (
        <p className="error-msg" style={{ marginBottom: 18 }}>
          Essa receita tem um ciclo (uma sub-receita que aponta, direta ou indiretamente, de volta
          pra ela mesma) — revise os ingredientes marcados como "Sub-receita" abaixo.
        </p>
      )}
      {usos.length > 0 && (
        <p className="sub" style={{ marginBottom: 18 }}>
          Usada em: {usos.join(", ")}
        </p>
      )}

      <div className="card">
        <ReceitaForm
          receitaId={receita.id}
          unidadeId={receita.unidadeId}
          nomeInicial={receita.nome}
          modoPreparoInicial={receita.modoPreparo ?? ""}
          rendimentoQtdInicial={receita.rendimentoQtd}
          rendimentoUnidadeInicial={receita.rendimentoUnidade ?? ""}
          ingredientesIniciais={ingredientesIniciais}
          nomesInsumos={produtos.map((p) => p.nome)}
          nomesSubReceitas={subReceitas.map((r) => r.nome)}
        />
      </div>
    </div>
  );
}
