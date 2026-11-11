import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { unidadesComEstoqueProprio, idDaUnidadeFisica } from "@/lib/unidade-fisica";
import { fmtCurrency } from "@/lib/format";
import { carregarCurvaDaJanela, MESES_DA_JANELA } from "@/lib/curva-abc-db";
import { planejarCurvaAbcPura } from "@/lib/curva-abc-aplicar";
import AplicarCurvaForm from "@/components/AplicarCurvaForm";
import { carregarContexto } from "@/lib/selecao-db";

/**
 * Recalcular a curva ABC que a FOLHA DE CONTAGEM usa.
 *
 * A curva do Painel é outra: ela é do mês que está na tela e se recalcula
 * sozinha. Esta fica GRAVADA e decide o que a cozinha conta toda semana — e
 * por ficar gravada, envelhece em silêncio.
 *
 * MOSTRA ANTES DE APLICAR, e mostra principalmente o que SAI: item que deixa a
 * curva A some da folha sem fazer barulho, e deixar de medir sem perceber é
 * pior que medir errado.
 */
const data = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

export default async function CurvaAbcPage({
  searchParams,
}: {
  searchParams: { unidadeId?: string };
}) {
  await requireAdmin();
  // A casa vem do menu lateral; a URL ainda manda quando vem preenchida.
  // Ver src/lib/selecao.ts.
  const unidades = await unidadesComEstoqueProprio();
  const ctx = await carregarContexto({ papel: "ADMIN", unidadeId: null }, searchParams);
  const escolhida = ctx.casaId || unidades[0]?.id;
  if (!escolhida) return <div className="empty">Nenhuma unidade com estoque próprio.</div>;
  const despensaId = await idDaUnidadeFisica(escolhida);

  const janela = await carregarCurvaDaJanela(despensaId);
  const plano = planejarCurvaAbcPura(janela.novas, janela.atuais, janela.foraDoEscopo);

  const ids = [
    ...new Set([...plano.entramNaA, ...plano.saemDaA, ...plano.foraDoEscopo].map((l) => l.produtoId)),
  ];
  const produtos = await prisma.produto.findMany({
    where: { id: { in: ids } },
    select: { id: true, nome: true, unidadeMedida: true, categoria: true },
  });
  const nomeDe = new Map(produtos.map((p) => [p.id, p]));

  const naCurvaAHoje = janela.atuais.filter((a) => a.classeAbc === "A").length;

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">
          <Link href={`/estoque?unidadeId=${escolhida}`}>← Estoque</Link>
        </p>
        <h1>Curva ABC da contagem</h1>
        <p className="sub-explica">
          Esta é a curva <strong>gravada</strong>, que decide o que a cozinha conta toda semana — não a
          do Painel, que é do mês na tela e se recalcula sozinha. Por ficar gravada, ela envelhece em
          silêncio: insumo caro que entrou no cardápio depois da última vez simplesmente não é contado.
        </p>
      </div>


      <div className="cards">
        <div className="card">
          <p className="eyebrow">Janela</p>
          <p className="big">{MESES_DA_JANELA} meses</p>
          <p className="hint">
            {/* `ate` é o limite EXCLUSIVO da consulta (1º do mês seguinte).
                Mostrá-lo cru diria que a janela vai até um dia que ela não
                inclui — um dia a mais, todo mês, calado. */}
            {data(janela.de)} a {data(new Date(janela.ate.getTime() - 1))} ·{" "}
            {fmtCurrency(janela.totalComprado)} em{" "}
            {janela.linhas} linhas de nota
          </p>
        </div>
        <div className="card">
          <p className="eyebrow">Curva A hoje</p>
          <p className="big">{naCurvaAHoje}</p>
          <p className="hint">itens que a folha de contagem traz</p>
        </div>
        <div className="card">
          <p className="eyebrow">Curva A recalculada</p>
          <p className="big">{plano.resumo.A}</p>
          <p className="hint">
            os itens que respondem por 80% da compra da janela
          </p>
        </div>
        <div className="card">
          <p className="eyebrow">Mudanças</p>
          <p className={`big${plano.mudancas.length > 0 ? " bad" : ""}`}>{plano.mudancas.length}</p>
          <p className="hint">
            {plano.entramNaA.length} entram na A · {plano.saemDaA.length} saem
          </p>
        </div>
      </div>

      {plano.mudancas.length === 0 ? (
        <div className="empty">
          A curva gravada já é a da janela. Nada a fazer — e isto é o resultado bom.
        </div>
      ) : (
        <>
          <div className="card">
            <h2 style={{ fontSize: 15, marginBottom: 4 }}>Aplicar</h2>
            <p className="hint" style={{ marginBottom: 14 }}>
              Grava a classificação recalculada em {plano.mudancas.length}{" "}
              {plano.mudancas.length === 1 ? "produto" : "produtos"}. A folha da próxima contagem já sai
              com a lista nova.{" "}
              A rotina vigente vale para todas as casas: curva A{" "}
              <strong>inteira toda semana</strong> e curva B em{" "}
              <strong>duas metades</strong>, que se alternam (semanas 1 e 3 contam a metade 1;
              semanas 2 e 4, a metade 2).{" "}
              {janela.grupoZero
                ? "Esta casa já contava a curva A toda semana."
                : "Esta casa ainda está com o rodízio antigo gravado — aplicar é o que a passa para a rotina nova."}
            </p>
            <AplicarCurvaForm unidadeId={escolhida} quantas={plano.mudancas.length} />
          </div>

          {plano.saemDaA.length > 0 && (
            <div className="card">
              <h2 style={{ fontSize: 15, marginBottom: 4 }}>Saem da curva A — deixam de ser contados</h2>
              <p className="hint" style={{ marginBottom: 14 }}>
                <strong>Olhe esta lista primeiro.</strong> Item que sai some da folha sem fazer barulho,
                e deixar de medir sem perceber é pior que medir errado. Se algum aqui ainda importa —
                caro, some com frequência, novo no cardápio —, me diga antes de aplicar.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Categoria</th>
                    <th>Vai para</th>
                    <th className="num">Comprado na janela</th>
                  </tr>
                </thead>
                <tbody>
                  {plano.saemDaA.map((l) => {
                    const p = nomeDe.get(l.produtoId);
                    return (
                      <tr key={l.produtoId}>
                        <td>
                          {p?.nome ?? l.produtoId}
                          {p?.unidadeMedida ? <span className="cat"> · {p.unidadeMedida}</span> : null}
                        </td>
                        <td className="cat">{p?.categoria ?? "—"}</td>
                        <td>
                          <span className="tag">{l.para}</span>
                        </td>
                        <td className="num">
                          {l.valor > 0 ? fmtCurrency(l.valor) : "nenhuma compra na janela"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {plano.foraDoEscopo.length > 0 && (
            <div className="card">
              <h2 style={{ fontSize: 15, marginBottom: 4 }}>Saem da folha — não são estoque de despensa</h2>
              <p className="hint" style={{ marginBottom: 14 }}>
                Travessa, enxoval, taxa, serviço, gás. A casa pagou por eles, mas eles não esperam
                numa prateleira para serem contados — e linha de folha que não dá para contar ensina
                quem conta a pular linha.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Categoria</th>
                    <th>Era</th>
                  </tr>
                </thead>
                <tbody>
                  {plano.foraDoEscopo.map((l) => {
                    const p = nomeDe.get(l.produtoId);
                    return (
                      <tr key={l.produtoId}>
                        <td>{p?.nome ?? l.produtoId}</td>
                        <td className="cat">{p?.categoria ?? "—"}</td>
                        <td className="cat">{l.de}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {plano.entramNaA.length > 0 && (
            <div className="card">
              <h2 style={{ fontSize: 15, marginBottom: 4 }}>Entram na curva A — passam a ser contados</h2>
              <p className="hint" style={{ marginBottom: 14 }}>
                Compra que cresceu desde a última vez. Quanto maior o valor, mais caro foi não estar
                contando até agora.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Categoria</th>
                    <th>Era</th>
                    <th className="num">Comprado na janela</th>
                  </tr>
                </thead>
                <tbody>
                  {plano.entramNaA.map((l) => {
                    const p = nomeDe.get(l.produtoId);
                    return (
                      <tr key={l.produtoId}>
                        <td>
                          {p?.nome ?? l.produtoId}
                          {p?.unidadeMedida ? <span className="cat"> · {p.unidadeMedida}</span> : null}
                        </td>
                        <td className="cat">{p?.categoria ?? "—"}</td>
                        <td className="cat">{l.de ?? "fora da curva"}</td>
                        <td className="num">{fmtCurrency(l.valor)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <p className="sub-explica" style={{ marginTop: 16 }}>
        A classe sai do <strong>acumulado</strong>, não do valor isolado: A são os itens que somam os
        primeiros 80% da compra, B vai até 95%, C é o resto. É o mesmo corte do Painel — o que muda
        entre os dois é a janela, e é só por isso que eles podem discordar.
      </p>
    </div>
  );
}
