import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { unidadesComEstoqueProprio, idDaUnidadeFisica } from "@/lib/unidade-fisica";
import { requireSession } from "@/lib/session";
import { calcularConsumoPuro, TIPOS_DE_ENTRADA } from "@/lib/consumo";
import { fmtCurrency } from "@/lib/format";

const data = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const qtd = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

export default async function ConsumoPage({ searchParams }: { searchParams: { unidadeId?: string } }) {
  const user = await requireSession();
  const isAdmin = user.papel === "ADMIN";
  const unidades = isAdmin ? await unidadesComEstoqueProprio() : [];
  const escolhida = isAdmin ? searchParams.unidadeId || unidades[0]?.id : user.unidadeId;
  const unidadeId = escolhida ? await idDaUnidadeFisica(escolhida) : null;

  if (!unidadeId) {
    return <div className="empty">Nenhuma unidade selecionada.</div>;
  }

  const [contagens, movimentos, precos, produtos] = await Promise.all([
    prisma.contagemEstoque.findMany({
      where: { unidadeId },
      select: { produtoId: true, quantidadeContada: true, criadoEm: true },
    }),
    prisma.movimentoEstoque.findMany({
      where: { unidadeId, tipo: { in: [...TIPOS_DE_ENTRADA] } },
      select: { produtoId: true, quantidade: true, criadoEm: true },
    }),
    prisma.precoAtualProduto.findMany({ where: { unidadeId }, select: { produtoId: true, preco: true } }),
    prisma.produto.findMany({ select: { id: true, nome: true, unidadeMedida: true } }),
  ]);

  const linhas = calcularConsumoPuro(
    contagens.map((c) => ({ produtoId: c.produtoId, quantidade: c.quantidadeContada, em: c.criadoEm })),
    movimentos.map((m) => ({ produtoId: m.produtoId, quantidade: m.quantidade, em: m.criadoEm }))
  );

  const precoPorProduto = new Map(precos.map((p) => [p.produtoId, p.preco]));
  const produtoPorId = new Map(produtos.map((p) => [p.id, p]));

  // Valorizado a PREÇO ATUAL, que é custo de reposição — o que custaria repor o
  // que saiu. Não é o preço médio pago no período; quando a diferença entre os
  // dois importar, vale trocar, mas aí é uma decisão contábil, não técnica.
  const comValor = linhas
    .map((l) => ({
      ...l,
      produto: produtoPorId.get(l.produtoId),
      valor: l.consumo * (precoPorProduto.get(l.produtoId) ?? 0),
    }))
    .sort((a, b) => b.valor - a.valor);

  const total = comValor.reduce((s, l) => s + (l.valor > 0 ? l.valor : 0), 0);
  const alertas = comValor.filter((l) => l.alerta);

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">Estoque</p>
        <h1>Consumo entre contagens</h1>
      </div>

      {isAdmin && unidades.length > 1 && (
        <div className="card" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span className="eyebrow" style={{ margin: 0 }}>Unidade</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {unidades.map((u) => (
              <Link
                key={u.id}
                href={`/estoque/consumo?unidadeId=${u.id}`}
                className={`btn small${u.id === unidadeId ? " primary" : ""}`}
              >
                {u.nome}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <p style={{ margin: 0 }}>
          <strong>consumo = saldo contado antes + entradas do período − saldo contado depois</strong>
        </p>
        <p style={{ margin: "6px 0 0", opacity: 0.75 }}>
          É o que saiu de verdade: vendido, perdido, quebrado, consumido pela equipe. Não depende de ficha
          técnica. Cada produto aparece assim que tem duas contagens — a primeira é só o marco zero.
        </p>
      </div>

      {comValor.length === 0 ? (
        <div className="empty">
          Nenhum produto tem duas contagens ainda. Depois da segunda contagem de um item, o consumo dele aparece
          aqui.
        </div>
      ) : (
        <>
          <div className="kpis" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div className="kpi flame">
              <p className="lbl">Consumo no período</p>
              <div className="val">{fmtCurrency(total)}</div>
            </div>
            <div className="kpi">
              <p className="lbl">Produtos medidos</p>
              <div className="val">{comValor.length}</div>
            </div>
            <div className="kpi">
              <p className="lbl">Consumo negativo</p>
              <div className="val">{alertas.length}</div>
            </div>
          </div>

          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>produto</th>
                  <th>período</th>
                  <th style={{ textAlign: "right" }}>saldo antes</th>
                  <th style={{ textAlign: "right" }}>entradas</th>
                  <th style={{ textAlign: "right" }}>saldo depois</th>
                  <th style={{ textAlign: "right" }}>consumo</th>
                  <th style={{ textAlign: "right" }}>valor</th>
                </tr>
              </thead>
              <tbody>
                {comValor.map((l) => (
                  <tr key={l.produtoId}>
                    <td>
                      {l.produto?.nome ?? l.produtoId}{" "}
                      <span className="tag">{l.produto?.unidadeMedida}</span>
                      {l.alerta && (
                        <div className="error-msg" style={{ marginTop: 4 }}>
                          Consumo negativo: foi contado mais do que poderia existir. Quase sempre é entrada que
                          não chegou ao sistema, ou contagem feita em outra unidade de medida.
                        </div>
                      )}
                    </td>
                    <td style={{ opacity: 0.75 }}>
                      {data(l.de)} a {data(l.ate)}
                    </td>
                    <td style={{ textAlign: "right" }}>{qtd(l.saldoInicial)}</td>
                    <td style={{ textAlign: "right" }}>{qtd(l.entradas)}</td>
                    <td style={{ textAlign: "right" }}>{qtd(l.saldoFinal)}</td>
                    <td style={{ textAlign: "right" }}>{qtd(l.consumo)}</td>
                    <td style={{ textAlign: "right" }}>{fmtCurrency(l.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
