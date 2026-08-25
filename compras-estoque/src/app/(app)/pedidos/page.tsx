import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { podeCriarPedido } from "@/lib/permissions";
import { STATUS_PEDIDO_LABEL, type StatusPedido } from "@/lib/constants";

function tagClasse(status: StatusPedido) {
  if (status === "APROVADO" || status === "ENVIADO" || status === "RECEBIDO_TOTAL") return "ok";
  if (status === "AGUARDANDO_APROVACAO" || status === "RECEBIDO_PARCIAL") return "warn";
  if (status === "REJEITADO" || status === "CANCELADO") return "bad";
  return "neutral";
}

export default async function PedidosPage() {
  const user = await requireSession();

  const pedidos = await prisma.pedidoCompra.findMany({
    where: user.papel === "ADMIN" ? {} : { unidadeId: user.unidadeId ?? "" },
    orderBy: { numero: "desc" },
    include: { unidade: true, fornecedor: true, solicitante: true, itens: true },
    take: 100,
  });

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <p className="eyebrow">Compras</p>
          <h1>Pedidos de compra</h1>
        </div>
        {podeCriarPedido(user.papel) && (
          <Link href="/pedidos/novo" className="btn primary">
            + Novo pedido
          </Link>
        )}
      </div>

      {pedidos.length === 0 ? (
        <div className="empty">Nenhum pedido de compra ainda.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nº</th>
              <th>Unidade</th>
              <th>Fornecedor</th>
              <th>Solicitante</th>
              <th className="num">Itens</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => (
              <tr key={p.id}>
                <td className="num">#{p.numero}</td>
                <td>{p.unidade.nome}</td>
                <td>{p.fornecedor.nome}</td>
                <td>{p.solicitante.nome}</td>
                <td className="num">{p.itens.length}</td>
                <td>
                  <span className={`tag ${tagClasse(p.status as StatusPedido)}`}>
                    {STATUS_PEDIDO_LABEL[p.status as StatusPedido]}
                  </span>
                </td>
                <td className="num">
                  <Link href={`/pedidos/${p.id}`} className="btn small">
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
