import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { unidadeVisivel } from "@/lib/permissions";
import { idDaUnidadeFisica } from "@/lib/unidade-fisica";
import { fmtCurrency } from "@/lib/format";
import { ehEnxuto } from "@/lib/escopo-cmv";
import { mesDaChave } from "@/lib/mes";
import { carregarContexto } from "@/lib/selecao-db";
import { serieDeCompraPura } from "@/lib/compras-por-dia";

/**
 * A compra dia a dia, num período escolhido à mão.
 *
 * O PAINEL RESPONDE "QUANTO", ESTA TELA RESPONDE "QUANDO". O total do mês já
 * está lá; aqui a informação está na forma da série — a entrega grande de
 * terça, a semana em que se estocou para um evento, o buraco de três dias que
 * explica o pico do quarto.
 *
 * O PERÍODO É LIVRE e começa no mês selecionado no menu. Os dois convivem de
 * propósito: o mês é o recorte de FECHAMENTO (CMV, contagem, virada), e o
 * período livre é uma pergunta de operação. Misturar os dois num seletor só
 * faria o Painel mudar de significado sem avisar.
 */
const diaCurto = (d: string) => d.slice(8, 10);
const diaLongo = (d: string) =>
  new Date(`${d}T00:00:00.000Z`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    weekday: "short",
    timeZone: "UTC",
  });

export default async function ComprasPorPeriodoPage({
  searchParams,
}: {
  searchParams: { unidadeId?: string; mes?: string; de?: string; ate?: string };
}) {
  const user = await requireSession();
  const ctx = await carregarContexto(
    { papel: user.papel, unidadeId: user.unidadeId ?? null },
    searchParams
  );
  const casaId = ctx.casaId;
  if (!casaId) {
    return (
      <div className="empty">
        Escolha uma casa no menu — a compra é de uma despensa, e somar todas num gráfico só juntaria
        operações que não se comparam.
      </div>
    );
  }
  if (!unidadeVisivel(user.papel, user.unidadeId, casaId)) {
    return <div className="empty">Você não tem acesso a essa casa.</div>;
  }
  const despensaId = await idDaUnidadeFisica(casaId);
  const casa = ctx.casas.find((c) => c.id === casaId);

  // O padrão é o mês do menu. Data digitada na mão ganha dele.
  const mes = mesDaChave(ctx.mes);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const ultimoDiaDoMes = mes ? iso(new Date(mes.fim.getTime() - 1)) : iso(new Date());
  const de = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.de ?? "")
    ? searchParams.de!
    : mes
      ? iso(mes.inicio)
      : iso(new Date());
  const ate = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.ate ?? "") ? searchParams.ate! : ultimoDiaDoMes;

  const linhas = await prisma.itemNotaCompra.findMany({
    where: {
      notaCompra: { unidadeId: despensaId },
      dataCompra: {
        gte: new Date(`${de}T00:00:00.000Z`),
        // `lt` no dia seguinte, e não `lte` no próprio: a data vem com hora, e
        // `lte` no dia escolhido cortaria tudo que foi lançado depois da
        // meia-noite dele.
        lt: new Date(new Date(`${ate}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000),
      },
    },
    select: {
      dataCompra: true,
      valorTotal: true,
      quantidade: true,
      precoUnitNovo: true,
      produto: { select: { categoria: true } },
    },
  });

  const serie = serieDeCompraPura(
    linhas.map((l) => ({
      dia: l.dataCompra.toISOString().slice(0, 10),
      valor: l.valorTotal ?? (l.quantidade === null ? 0 : l.quantidade * l.precoUnitNovo),
      enxuto: ehEnxuto(l.produto?.categoria),
    })),
    de,
    ate
  );

  // Rótulo de dia a cada N barras, para o eixo não virar um borrão. Com 31
  // dias cabem todos; com 90, um a cada quatro.
  const passo = Math.max(1, Math.ceil(serie.dias.length / 31));

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">
          <Link href="/estoque">← Estoque</Link>
        </p>
        <h1>Compras por período</h1>
        <p className="sub-explica">
          {casa?.nome}. O Painel responde <strong>quanto</strong> se comprou no mês; esta tela
          responde <strong>quando</strong>. A compra entra pela data da NOTA, não pela data da carga.
        </p>
      </div>

      {/* FILTROS EM UMA LINHA, acima do gráfico. GET, não ação: o período fica
          na URL e o link pode ser mandado para outra pessoa. */}
      <form className="card btn-row" method="get" style={{ alignItems: "flex-end" }}>
        <div className="field-group">
          <label htmlFor="de">De</label>
          <input id="de" name="de" type="date" defaultValue={de} max={ate} />
        </div>
        <div className="field-group">
          <label htmlFor="ate">Até</label>
          <input id="ate" name="ate" type="date" defaultValue={ate} min={de} />
        </div>
        <button className="btn primary" type="submit">Ver</button>
        <span style={{ flex: 1 }} />
        <span className="hint">
          Começa no mês escolhido no menu{mes ? ` (${mes.rotulo})` : ""}; mude as datas para abrir
          outra janela.
        </span>
      </form>

      <div className="cards">
        <div className="card">
          <p className="eyebrow">Comprado no período</p>
          <p className="big">{fmtCurrency(serie.total)}</p>
          <p className="hint">
            {fmtCurrency(serie.enxuto)} enxuto · {serie.linhas} linhas de nota
          </p>
        </div>
        <div className="card">
          <p className="eyebrow">Maior dia</p>
          <p className="big">{serie.maior ? fmtCurrency(serie.maior.valor) : "—"}</p>
          <p className="hint">
            {serie.maior
              ? `${diaLongo(serie.maior.dia)} · ${serie.maior.linhas} linhas`
              : "nenhuma compra no período"}
          </p>
        </div>
        <div className="card">
          <p className="eyebrow">Média por dia de compra</p>
          <p className="big">{fmtCurrency(serie.mediaPorDiaComCompra)}</p>
          <p className="hint">
            {serie.diasComCompra} de {serie.dias.length} dias tiveram nota — a média é sobre os dias
            que existiram, não sobre o calendário
          </p>
        </div>
      </div>

      {serie.dias.length === 0 ? (
        <div className="empty">Período inválido: a data inicial é depois da final.</div>
      ) : serie.total === 0 ? (
        <div className="empty">Nenhuma compra entre {diaLongo(de)} e {diaLongo(ate)}.</div>
      ) : (
        <>
          <div className="card">
            <h2 style={{ fontSize: 15, marginBottom: 4 }}>Compra por dia</h2>
            <p className="hint" style={{ marginBottom: 18 }}>
              Dia sem compra aparece vazio, de propósito: o buraco é o que explica o pico do dia
              seguinte. Fim de semana vem marcado mais claro.
            </p>
            {/* Uma série só, então sem legenda: o título já diz o que é. Só o
                maior dia ganha rótulo — número em cima de toda barra vira
                ruído e some com a forma da série, que é o que se veio ver. */}
            <div className="grafico-colunas" role="img" aria-label={`Compra por dia de ${diaLongo(de)} a ${diaLongo(ate)}`}>
              {serie.dias.map((d, i) => (
                <div
                  key={d.dia}
                  className={`coluna${d.fimDeSemana ? " fds" : ""}${d.pico ? " pico" : ""}`}
                  title={`${diaLongo(d.dia)} — ${fmtCurrency(d.valor)}${d.linhas ? ` em ${d.linhas} linhas` : ""}`}
                >
                  <div className="barra-area">
                    {d.pico && <span className="rotulo-pico">{fmtCurrency(d.valor)}</span>}
                    <div className="barra" style={{ height: `${Math.max(d.altura * 100, d.valor > 0 ? 1.5 : 0)}%` }} />
                  </div>
                  <span className="eixo">{i % passo === 0 ? diaCurto(d.dia) : ""}</span>
                </div>
              ))}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Dia</th>
                <th className="num">Linhas</th>
                <th className="num">Enxuto</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {serie.dias
                .filter((d) => d.valor > 0)
                .map((d) => (
                  <tr key={d.dia}>
                    <td>
                      {diaLongo(d.dia)}
                      {d.pico ? <span className="tag warn"> maior dia</span> : null}
                    </td>
                    <td className="num">{d.linhas}</td>
                    <td className="num">{fmtCurrency(d.enxuto)}</td>
                    <td className="num">{fmtCurrency(d.valor)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p className="sub-explica" style={{ marginTop: 14 }}>
            A tabela traz só os dias que tiveram nota. O gráfico acima traz todos, porque lá a
            ausência tem forma.
          </p>
        </>
      )}
    </div>
  );
}
