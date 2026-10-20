import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { podeVerPedidos } from "@/lib/permissions";
import { idDaUnidadeFisica } from "@/lib/unidade-fisica";
import { fmtCurrency } from "@/lib/format";
import { totaisPorCategoriaPura, SEM_CATEGORIA } from "@/lib/painel-categoria";
import { STATUS_PEDIDO_LABEL, type StatusPedido } from "@/lib/constants";

const PERIODOS = [30, 90] as const;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { dias?: string };
}) {
  const user = await requireSession();
  const verPedidos = podeVerPedidos(user.papel);
  const escopo = user.papel === "ADMIN" ? {} : { unidadeId: user.unidadeId ?? "" };

  const dias = PERIODOS.includes(Number(searchParams.dias) as (typeof PERIODOS)[number])
    ? Number(searchParams.dias)
    : 30;
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

  // Compra segue a DESPENSA e venda segue a CASA — ver src/lib/unidade-fisica.ts.
  // Pro ADMIN sem unidade, os dois escopos são o Grupo inteiro.
  const despensaId = user.unidadeId ? await idDaUnidadeFisica(user.unidadeId) : null;
  const escopoCompra = user.papel === "ADMIN" && !despensaId ? {} : { unidadeId: despensaId ?? "" };

  const [linhasCompra, linhasVenda] = await Promise.all([
    // TODAS as linhas da nota no período, inclusive as que não casaram com
    // produto: o painel é de DINHEIRO GASTO, e linha sem produto também foi
    // paga. Elas caem em "Sem categoria", que é onde elas de fato estão —
    // faltando cadastro.
    prisma.itemNotaCompra.findMany({
      where: { dataCompra: { gte: desde }, notaCompra: escopoCompra },
      select: {
        valorTotal: true,
        quantidade: true,
        precoUnitNovo: true,
        produto: { select: { categoria: true } },
      },
    }),
    prisma.itemVendaSemanal.findMany({
      where: { vendaSemanal: { ...escopo, periodoFim: { gte: desde } } },
      select: {
        quantidadeVendida: true,
        itemVenda: { select: { categoria: true, precoVenda: true } },
      },
    }),
  ]);

  const compraPorCategoria = totaisPorCategoriaPura(
    linhasCompra.map((l) => ({
      categoria: l.produto?.categoria ?? null,
      // `valorTotal` é o que a origem declarou para a linha. Quando falta,
      // reconstrói — mas nunca inventa quantidade.
      valor: l.valorTotal ?? (l.quantidade === null ? 0 : l.quantidade * l.precoUnitNovo),
    }))
  );
  // O app NÃO recebe faturamento do painel: a rota de vendas traz só
  // quantidade, e o valor sai daqui, do preço de venda cadastrado em cada
  // item. Preço de cardápio desatualizado = faturamento errado, e com ele o
  // CMV inteiro. Ver docs/n8n/contrato-integracao.md.
  const vendaPorCategoria = totaisPorCategoriaPura(
    linhasVenda.map((l) => ({
      categoria: l.itemVenda?.categoria ?? null,
      valor: l.quantidadeVendida * (l.itemVenda?.precoVenda ?? 0),
    }))
  );
  const totalCompra = compraPorCategoria.reduce((s, c) => s + c.valor, 0);
  const totalVenda = vendaPorCategoria.reduce((s, c) => s + c.valor, 0);

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
        {/*
          Quem não participa do fluxo de compra não leva na tela número de
          pedido: ele não tem como agir sobre aquilo, e indicador que ninguém
          pode resolver vira ruído — some da vista justamente o que é tarefa.
        */}
        {verPedidos && (
          <div className="kpi">
            <p className="lbl">Aguardando aprovação</p>
            <div className="val">{aguardandoAprovacao.length}</div>
          </div>
        )}
        {verPedidos && (
          <div className="kpi">
            <p className="lbl">Aguardando recebimento</p>
            <div className="val">{aguardandoRecebimento.length}</div>
          </div>
        )}
        {verPedidos && (
          <div className="kpi destaque">
            <p className="lbl">Divergências (pedido vs. recebido)</p>
            <div className="val">{divergencias.length}</div>
          </div>
        )}
        <div className="kpi bad">
          <p className="lbl">Produtos com saldo zerado</p>
          <div className="val">{saldosZerados}</div>
        </div>
      </div>

      <div className="page-header" style={{ marginTop: 8 }}>
        <h2 style={{ fontSize: 17 }}>Compras e vendas por categoria</h2>
        <p className="sub-explica">
          Compra segue a despensa e venda segue a casa — são escopos diferentes de propósito. A
          compra entra pela data da NOTA, não pela data da carga.
        </p>
        <div className="tabbar discreta" style={{ marginTop: 10 }}>
          {PERIODOS.map((d) => (
            <Link key={d} href={`/dashboard?dias=${d}`} className={`chip${dias === d ? " ativo" : ""}`}>
              {d} dias
            </Link>
          ))}
        </div>
      </div>

      <div className="duas-colunas">
        <div className="card">
          <h3 style={{ fontSize: 14, marginBottom: 4 }}>Compras — {fmtCurrency(totalCompra)}</h3>
          <p className="sub-explica" style={{ marginBottom: 12 }}>
            Últimos {dias} dias, pelo valor da nota (com imposto e frete).
          </p>
          {compraPorCategoria.length === 0 ? (
            <div className="empty">Nenhuma compra carregada neste período.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>categoria</th>
                  <th className="num" style={{ width: 120 }}>valor</th>
                  <th className="num" style={{ width: 60 }}>%</th>
                </tr>
              </thead>
              <tbody>
                {compraPorCategoria.map((c) => (
                  <tr key={c.categoria}>
                    <td>
                      {c.categoria}
                      {c.categoria === SEM_CATEGORIA && (
                        <span className="tag warn" style={{ marginLeft: 8 }}>
                          falta cadastro
                        </span>
                      )}
                    </td>
                    <td className="num">{fmtCurrency(c.valor)}</td>
                    <td className="num">{c.pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h3 style={{ fontSize: 14, marginBottom: 4 }}>Vendas — {fmtCurrency(totalVenda)}</h3>
          <p className="sub-explica" style={{ marginBottom: 12 }}>
            Últimos {dias} dias. O faturamento é calculado aqui: quantidade vendida × preço de venda
            cadastrado. Preço de cardápio desatualizado erra este número.
          </p>
          {vendaPorCategoria.length === 0 ? (
            <div className="empty">
              Nenhuma venda carregada. A rota <code>/api/n8n/vendas-semanais</code> ainda não rodou —
              enquanto ela não rodar, o CMV não tem denominador.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>categoria</th>
                  <th className="num" style={{ width: 120 }}>valor</th>
                  <th className="num" style={{ width: 60 }}>%</th>
                </tr>
              </thead>
              <tbody>
                {vendaPorCategoria.map((c) => (
                  <tr key={c.categoria}>
                    <td>
                      {c.categoria}
                      {c.categoria === SEM_CATEGORIA && (
                        <span className="tag warn" style={{ marginLeft: 8 }}>
                          falta cadastro
                        </span>
                      )}
                    </td>
                    <td className="num">{fmtCurrency(c.valor)}</td>
                    <td className="num">{c.pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {verPedidos && aguardandoAprovacao.length > 0 && (
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

      {verPedidos && (
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
      )}
    </div>
  );
}
