import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { podeReceber, unidadeVisivel } from "@/lib/permissions";
import RecebimentoForm from "@/components/RecebimentoForm";

export default async function NovoRecebimentoPage({ params }: { params: { pedidoId: string } }) {
  const user = await requireSession();
  if (!podeReceber(user.papel)) {
    return <div className="empty">Seu papel não permite registrar recebimentos.</div>;
  }

  const pedido = await prisma.pedidoCompra.findUnique({
    where: { id: params.pedidoId },
    include: { unidade: true, fornecedor: true, itens: { include: { produto: true, itensRecebimento: true } } },
  });
  if (!pedido) notFound();
  if (!unidadeVisivel(user.papel, user.unidadeId, pedido.unidadeId)) {
    return <div className="empty">Você não tem acesso a esse pedido.</div>;
  }
  if (!["APROVADO", "ENVIADO", "RECEBIDO_PARCIAL"].includes(pedido.status)) {
    return <div className="empty">Esse pedido não está em condição de receber itens.</div>;
  }

  const itensPendentes = pedido.itens.map((item) => ({
    itemPedidoId: item.id,
    produtoNome: item.produto.nome,
    unidadeMedida: item.produto.unidadeMedida,
    quantidadePedida: item.quantidade,
    quantidadeJaRecebida: item.itensRecebimento.reduce((s, r) => s + r.quantidadeRecebida, 0),
    precoUnitEsperado: item.precoUnitEsperado,
  }));

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">
          Pedido #{pedido.numero} · {pedido.unidade.nome} · {pedido.fornecedor.nome}
        </p>
        <h1>Registrar recebimento</h1>
      </div>
      <div className="card">
        <RecebimentoForm pedidoId={pedido.id} itens={itensPendentes} />
      </div>
    </div>
  );
}
