import { prisma } from "@/lib/prisma";
import { idDaUnidadeFisica } from "@/lib/unidade-fisica";
import { requireSession } from "@/lib/session";
import { unidadeVisivel } from "@/lib/permissions";
import { semanaDoMes, gruposDaSemana, type Semana } from "@/lib/contagem-rotacao";
import BotaoImprimir from "@/components/BotaoImprimir";

/**
 * Folha de contagem para imprimir ou salvar em PDF (Ctrl+P do navegador).
 *
 * Existe porque quem conta está na câmara fria com uma prancheta, não com o
 * app aberto. O papel volta preenchido e alguém digita — e é por isso que a
 * ordem aqui e a ordem da tela de lançamento são a mesma (alfabética): digitar
 * de uma lista fora de ordem é onde entra erro de linha trocada.
 *
 * Não mostra o saldo do sistema, pelo mesmo motivo da tela: quem conta olhando
 * o número esperado confirma o número esperado.
 */
export default async function ImprimirContagemPage({
  searchParams,
}: {
  searchParams: { unidadeId?: string; semana?: string; todos?: string };
}) {
  const user = await requireSession();
  const unidadeId = user.papel === "ADMIN" ? searchParams.unidadeId : user.unidadeId;
  if (!unidadeId || !unidadeVisivel(user.papel, user.unidadeId, unidadeId)) {
    return <div className="empty">Unidade inválida.</div>;
  }

  const unidadeFisicaId = await idDaUnidadeFisica(unidadeId);
  const unidade = await prisma.unidade.findUnique({ where: { id: unidadeFisicaId }, select: { nome: true } });
  const semana = (Number(searchParams.semana) || semanaDoMes(new Date())) as Semana;
  const grupos = gruposDaSemana(semana);
  // `todos=1` imprime as curvas A e B inteiras. É o que serve pra CONTAGEM
  // INICIAL: sem um marco zero de todos os itens, os da última semana ficam um
  // mês sem medição, e o primeiro consumo deles só sai no mês seguinte.
  const todos = searchParams.todos === "1";

  const registros = await prisma.parametroEstoqueProduto.findMany({
    where: todos
      ? { unidadeId: unidadeFisicaId, classeAbc: { in: ["A", "B"] } }
      : {
          unidadeId: unidadeFisicaId,
          OR: [
            { classeAbc: "A", grupoContagem: grupos.a },
            { classeAbc: "B", grupoContagem: grupos.b },
          ],
        },
    include: { produto: { select: { nome: true, unidadeMedida: true, ativo: true } } },
  });

  const itens = registros
    .filter((r) => r.produto.ativo)
    .map((r) => ({ nome: r.produto.nome, un: r.produto.unidadeMedida }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const hoje = new Date().toLocaleDateString("pt-BR");

  return (
    <div className="folha">
      <div className="folha-cabecalho">
        <div>
          <h1 style={{ margin: 0, fontSize: 20 }}>Contagem de estoque — {unidade?.nome}</h1>
          <p style={{ margin: "2px 0 0", fontSize: 13 }}>
            {todos ? "Contagem inicial — curvas A e B" : `Semana ${semana} — curva A grupo ${grupos.a} + curva B grupo ${grupos.b}`}
            {" · "}
            {itens.length} itens · emitida em {hoje}
          </p>
        </div>
        <div style={{ fontSize: 13, textAlign: "right" }}>
          <div>Data da contagem: ______/______/________</div>
          <div style={{ marginTop: 6 }}>Contado por: ______________________________</div>
        </div>
      </div>

      <table className="folha-tabela">
        <thead>
          <tr>
            <th style={{ width: 28 }}>#</th>
            <th>produto</th>
            <th style={{ width: 46 }}>un</th>
            <th style={{ width: 120 }}>quantidade</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((i, n) => (
            <tr key={i.nome + n}>
              <td>{n + 1}</td>
              <td>{i.nome}</td>
              <td>{i.un}</td>
              <td />
            </tr>
          ))}
        </tbody>
      </table>

      <p className="folha-rodape">
        Item que não conseguir contar: deixe a linha em branco. Em branco é pulado no lançamento; zero significa
        &ldquo;conferi e não tem nenhum&rdquo;, que é outra informação.
      </p>

      <div className="folha-acoes">
        <BotaoImprimir />
      </div>
    </div>
  );
}
