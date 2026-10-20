import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { idDaUnidadeFisica } from "@/lib/unidade-fisica";
import { requireSession } from "@/lib/session";
import { unidadeVisivel } from "@/lib/permissions";
import { fmtCurrency } from "@/lib/format";
import { TIPO_PERDA, TIPO_PERDA_LABEL, type TipoPerda } from "@/lib/constants";
import PerdaForm from "@/components/PerdaForm";

/**
 * Baixa declarada: o que saiu da despensa e não virou venda.
 *
 * Lançamento DIÁRIO, pelo gerente da unidade. Perda anotada no fim da semana,
 * de memória, é estimativa — e estimativa dentro de um indicador de CMV é pior
 * que ausência, porque tem cara de medição.
 *
 * O QUE ESTA TELA NÃO FAZ: somar a perda ao consumo. A baixa já está dentro do
 * consumo medido entre duas contagens (o que foi jogado fora já não está na
 * contagem final). O que ela faz é PARTIR o consumo em duas causas. Ver
 * perdasPorProdutoPura em src/lib/consumo.ts.
 */
const DIAS_NA_TELA = 30;

export default async function PerdasPage({
  searchParams,
}: {
  searchParams: { unidadeId?: string };
}) {
  const user = await requireSession();
  const isAdmin = user.papel === "ADMIN";
  const unidadeId = isAdmin ? searchParams.unidadeId : user.unidadeId;

  if (!unidadeId) {
    return <div className="empty">Nenhuma unidade selecionada. Volte para a tela de Estoque.</div>;
  }
  if (!unidadeVisivel(user.papel, user.unidadeId, unidadeId)) {
    return <div className="empty">Você não tem acesso a essa unidade.</div>;
  }

  // A baixa é da DESPENSA, igual à contagem — ver src/lib/unidade-fisica.ts.
  const unidadeFisicaId = await idDaUnidadeFisica(unidadeId);
  const desde = new Date(Date.now() - DIAS_NA_TELA * 24 * 60 * 60 * 1000);

  const [unidade, produtos, lancamentos, precos] = await Promise.all([
    prisma.unidade.findUnique({ where: { id: unidadeFisicaId }, select: { nome: true } }),
    prisma.produto.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, unidadeMedida: true },
    }),
    prisma.movimentoEstoque.findMany({
      where: {
        unidadeId: unidadeFisicaId,
        tipo: { in: [...TIPO_PERDA] },
        criadoEm: { gte: desde },
      },
      orderBy: { criadoEm: "desc" },
      include: { produto: { select: { nome: true, unidadeMedida: true } } },
    }),
    prisma.precoAtualProduto.findMany({
      where: { unidadeId: unidadeFisicaId },
      select: { produtoId: true, preco: true },
    }),
  ]);

  const precoDe = new Map(precos.map((p) => [p.produtoId, p.preco]));
  // A quantidade está gravada negativa (convenção de MovimentoEstoque); a tela
  // mostra em módulo, que é como quem lançou pensa — "joguei 3 kg fora".
  const comValor = lancamentos.map((m) => ({
    ...m,
    quantidade: Math.abs(m.quantidade),
    valor: Math.abs(m.quantidade) * (precoDe.get(m.produtoId) ?? 0),
    semPreco: !precoDe.get(m.produtoId),
  }));
  const total = comValor.reduce((s, l) => s + l.valor, 0);

  const porMotivo = TIPO_PERDA.map((t) => {
    const lista = comValor.filter((l) => l.tipo === t);
    return { tipo: t, n: lista.length, valor: lista.reduce((s, l) => s + l.valor, 0) };
  })
    .filter((m) => m.n > 0)
    .sort((a, b) => b.valor - a.valor);

  const fmtData = (d: Date) =>
    d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">
          <Link href={`/estoque?unidadeId=${unidadeId}`}>← Estoque</Link>
        </p>
        <h1>Perdas e baixas — {unidade?.nome}</h1>
        <p className="sub-explica">
          O que saiu da despensa e não virou venda. Lance no dia, não no fim da semana — perda
          lembrada depois é estimativa, e estimativa dentro do CMV tem cara de medição.
        </p>
      </div>

      <div className="card">
        <h2 style={{ fontSize: 15, marginBottom: 14 }}>Nova baixa</h2>
        <PerdaForm unidadeId={unidadeId} produtos={produtos} />
      </div>

      <div className="kpis" style={{ marginBottom: 24 }}>
        <div className="kpi">
          <p className="lbl">Baixas em {DIAS_NA_TELA} dias</p>
          <div className="val">{fmtCurrency(total)}</div>
          <p className="sub">{comValor.length} lançamentos</p>
        </div>
        {porMotivo.slice(0, 3).map((m) => (
          <div className="kpi" key={m.tipo}>
            <p className="lbl">{TIPO_PERDA_LABEL[m.tipo as TipoPerda].split(" (")[0]}</p>
            <div className="val">{fmtCurrency(m.valor)}</div>
            <p className="sub">
              {m.n} {m.n === 1 ? "lançamento" : "lançamentos"}
              {total > 0 ? ` · ${((100 * m.valor) / total).toFixed(0)}%` : ""}
            </p>
          </div>
        ))}
      </div>

      {comValor.length === 0 ? (
        <div className="empty">
          Nenhuma baixa lançada nos últimos {DIAS_NA_TELA} dias.
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ width: 90 }}>quando</th>
              <th>produto</th>
              <th>motivo</th>
              <th className="num" style={{ width: 90 }}>qtd</th>
              <th className="num" style={{ width: 110 }}>valor</th>
              <th>observação</th>
            </tr>
          </thead>
          <tbody>
            {comValor.map((l) => (
              <tr key={l.id}>
                <td>{fmtData(l.criadoEm)}</td>
                <td>{l.produto.nome}</td>
                <td>{TIPO_PERDA_LABEL[l.tipo as TipoPerda]}</td>
                <td className="num">
                  {l.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {l.produto.unidadeMedida}
                </td>
                <td className="num">
                  {l.semPreco ? <span className="tag warn">sem preço</span> : fmtCurrency(l.valor)}
                </td>
                <td>{l.observacao || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="sub-explica" style={{ marginTop: 16 }}>
        O valor usa o preço de compra mais recente do insumo. Item marcado como{" "}
        <span className="tag warn">sem preço</span> ainda não teve compra registrada nesta despensa —
        a baixa existe e abate o saldo, mas não entra no total acima.
      </p>
    </div>
  );
}
