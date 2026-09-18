import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { idDaUnidadeFisica } from "@/lib/unidade-fisica";
import { requireSession } from "@/lib/session";
import { unidadeVisivel } from "@/lib/permissions";
import { SEMANAS, semanaDoMes, gruposDaSemana, type Semana } from "@/lib/contagem-rotacao";
import ContagemForm from "@/components/ContagemForm";
import ContagemLoteForm from "@/components/ContagemLoteForm";

export default async function ContagemPage({
  searchParams,
}: {
  searchParams: { unidadeId?: string; semana?: string; todos?: string };
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

  // Estoque é da despensa — ver src/lib/unidade-fisica.ts.
  const unidadeFisicaId = await idDaUnidadeFisica(unidadeId);
  const semana = (Number(searchParams.semana) || semanaDoMes(new Date())) as Semana;
  const grupos = gruposDaSemana(semana);
  const verTodos = searchParams.todos === "1";

  // O filtro do rodízio vive no banco (ParametroEstoqueProduto), não aqui:
  // a mesma classificação alimenta a planilha que vai pra cozinha e esta tela.
  const doRodizio = await prisma.parametroEstoqueProduto.findMany({
    where: {
      unidadeId: unidadeFisicaId,
      OR: [
        { classeAbc: "A", grupoContagem: grupos.a },
        { classeAbc: "B", grupoContagem: grupos.b },
      ],
    },
    include: { produto: { select: { id: true, nome: true, unidadeMedida: true, ativo: true } } },
  });

  const itensDaSemana = doRodizio
    .filter((p) => p.produto.ativo)
    .map((p) => ({
      id: p.produto.id,
      nome: p.produto.nome,
      unidadeMedida: p.produto.unidadeMedida,
      classeAbc: p.classeAbc,
    }))
    // Ordem alfabética: quem conta procura pelo nome na prateleira, não pelo
    // valor. E a classe fica discreta de propósito — saber que um item "vale
    // mais" convida a caprichar nele e correr nos outros.
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const produtos = await prisma.produto.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } });
  const saldos = await prisma.estoqueSaldo.findMany({ where: { unidadeId: unidadeFisicaId } });
  const saldoPorProduto = new Map(saldos.map((s) => [s.produtoId, s.quantidade]));

  const q = (extra: Record<string, string>) =>
    "?" + new URLSearchParams({ unidadeId, ...extra }).toString();

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">Estoque</p>
        <h1>Registrar contagem</h1>
      </div>

      <div className="card" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span className="eyebrow" style={{ margin: 0 }}>Semana</span>
        {SEMANAS.map((s) => (
          <Link key={s} href={q({ semana: String(s) })} className={`btn small${s === semana ? " primary" : ""}`}>
            {s}
          </Link>
        ))}
        <span style={{ flex: 1 }} />
        <Link href={`/estoque/contagem/imprimir${q({ semana: String(semana) })}`} className="btn small" target="_blank">
          Folha da semana {semana}
        </Link>
        <Link href={`/estoque/contagem/imprimir${q({ todos: "1" })}`} className="btn small" target="_blank">
          Folha da contagem inicial
        </Link>
        <Link href={q({ semana: String(semana), todos: verTodos ? "0" : "1" })} className="btn small">
          {verTodos ? "Esconder produto avulso" : "Contar um produto avulso"}
        </Link>
      </div>

      {itensDaSemana.length === 0 ? (
        <div className="empty">
          Nenhum produto no rodízio desta semana nesta unidade. A classificação ABC ainda não foi gravada —
          rode o script da curva ABC, ou conte um produto avulso.
        </div>
      ) : (
        <div className="card">
          <p className="eyebrow" style={{ margin: 0 }}>
            Semana {semana} · curva A grupo {grupos.a} + curva B grupo {grupos.b} · {itensDaSemana.length} itens
          </p>
          <ContagemLoteForm unidadeId={unidadeId} semana={semana} itens={itensDaSemana} />
        </div>
      )}

      {verTodos && (
        <div className="card">
          <p className="eyebrow" style={{ marginTop: 0 }}>Produto avulso</p>
          <ContagemForm
            unidadeId={unidadeId}
            produtos={produtos.map((p) => ({
              id: p.id,
              nome: p.nome,
              unidadeMedida: p.unidadeMedida,
              saldoSistema: saldoPorProduto.get(p.id) ?? 0,
            }))}
          />
        </div>
      )}
    </div>
  );
}
