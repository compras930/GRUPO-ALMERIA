import { Fragment } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { unidadeVisivel } from "@/lib/permissions";
import { fmtCurrency } from "@/lib/format";
import { agruparPorFornecedorPura } from "@/lib/pedido-por-fornecedor";
import BotaoImprimir from "@/components/BotaoImprimir";

/**
 * A folha de conferência do pedido — para imprimir ou salvar em PDF.
 *
 * É o papel que vai para o estoquista conferir a mercadoria contra a nota de
 * entrega. Substitui a macro da planilha geral, e por isso segue o MESMO
 * formato: agrupado por fornecedor, com unidade, quantidade pedida e espaço
 * para custo — porque quem recebe já sabe ler essa folha, e mudar o desenho
 * agora custaria uma semana de "cadê a coluna tal".
 *
 * AGRUPADO POR FORNECEDOR, e não por categoria: a mercadoria chega numa
 * entrega por vez, de um fornecedor por vez. Uma folha organizada por
 * categoria obrigaria o estoquista a caçar os itens da nota espalhados por
 * seis blocos.
 */
export default async function ImprimirPedidoPage({ params }: { params: { id: string } }) {
  const user = await requireSession();
  const pedido = await prisma.pedidoCompra.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      numero: true,
      criadoEm: true,
      observacao: true,
      unidadeId: true,
      unidade: { select: { nome: true, cnpj: true } },
      solicitante: { select: { nome: true } },
      itens: {
        select: {
          id: true,
          quantidade: true,
          precoUnitEsperado: true,
          nomeBruto: true,
          unidadeBruta: true,
          produto: { select: { nome: true, unidadeMedida: true } },
          fornecedor: { select: { nome: true } },
        },
      },
    },
  });
  if (!pedido) notFound();
  if (!unidadeVisivel(user.papel, user.unidadeId, pedido.unidadeId)) {
    return <div className="empty">Você não tem acesso a esse pedido.</div>;
  }

  const grupos = agruparPorFornecedorPura(
    pedido.itens.map((i) => ({
      fornecedor: i.fornecedor?.nome ?? null,
      nome: i.produto?.nome ?? i.nomeBruto ?? "(sem nome)",
      unidade: i.unidadeBruta ?? i.produto?.unidadeMedida ?? "",
      quantidade: i.quantidade,
      precoUnitEsperado: i.precoUnitEsperado,
    }))
  );
  const data = pedido.criadoEm.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });

  return (
    <div className="folha">
      <div className="folha-cabecalho" style={{ display: "block", textAlign: "center" }}>
        <h1 style={{ margin: 0, fontSize: 24, letterSpacing: "0.02em" }}>GRUPO ALMERIA</h1>
        <p className="eyebrow" style={{ margin: "2px 0 8px" }}>Pedido de compras</p>
        <p style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Unidade {pedido.unidade.nome}</p>
        <p style={{ margin: "2px 0 0", fontSize: 13 }}>
          Pedido nº {pedido.numero} · {data}
          {pedido.unidade.cnpj ? ` · CNPJ ${pedido.unidade.cnpj}` : ""}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 12, fontStyle: "italic" }}>
          {pedido.itens.length} itens | {grupos.length}{" "}
          {grupos.length === 1 ? "fornecedor" : "fornecedores"} · solicitado por{" "}
          {pedido.solicitante.nome}
        </p>
      </div>

      {pedido.observacao && (
        <p style={{ fontSize: 12, marginBottom: 14 }}>
          <strong>Observação:</strong> {pedido.observacao}
        </p>
      )}

      {grupos.map((g) => (
        <Fragment key={g.fornecedor}>
          <p className="folha-categoria">
            {g.fornecedor} — {g.itens.length} {g.itens.length === 1 ? "item" : "itens"}
          </p>
          <table className="folha-tabela" style={{ marginBottom: 16 }}>
            <thead>
              <tr>
                <th style={{ width: 28 }}>#</th>
                <th>Produto</th>
                <th style={{ width: 54 }}>Und.</th>
                <th style={{ width: 54 }} className="num">Qtd.</th>
                <th style={{ width: 92 }} className="num">Custo unit.</th>
                <th style={{ width: 92 }} className="num">Total</th>
                <th style={{ width: 80 }}>Conferido</th>
              </tr>
            </thead>
            <tbody>
              {g.itens.map((i, n) => (
                <tr key={`${g.fornecedor}-${n}`}>
                  <td className="num">{n + 1}</td>
                  <td>{i.nome}</td>
                  <td>{i.unidade}</td>
                  <td className="num"><strong>{i.quantidade}</strong></td>
                  {/* Vazio de propósito quando não há preço esperado: a folha
                      é conferida contra a NOTA, e número chutado impresso ao
                      lado do real é convite para alguém conferir o errado. */}
                  <td className="num">{i.precoUnitEsperado > 0 ? fmtCurrency(i.precoUnitEsperado) : "—"}</td>
                  <td className="num">{i.total > 0 ? fmtCurrency(i.total) : "—"}</td>
                  <td></td>
                </tr>
              ))}
              <tr>
                <td colSpan={5} style={{ textAlign: "right", fontWeight: 600 }}>
                  Subtotal do fornecedor
                </td>
                <td className="num" style={{ fontWeight: 600 }}>
                  {g.total > 0 ? fmtCurrency(g.total) : "—"}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </Fragment>
      ))}

      <div style={{ marginTop: 18, fontSize: 12, display: "flex", gap: 40 }}>
        <div>Recebido por: ______________________________</div>
        <div>Data: ______/______/________</div>
      </div>

      <div className="nao-imprime" style={{ marginTop: 20 }}>
        <BotaoImprimir />
      </div>
    </div>
  );
}
