import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { unidadeVisivel } from "@/lib/permissions";
import ContagemForm from "@/components/ContagemForm";

export default async function ContagemPage({
  searchParams,
}: {
  searchParams: { unidadeId?: string };
}) {
  const user = await requireSession();
  const isAdmin = user.papel === "ADMIN";

  const unidadeId = isAdmin ? searchParams.unidadeId : user.unidadeId;
  if (!unidadeId) {
    return <div className="empty">Nenhuma unidade selecionada. Volte para a tela de Estoque.</div>;
  }
  if (!unidadeVisivel(user.papel, user.unidadeId, unidadeId)) {
    return <div className="empty">Você não tem acesso a essa unidade.</div>;
  }

  const [produtos, saldos] = await Promise.all([
    prisma.produto.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    prisma.estoqueSaldo.findMany({ where: { unidadeId } }),
  ]);
  const saldoPorProduto = new Map(saldos.map((s) => [s.produtoId, s.quantidade]));

  const produtosComSaldo = produtos.map((p) => ({
    id: p.id,
    nome: p.nome,
    unidadeMedida: p.unidadeMedida,
    saldoSistema: saldoPorProduto.get(p.id) ?? 0,
  }));

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">Estoque</p>
        <h1>Registrar contagem</h1>
      </div>
      <div className="card">
        <ContagemForm unidadeId={unidadeId} produtos={produtosComSaldo} />
      </div>
    </div>
  );
}
