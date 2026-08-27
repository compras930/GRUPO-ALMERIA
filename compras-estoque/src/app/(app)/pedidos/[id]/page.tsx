import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { podeAprovarPedido, podeReceber, unidadeVisivel } from "@/lib/permissions";
import { STATUS_PEDIDO_LABEL, type StatusPedido } from "@/lib/constants";
import ActionButton from "@/components/ActionButton";
import RejeitarForm from "@/components/RejeitarForm";
import { aprovarPedido, marcarEnviado, cancelarPedido } from "@/actions/pedidos";
import { fmtCurrency } from "@/lib/format";

export default async function PedidoDetalhePage({ params }: { params: { id: string } }) {
  const user = await requireSession();
  const pedido = await prisma.pedidoCompra.findUnique({
    where: { id: params.id },
    include: {
      unidade: true,
      fornecedor: true,
      solicitante: true,
      aprovador: true,
      itens: { include: { produto: true, itensRecebimento: true } },
      recebimentos: { include: { recebidoPor: true, itens: { include: { itemPedido: { include: { produto: true } } } } } },
    },
  });
  if (!pedido) notFound();
  if (!unidadeVisivel(user.papel, user.unidadeId, pedido.unidadeId)) {
    return <div className="empty">Você não tem acesso a esse pedido.</div>;
  }

  const totalEsperado = pedido.itens.reduce((s, i) => s + i.quantidade * i.precoUnitEsperado, 0);
  const podeAprovarEsse = podeAprovarPedido(user.papel) && pedido.status === "AGUARDANDO_APROVACAO";
  const podeReceberEsse =
    podeReceber(user.papel) && ["APROVADO", "ENVIADO", "RECEBIDO_PARCIAL"].includes(pedido.status);
  const podeCancelar = !["RECEBIDO_TOTAL", "CANCELADO"].includes(pedido.status);

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">Pedido de compra</p>
        <h1>#{pedido.numero} — {pedido.fornecedor?.nome ?? "sem fornecedor"}</h1>
      </div>

      <div className="kpis">
        <div className="kpi">
          <p className="lbl">Unidade</p>
          <div className="val" style={{ fontSize: 18 }}>{pedido.unidade.nome}</div>
        </div>
        <div className="kpi">
          <p className="lbl">Status</p>
          <div className="val" style={{ fontSize: 18 }}>{STATUS_PEDIDO_LABEL[pedido.status as StatusPedido]}</div>
        </div>
        <div className="kpi">
          <p className="lbl">Solicitante</p>
          <div className="val" style={{ fontSize: 18 }}>{pedido.solicitante.nome}</div>
        </div>
        <div className="kpi flame">
          <p className="lbl">Total esperado</p>
          <div className="val">{fmtCurrency(totalEsperado)}</div>
        </div>
      </div>

      {pedido.motivoRejeicao && (
        <div className="card" style={{ borderColor: "var(--bad)" }}>
          <strong style={{ color: "var(--bad)" }}>Motivo da rejeição:</strong> {pedido.motivoRejeicao}
        </div>
      )}

      {pedido.observacao && (
        <div className="card">
          <strong>Observação:</strong> {pedido.observacao}
        </div>
      )}

      <div className="card">
        <h2 style={{ fontSize: 15, marginBottom: 14 }}>Itens do pedido</h2>
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th className="num">Qtd. pedida</th>
              <th className="num">Qtd. recebida</th>
              <th className="num">Preço esperado</th>
              <th className="num">Total esperado</th>
            </tr>
          </thead>
          <tbody>
            {pedido.itens.map((item) => {
              const recebido = item.itensRecebimento.reduce((s, r) => s + r.quantidadeRecebida, 0);
              const divergente = item.itensRecebimento.length > 0 && recebido !== item.quantidade;
              return (
                <tr key={item.id}>
                  <td>{item.produto.nome}</td>
                  <td className="num">
                    {item.quantidade} {item.produto.unidadeMedida}
                  </td>
                  <td className="num">
                    {item.itensRecebimento.length === 0 ? (
                      "—"
                    ) : (
                      <span className={divergente ? "tag warn" : "tag ok"}>
                        {recebido} {item.produto.unidadeMedida}
                      </span>
                    )}
                  </td>
                  <td className="num">{fmtCurrency(item.precoUnitEsperado)}</td>
                  <td className="num">{fmtCurrency(item.quantidade * item.precoUnitEsperado)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pedido.recebimentos.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: 15, marginBottom: 14 }}>Recebimentos registrados</h2>
          {pedido.recebimentos.map((r) => (
            <div key={r.id} style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12.5, color: "#6b6252", marginBottom: 6 }}>
                {new Date(r.dataRecebimento).toLocaleString("pt-BR")} · recebido por {r.recebidoPor.nome}
                {r.observacao ? ` · ${r.observacao}` : ""}
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th className="num">Qtd. recebida</th>
                    <th className="num">Preço recebido</th>
                    <th>Divergência</th>
                  </tr>
                </thead>
                <tbody>
                  {r.itens.map((it) => {
                    const qtdDivergente = it.quantidadeRecebida !== it.itemPedido.quantidade;
                    const precoDivergente = it.precoUnitRecebido !== it.itemPedido.precoUnitEsperado;
                    return (
                      <tr key={it.id}>
                        <td>{it.itemPedido.produto.nome}</td>
                        <td className="num">{it.quantidadeRecebida}</td>
                        <td className="num">{fmtCurrency(it.precoUnitRecebido)}</td>
                        <td>
                          {!qtdDivergente && !precoDivergente ? (
                            <span className="tag ok">OK</span>
                          ) : (
                            <span className="tag warn">
                              {qtdDivergente ? "Qtd. diferente" : ""}
                              {qtdDivergente && precoDivergente ? " · " : ""}
                              {precoDivergente ? "Preço diferente" : ""}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {podeAprovarEsse && (
          <>
            <ActionButton action={() => aprovarPedido(pedido.id)} className="btn primary">
              Aprovar pedido
            </ActionButton>
            <RejeitarForm pedidoId={pedido.id} />
          </>
        )}
        {podeReceber(user.papel) && pedido.status === "APROVADO" && (
          <ActionButton action={() => marcarEnviado(pedido.id)} className="btn">
            Marcar como enviado ao fornecedor
          </ActionButton>
        )}
        {podeReceberEsse && (
          <Link href={`/recebimentos/novo/${pedido.id}`} className="btn flame">
            Registrar recebimento
          </Link>
        )}
        {podeCancelar && (
          <ActionButton
            action={() => cancelarPedido(pedido.id)}
            className="btn danger"
            confirmMsg="Cancelar este pedido de compra?"
          >
            Cancelar pedido
          </ActionButton>
        )}
      </div>
    </div>
  );
}
