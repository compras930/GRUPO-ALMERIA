import { prisma } from "@/lib/prisma";
import { unidadesComEstoqueProprio } from "@/lib/unidade-fisica";
import { requireSession } from "@/lib/session";
import { podeCriarPedido } from "@/lib/permissions";
import NovoPedidoForm from "@/components/NovoPedidoForm";

export default async function NovoPedidoPage() {
  const user = await requireSession();
  if (!podeCriarPedido(user.papel)) {
    return <div className="empty">Seu papel não permite criar pedidos de compra.</div>;
  }

  const [unidades, fornecedores, produtos] = await Promise.all([
    unidadesComEstoqueProprio(),
    prisma.fornecedor.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    // Select explícito: ver o comentário em estoque/contagem/page.tsx.
    prisma.produto.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, unidadeMedida: true },
    }),
  ]);

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">Pedidos de compra</p>
        <h1>Novo pedido</h1>
      </div>
      <div className="card">
        <NovoPedidoForm
          unidades={unidades}
          fornecedores={fornecedores}
          produtos={produtos}
          unidadeFixaId={user.papel === "ADMIN" ? null : user.unidadeId}
        />
      </div>
    </div>
  );
}
