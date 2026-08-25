import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: { unidadeId?: string };
}) {
  const user = await requireSession();
  const isAdmin = user.papel === "ADMIN";

  const unidades = isAdmin
    ? await prisma.unidade.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } })
    : [];

  const unidadeId = isAdmin ? searchParams.unidadeId || unidades[0]?.id : user.unidadeId;

  const saldos = unidadeId
    ? await prisma.estoqueSaldo.findMany({
        where: { unidadeId },
        include: { produto: true },
        orderBy: { produto: { nome: "asc" } },
      })
    : [];

  const ultimasContagens = unidadeId
    ? await prisma.contagemEstoque.findMany({
        where: { unidadeId },
        include: { produto: true, contadoPor: true },
        orderBy: { criadoEm: "desc" },
        take: 10,
      })
    : [];

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <p className="eyebrow">Estoque</p>
          <h1>Saldo por produto</h1>
        </div>
        <Link href={`/estoque/contagem${unidadeId ? `?unidadeId=${unidadeId}` : ""}`} className="btn primary">
          + Registrar contagem
        </Link>
      </div>

      {isAdmin && (
        <div className="card" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span className="eyebrow" style={{ margin: 0 }}>
            Unidade
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {unidades.map((u) => (
              <Link
                key={u.id}
                href={`/estoque?unidadeId=${u.id}`}
                className={`btn small${u.id === unidadeId ? " primary" : ""}`}
              >
                {u.nome}
              </Link>
            ))}
          </div>
        </div>
      )}

      {saldos.length === 0 ? (
        <div className="empty">Nenhum saldo de estoque registrado ainda para esta unidade.</div>
      ) : (
        <table style={{ marginBottom: 28 }}>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Categoria</th>
              <th className="num">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {saldos.map((s) => (
              <tr key={s.id}>
                <td>{s.produto.nome}</td>
                <td className="cat">{s.produto.categoria || "—"}</td>
                <td className="num">
                  {s.quantidade} {s.produto.unidadeMedida}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {ultimasContagens.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: 15, marginBottom: 14 }}>Últimas contagens</h2>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Produto</th>
                <th className="num">Sistema</th>
                <th className="num">Contado</th>
                <th className="num">Diferença</th>
                <th>Por</th>
              </tr>
            </thead>
            <tbody>
              {ultimasContagens.map((c) => (
                <tr key={c.id}>
                  <td>{new Date(c.criadoEm).toLocaleString("pt-BR")}</td>
                  <td>{c.produto.nome}</td>
                  <td className="num">{c.quantidadeSistema}</td>
                  <td className="num">{c.quantidadeContada}</td>
                  <td className="num">
                    <span className={`tag ${c.diferenca === 0 ? "ok" : c.diferenca > 0 ? "warn" : "bad"}`}>
                      {c.diferenca > 0 ? "+" : ""}
                      {c.diferenca}
                    </span>
                  </td>
                  <td>{c.contadoPor.nome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
