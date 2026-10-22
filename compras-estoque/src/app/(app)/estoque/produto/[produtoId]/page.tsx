import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { idDaUnidadeFisica } from "@/lib/unidade-fisica";
import { requireSession } from "@/lib/session";
import { unidadeVisivel } from "@/lib/permissions";
import { fmtCurrency } from "@/lib/format";

/**
 * O que a casa comprou deste produto, nota a nota.
 *
 * NASCEU DE UMA PERGUNTA DA CONTAGEM: olhando a curva A, a pessoa quer saber
 * "de onde veio esse número" antes de aceitar que o item vale o que diz. Um
 * produto no topo da curva com três compras caras no fim do mês conta uma
 * história diferente de um com trinta compras pequenas.
 *
 * MOSTRA O `nomeBruto` DE CADA LINHA, não só o nome do cadastro. É nele que se
 * enxerga o fornecedor trocando a grafia, a unidade vindo diferente, e o
 * "(COMPRA)" aparecendo do nada — exatamente os sintomas que viraram produto
 * duplicado no Wine Garden e fantasma no Beira Lago.
 *
 * O PREÇO UNITÁRIO É O DA NOTA, cru: valor dividido pela quantidade como ela
 * veio escrita. Não é o preço do cadastro, que já passou por conversão. Ver os
 * dois lado a lado é o que denunciou o fator errado do Aperol.
 */
const data = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
const qtd = (n: number | null) => (n == null ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: 3 }));

export default async function ProdutoPage({
  params,
  searchParams,
}: {
  params: { produtoId: string };
  searchParams: { unidadeId?: string };
}) {
  const user = await requireSession();
  const isAdmin = user.papel === "ADMIN";
  const escolhida = isAdmin ? searchParams.unidadeId ?? user.unidadeId : user.unidadeId;
  if (!escolhida) {
    return <div className="empty">Escolha uma casa pelo Painel para ver as compras deste produto.</div>;
  }
  if (!unidadeVisivel(user.papel, user.unidadeId, escolhida)) {
    return <div className="empty">Você não tem acesso a essa unidade.</div>;
  }
  // Compra e preço seguem a DESPENSA — ver src/lib/unidade-fisica.ts.
  const despensaId = await idDaUnidadeFisica(escolhida);

  const produto = await prisma.produto.findUnique({
    where: { id: params.produtoId },
    select: { id: true, nome: true, unidadeMedida: true, categoria: true, ativo: true, codigoTeknisa: true },
  });
  if (!produto) return <div className="empty">Produto não encontrado.</div>;

  const [linhas, preco, saldo, parametro] = await Promise.all([
    prisma.itemNotaCompra.findMany({
      where: { produtoId: produto.id, notaCompra: { unidadeId: despensaId } },
      orderBy: { dataCompra: "desc" },
      select: {
        id: true,
        dataCompra: true,
        nomeBruto: true,
        unidadeBruta: true,
        codigoBruto: true,
        quantidade: true,
        valorTotal: true,
        precoUnitNovo: true,
      },
    }),
    prisma.precoAtualProduto.findUnique({
      where: { unidadeId_produtoId: { unidadeId: despensaId, produtoId: produto.id } },
      select: { preco: true, dataCompra: true },
    }),
    prisma.estoqueSaldo.findUnique({
      where: { unidadeId_produtoId: { unidadeId: despensaId, produtoId: produto.id } },
      select: { quantidade: true },
    }),
    prisma.parametroEstoqueProduto.findUnique({
      where: { unidadeId_produtoId: { unidadeId: despensaId, produtoId: produto.id } },
      select: { classeAbc: true },
    }),
  ]);

  const total = linhas.reduce((s, l) => s + (l.valorTotal ?? 0), 0);
  const quantidadeTotal = linhas.reduce((s, l) => s + (l.quantidade ?? 0), 0);
  const unitarios = linhas
    .filter((l) => (l.quantidade ?? 0) > 0 && l.valorTotal != null)
    .map((l) => l.valorTotal! / l.quantidade!);
  const menor = unitarios.length ? Math.min(...unitarios) : null;
  const maior = unitarios.length ? Math.max(...unitarios) : null;

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">
          <Link href="/dashboard">← Painel</Link>
        </p>
        <h1>{produto.nome}</h1>
      </div>

      <div className="cards">
        <div className="card">
          <p className="eyebrow">Comprado</p>
          <p className="big">{fmtCurrency(total)}</p>
          <p className="hint">
            {linhas.length} {linhas.length === 1 ? "linha de nota" : "linhas de nota"} ·{" "}
            {qtd(quantidadeTotal)} {produto.unidadeMedida}
          </p>
        </div>
        <div className="card">
          <p className="eyebrow">Preço no cadastro</p>
          <p className="big">{preco ? fmtCurrency(preco.preco) : "—"}</p>
          <p className="hint">
            {preco ? `por ${produto.unidadeMedida}, da compra de ${data(preco.dataCompra)}` : "nunca teve preço"}
          </p>
        </div>
        <div className="card">
          <p className="eyebrow">Preço na nota</p>
          <p className="big">
            {menor == null ? "—" : menor === maior ? fmtCurrency(menor) : `${fmtCurrency(menor)} a ${fmtCurrency(maior!)}`}
          </p>
          <p className="hint">
            Valor ÷ quantidade, como veio escrito. Diferente do cadastro quando há conversão de
            embalagem — e é essa diferença que denuncia conversão errada.
          </p>
        </div>
        <div className="card">
          <p className="eyebrow">Em estoque</p>
          <p className="big">{saldo ? qtd(saldo.quantidade) : "—"}</p>
          <p className="hint">
            {produto.unidadeMedida}
            {parametro?.classeAbc ? ` · curva ${parametro.classeAbc}` : " · fora da curva"}
            {produto.codigoTeknisa ? ` · código ${produto.codigoTeknisa}` : ""}
          </p>
        </div>
      </div>

      {linhas.length === 0 ? (
        <div className="empty">
          Nenhuma compra deste produto nesta casa. Se ele aparece em ficha técnica, o custo dele vem
          de um preço que nunca teve nota por trás.
        </div>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th style={{ width: 80 }}>data</th>
                <th>como veio escrito na nota</th>
                <th style={{ width: 60 }}>un</th>
                <th className="num" style={{ width: 90 }}>qtd</th>
                <th className="num" style={{ width: 110 }}>valor</th>
                <th className="num" style={{ width: 110 }}>unitário</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const unit = (l.quantidade ?? 0) > 0 && l.valorTotal != null ? l.valorTotal / l.quantidade! : null;
                return (
                  <tr key={l.id}>
                    <td className="cat">{data(l.dataCompra)}</td>
                    <td>
                      {l.nomeBruto}
                      {l.codigoBruto ? <span className="cat"> · {l.codigoBruto}</span> : null}
                    </td>
                    <td className="cat">{l.unidadeBruta ?? "—"}</td>
                    <td className="num">{qtd(l.quantidade)}</td>
                    <td className="num">{fmtCurrency(l.valorTotal)}</td>
                    <td className="num">{unit == null ? "—" : fmtCurrency(unit)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="hint" style={{ marginTop: 14 }}>
            A coluna <strong>como veio escrito na nota</strong> é o texto do fornecedor, não o nome
            do cadastro. Grafia mudando, unidade trocando ou um &ldquo;(COMPRA)&rdquo; aparecendo do
            nada são os sintomas que viram produto duplicado — se vir isso aqui, me diga.
          </p>
        </>
      )}
    </div>
  );
}
