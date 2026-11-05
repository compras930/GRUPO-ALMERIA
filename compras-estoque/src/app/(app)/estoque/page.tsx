import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { unidadesComEstoqueProprio, idDaUnidadeFisica } from "@/lib/unidade-fisica";
import { requireSession } from "@/lib/session";
import { fmtCurrency } from "@/lib/format";
import { TIPOS_DE_ENTRADA } from "@/lib/consumo";
import { valorizarEstoquePura } from "@/lib/valor-estoque";

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: { unidadeId?: string };
}) {
  const user = await requireSession();
  const isAdmin = user.papel === "ADMIN";

  const unidades = isAdmin
    ? await unidadesComEstoqueProprio()
    : [];

  const unidadeIdEscolhida = isAdmin ? searchParams.unidadeId || unidades[0]?.id : user.unidadeId;
  // Estoque é da despensa: um usuário lotado numa casa que não guarda estoque
  // (Matri) tem que ver a despensa de verdade, não uma tela vazia.
  const unidadeId = unidadeIdEscolhida ? await idDaUnidadeFisica(unidadeIdEscolhida) : unidadeIdEscolhida;

  const saldos = unidadeId
    ? await prisma.estoqueSaldo.findMany({
        where: { unidadeId },
        // Select explícito: sem ele o Prisma pede todas as colunas de Produto,
        // e uma coluna que existe no schema e ainda não no banco derruba a
        // tela inteira (P2022). Ver estoque/contagem/page.tsx.
        select: {
          id: true,
          quantidade: true,
          produtoId: true,
          produto: { select: { id: true, nome: true, unidadeMedida: true, categoria: true } },
        },
        orderBy: { produto: { nome: "asc" } },
      })
    : [];

  // QUANTO VALE O QUE ESTÁ NA PRATELEIRA — ver src/lib/valor-estoque.ts.
  const precos = unidadeId
    ? await prisma.precoAtualProduto.findMany({
        where: { unidadeId },
        select: { produtoId: true, preco: true },
      })
    : [];
  const precoPorProduto = new Map(precos.map((p) => [p.produtoId, p.preco]));
  const valor = valorizarEstoquePura(
    saldos.map((s) => ({
      produtoId: s.produtoId,
      nome: s.produto.nome,
      unidadeMedida: s.produto.unidadeMedida,
      categoria: s.produto.categoria,
      quantidade: s.quantidade,
      preco: precoPorProduto.get(s.produtoId) ?? null,
    }))
  );

  // A RESSALVA QUE FAZ O NÚMERO VALER: contagem SOBRESCREVE o saldo, nota
  // SOMA. Toda entrada lançada depois da última contagem está somada em cima
  // do que já foi contado — e quando a nota é de mercadoria que já estava na
  // prateleira no dia da contagem, ela está contada duas vezes.
  //
  // Aconteceu nesta casa em 29/10: a compra de outubro entrou no dia 04/11,
  // depois da contagem. Sem esta linha, o valor do estoque pareceria apenas
  // um número grande.
  const ultimaContagem = unidadeId
    ? await prisma.contagemEstoque.findFirst({
        where: { unidadeId },
        orderBy: { criadoEm: "desc" },
        select: { criadoEm: true },
      })
    : null;
  const entradasDepoisDaContagem = ultimaContagem
    ? await prisma.movimentoEstoque.findMany({
        where: {
          unidadeId: unidadeId!,
          tipo: { in: [...TIPOS_DE_ENTRADA] },
          criadoEm: { gt: ultimaContagem.criadoEm },
        },
        select: { produtoId: true, quantidade: true },
      })
    : [];
  const valorDepoisDaContagem = entradasDepoisDaContagem.reduce(
    (s, m) => s + Math.max(0, m.quantidade) * (precoPorProduto.get(m.produtoId) ?? 0),
    0
  );

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
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/estoque/consumo${unidadeId ? `?unidadeId=${unidadeId}` : ""}`} className="btn">
            Consumo entre contagens
          </Link>
          <Link href={`/estoque/perdas${unidadeId ? `?unidadeId=${unidadeId}` : ""}`} className="btn">
            Perdas e baixas
          </Link>
          {isAdmin && (
            <Link href={`/estoque/curva-abc${unidadeId ? `?unidadeId=${unidadeId}` : ""}`} className="btn">
              Curva ABC da contagem
            </Link>
          )}
          <Link href={`/estoque/contagem${unidadeId ? `?unidadeId=${unidadeId}` : ""}`} className="btn primary">
            + Registrar contagem
          </Link>
        </div>
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

      {saldos.length > 0 && (
        <>
          <div className="cards">
            <div className="card">
              <p className="eyebrow">Valor em estoque</p>
              <p className="big">{fmtCurrency(valor.total)}</p>
              <p className="hint">
                {valor.itensValorizados} {valor.itensValorizados === 1 ? "produto" : "produtos"} com
                saldo e preço
                {valor.semPreco.length > 0 && (
                  <>
                    {" "}
                    · <strong>{valor.semPreco.length} fora da conta</strong> por não terem preço, então
                    o total está subestimado
                  </>
                )}
                .
              </p>
            </div>
            {valor.porCategoria.slice(0, 3).map((c) => (
              <div className="card" key={c.categoria ?? "sem"}>
                <p className="eyebrow">{c.categoria ?? "Sem categoria"}</p>
                <p className="big">{fmtCurrency(c.valor)}</p>
                <p className="hint">
                  {c.itens} {c.itens === 1 ? "produto" : "produtos"}
                  {valor.total > 0 ? ` · ${((100 * c.valor) / valor.total).toFixed(0)}% do estoque` : ""}
                </p>
              </div>
            ))}
          </div>

          <p className="sub-explica" style={{ marginTop: -8, marginBottom: 20 }}>
            {ultimaContagem ? (
              <>
                Última contagem em{" "}
                <strong>
                  {ultimaContagem.criadoEm.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                </strong>
                . Depois dela entraram <strong>{fmtCurrency(valorDepoisDaContagem)}</strong> em notas — e
                nota lançada depois da contagem <strong>soma</strong> em cima do que já foi contado. Se
                parte dessa mercadoria já estava na prateleira no dia da contagem, ela está contada duas
                vezes aqui. A próxima contagem corrige, porque contagem sobrescreve o saldo.
              </>
            ) : (
              <>
                <strong>Nenhuma contagem registrada nesta despensa.</strong> Sem contagem de abertura, o
                saldo é só a soma do que entrou e do que a ficha diz que saiu — nunca foi conferido
                contra a prateleira.
              </>
            )}
          </p>

          {valor.negativos.length > 0 && (
            <p className="sub-explica" style={{ marginBottom: 20 }}>
              <strong>{valor.negativos.length} com saldo negativo</strong>, fora do total:{" "}
              {valor.negativos.slice(0, 4).map((n) => n.nome).join(", ")}
              {valor.negativos.length > 4 ? "…" : ""}. Saiu mais do que entrou — quase sempre venda com
              ficha consumindo insumo cuja compra não foi carregada, ou conversão de unidade errada.
            </p>
          )}
        </>
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
