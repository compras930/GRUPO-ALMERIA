import { Fragment } from "react";
import { prisma } from "@/lib/prisma";
import { idDaUnidadeFisica } from "@/lib/unidade-fisica";
import { requireSession } from "@/lib/session";
import { unidadeVisivel } from "@/lib/permissions";
import { agruparPorCategoriaPura } from "@/lib/agrupar-contagem";
import { carregarPesagens } from "@/lib/pesagem-db";
import { avisoDePesagemPura } from "@/lib/pesagem";
import {
  semanaDoMes,
  gruposDaSemana,
  entraNaSemanaPura,
  GRUPO_TODA_SEMANA,
  type Semana,
} from "@/lib/contagem-rotacao";
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
    // Carrega a curva A+B inteira e decide em memória com entraNaSemanaPura.
    //
    // Antes a regra do rodízio existia DUAS vezes: aqui como `where` do Prisma
    // e lá como função. As duas saíram do lugar no dia em que `grupoContagem =
    // 0` (contar toda semana) entrou — a função passou a aceitar, o `where`
    // não, e o Beira Lago não apareceria na folha. Os testes passavam porque
    // testavam a função, que nenhuma tela chamava.
    //
    // São algumas centenas de linhas por casa; filtrar em memória custa nada e
    // garante que a tela, a folha impressa e os testes respondam à MESMA regra.
    where: { unidadeId: unidadeFisicaId, classeAbc: { in: ["A", "B"] } },
    include: {
      produto: { select: { id: true, nome: true, unidadeMedida: true, ativo: true, categoria: true } },
    },
  });

  const itens = registros
    .filter((r) => r.produto.ativo && (todos || entraNaSemanaPura(r, semana)))
    .map((r) => ({
      id: r.produto.id,
      nome: r.produto.nome,
      unidadeMedida: r.produto.unidadeMedida,
      classeAbc: r.classeAbc,
      categoria: r.produto.categoria,
    }));

  // MESMA ORDEM DA TELA, pelo mesmo agrupador — ver src/lib/agrupar-contagem.ts.
  //
  // Isto não é capricho: a pessoa conta com a folha impressa na mão e outra
  // pessoa digita na tela. Se as duas listas tiverem ordens diferentes, cada
  // linha digitada vira uma busca, e a chance de lançar a quantidade de um
  // produto na linha do vizinho deixa de ser remota. Duas ordens seria pior
  // que a ordem alfabética que havia antes.
  const pesagens = await carregarPesagens(itens.map((i) => i.id));
  const gruposDeCategoria = agruparPorCategoriaPura(
    itens.map((i) => ({ ...i, aviso: avisoDePesagemPura(pesagens.get(i.id), i.unidadeMedida) }))
  );

  // Casa que conta a curva inteira toda semana (grupoContagem = 0) não tem
  // "grupo da semana" — dizer "curva A grupo 2" na folha dela seria mentira
  // impressa, e papel circula.
  const tudoTodaSemana =
    registros.length > 0 && registros.every((r) => r.grupoContagem === GRUPO_TODA_SEMANA);
  const descricao = todos
    ? "Contagem inicial — curvas A e B"
    : tudoTodaSemana
      ? "Curva A inteira — toda semana"
      : `Semana ${semana} — curva A grupo ${grupos.a} + curva B grupo ${grupos.b}`;

  const hoje = new Date().toLocaleDateString("pt-BR");

  return (
    <div className="folha">
      <div className="folha-cabecalho">
        <div>
          <h1 style={{ margin: 0, fontSize: 20 }}>Contagem de estoque — {unidade?.nome}</h1>
          <p style={{ margin: "2px 0 0", fontSize: 13 }}>
            {descricao}
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
          {gruposDeCategoria.map((g) => (
            <Fragment key={g.categoria}>
              <tr>
                <td colSpan={4} className="folha-categoria">
                  {g.categoria} · {g.itens.length}
                </td>
              </tr>
              {g.itens.map((i, n) => (
                <tr key={i.id}>
                  <td>{g.primeiroNumero + n}</td>
                  <td>
                    {i.nome}
                    {i.aviso && <div className="folha-aviso">{i.aviso}</div>}
                  </td>
                  <td>{i.unidadeMedida}</td>
                  <td />
                </tr>
              ))}
            </Fragment>
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
