import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { STATUS_PEDIDO_LABEL, type StatusPedido } from "@/lib/constants";

export default async function DashboardPage() {
  const user = await requireSession();
  const escopo = user.papel === "ADMIN" ? {} : { unidadeId: user.unidadeId ?? "" };

  const [aguardandoAprovacao, aguardandoRecebimento, saldosZerados, ultimosPedidos] = await Promise.all([
    prisma.pedidoCompra.findMany({
      where: { ...escopo, status: "AGUARDANDO_APROVACAO" },
      include: { unidade: true, fornecedor: true },
      orderBy: { criadoEm: "asc" },
    }),
    prisma.pedidoCompra.findMany({
      where: { ...escopo, status: { in: ["APROVADO", "ENVIADO", "RECEBIDO_PARCIAL"] } },
      include: { unidade: true, fornecedor: true },
      orderBy: { criadoEm: "asc" },
    }),
    prisma.estoqueSaldo.count({ where: { ...escopo, quantidade: 0 } }),
    prisma.pedidoCompra.findMany({
      where: escopo,
      include: { unidade: true, fornecedor: true },
      orderBy: { numero: "desc" },
      take: 8,
    }),
  ]);

  // Divergências: itens recebidos cuja quantidade ou preço não bateu com o esperado.
  const recebimentosRecentes = await prisma.itemRecebimento.findMany({
    where: { itemPedido: { pedido: escopo } },
    include: { itemPedido: { include: { produto: true, pedido: true } } },
    orderBy: { id: "desc" },
    take: 200,
  });
  const divergencias = recebimentosRecentes.filter(
    (r) => r.quantidadeRecebida !== r.itemPedido.quantidade || r.precoUnitRecebido !== r.itemPedido.precoUnitEsperado
  );

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">Grupo Almeria</p>
        <h1>Painel de compras &amp; estoque</h1>
      </div>

      <div className="kpis">
        <div className="kpi">
          <p className="lbl">Aguardando aprovação</p>
          <div className="val">{aguardandoAprovacao.length}</div>
        </div>
        <div className="kpi">
          <p className="lbl">Aguardando recebimento</p>
          <div className="val">{aguardandoRecebimento.length}</div>
        </div>
        <div className="kpi flame">
          <p className="lbl">Divergências (pedido vs. recebido)</p>
          <div className="val">{divergencias.length}</div>
        </div>
        <div className="kpi bad">
          <p className="lbl">Produtos com saldo zerado</p>
          <div className="val">{saldosZerados}</div>
        </div>
      </div>

      {aguardandoAprovacao.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: 15, marginBottom: 14 }}>Pendentes de aprovação</h2>
          <table>
            <thead>
              <tr>
                <th>Nº</th>
                <th>Unidade</th>
                <th>Fornecedor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {aguardandoAprovacao.map((p) => (
                <tr key={p.id}>
                  <td className="num">#{p.numero}</td>
                  <td>{p.unidade.nome}</td>
                  <td>{p.fornecedor?.nome ?? "—"}</td>
                  <td className="num">
                    <Link href={`/pedidos/${p.id}`} className="btn small">
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {divergencias.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: 15, marginBottom: 14 }}>Divergências recentes</h2>
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Produto</th>
                <th className="num">Pedido</th>
                <th className="num">Recebido</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {divergencias.slice(0, 10).map((d) => (
                <tr key={d.id}>
                  <td>#{d.itemPedido.pedido.numero}</td>
                  <td>{d.itemPedido.produto.nome}</td>
                  <td className="num">
                    {d.itemPedido.quantidade} {d.itemPedido.produto.unidadeMedida}
                  </td>
                  <td className="num">
                    <span className="tag warn">
                      {d.quantidadeRecebida} {d.itemPedido.produto.unidadeMedida}
                    </span>
                  </td>
                  <td className="num">
                    <Link href={`/pedidos/${d.itemPedido.pedidoId}`} className="btn small">
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <h2 style={{ fontSize: 15, marginBottom: 14 }}>Últimos pedidos</h2>
        {ultimosPedidos.length === 0 ? (
          <div className="empty">Nenhum pedido registrado ainda.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nº</th>
                <th>Unidade</th>
                <th>Fornecedor</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ultimosPedidos.map((p) => (
                <tr key={p.id}>
                  <td className="num">#{p.numero}</td>
                  <td>{p.unidade.nome}</td>
                  <td>{p.fornecedor?.nome ?? "—"}</td>
                  <td>{STATUS_PEDIDO_LABEL[p.status as StatusPedido]}</td>
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
    </div>
  );
}
