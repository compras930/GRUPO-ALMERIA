import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { unidadeVisivel } from "@/lib/permissions";
import { idDaUnidadeFisica, casasDaUnidadeFisica } from "@/lib/unidade-fisica";
import { carregarContexto } from "@/lib/selecao-db";
import { fmtCurrency } from "@/lib/format";
import { TIPOS_DE_ENTRADA } from "@/lib/consumo";
import { consumoPorPeriodoPuro, cmvSemanalPuro, segundaDaDataPura } from "@/lib/cmv-semanal";

/**
 * CMV CONTADO, semana a semana — o número que a contagem semanal produz.
 *
 * Os outros dois CMVs do Painel são proxy (compras ÷ vendas, que supõe estoque
 * parado) e teoria (ficha técnica, que supõe receita cumprida). Este é o que
 * saiu da prateleira de verdade, e por isso é o único que pega furo: desvio,
 * porção fora do padrão, mercadoria que foi embora.
 *
 * A COBERTURA APARECE AO LADO DE CADA SEMANA, sempre. A contagem semanal pega
 * a curva A inteira e metade da B — não o catálogo todo. Um CMV de 22%
 * calculado sobre 60% da compra não é 22%, e quem leva esse número para a
 * diretoria precisa saber disso antes, não depois.
 */
const rotulo = (semana: string) => {
  const d = new Date(`${semana}T12:00:00.000Z`);
  const fim = new Date(d.getTime() + 6 * 24 * 60 * 60 * 1000);
  const f = (x: Date) =>
    `${String(x.getUTCDate()).padStart(2, "0")}/${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${f(d)} a ${f(fim)}`;
};
const pct = (n: number | null) => (n === null ? "—" : `${(n * 100).toFixed(1)}%`);

export default async function CmvSemanalPage({
  searchParams,
}: {
  searchParams: { unidadeId?: string };
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
        Escolha uma casa no menu — consumo é de uma despensa, e somar todas esconderia a casa que
        está com problema.
      </div>
    );
  }
  if (!unidadeVisivel(user.papel, user.unidadeId, casaId)) {
    return <div className="empty">Você não tem acesso a essa casa.</div>;
  }

  const despensaId = await idDaUnidadeFisica(casaId);
  const casa = ctx.casas.find((c) => c.id === casaId);
  // A venda é da CASA; o estoque é da DESPENSA. Noroeste e Matri dividem a
  // despensa, então o consumo delas só se compara com a venda das duas juntas
  // — ver src/lib/unidade-fisica.ts.
  const casasDaDespensa = await casasDaUnidadeFisica(despensaId);

  const [contagens, entradas, precos, vendas, compras] = await Promise.all([
    prisma.contagemEstoque.findMany({
      where: { unidadeId: despensaId },
      select: { produtoId: true, quantidadeContada: true, criadoEm: true },
    }),
    prisma.movimentoEstoque.findMany({
      where: { unidadeId: despensaId, tipo: { in: [...TIPOS_DE_ENTRADA] } },
      select: { produtoId: true, quantidade: true, criadoEm: true },
    }),
    prisma.precoAtualProduto.findMany({
      where: { unidadeId: despensaId },
      select: { produtoId: true, preco: true },
    }),
    prisma.vendaSemanal.findMany({
      where: { unidadeId: { in: casasDaDespensa } },
      select: {
        periodoInicio: true,
        itens: { select: { quantidadeVendida: true, valorVendido: true, itemVenda: { select: { precoVenda: true } } } },
      },
    }),
    prisma.itemNotaCompra.findMany({
      where: { notaCompra: { unidadeId: despensaId } },
      select: { produtoId: true, dataCompra: true, valorTotal: true, quantidade: true, precoUnitNovo: true },
    }),
  ]);

  const precoPorProduto = new Map(precos.map((p) => [p.produtoId, p.preco]));

  const consumos = consumoPorPeriodoPuro(
    contagens.map((c) => ({ produtoId: c.produtoId, quantidade: c.quantidadeContada, em: c.criadoEm })),
    entradas.map((m) => ({ produtoId: m.produtoId, quantidade: m.quantidade, em: m.criadoEm }))
  );
  // Quem foi contado em alguma ponta: é a régua da cobertura.
  const contados = new Set(contagens.map((c) => c.produtoId));

  const vendaPorSemana = new Map<string, number>();
  for (const v of vendas) {
    const semana = segundaDaDataPura(v.periodoInicio);
    const total = v.itens.reduce(
      (s, i) => s + (i.valorVendido ?? i.quantidadeVendida * (i.itemVenda?.precoVenda ?? 0)),
      0
    );
    vendaPorSemana.set(semana, (vendaPorSemana.get(semana) ?? 0) + total);
  }

  const compraPorSemana = new Map<string, number>();
  const compraContadaPorSemana = new Map<string, number>();
  for (const l of compras) {
    const semana = segundaDaDataPura(l.dataCompra);
    const valor = l.valorTotal ?? (l.quantidade === null ? 0 : l.quantidade * l.precoUnitNovo);
    compraPorSemana.set(semana, (compraPorSemana.get(semana) ?? 0) + valor);
    if (l.produtoId && contados.has(l.produtoId)) {
      compraContadaPorSemana.set(semana, (compraContadaPorSemana.get(semana) ?? 0) + valor);
    }
  }

  const linhas = cmvSemanalPuro({
    consumos,
    precoPorProduto,
    vendaPorSemana,
    compraPorSemana,
    compraContadaPorSemana,
  }).slice(0, 12);

  // SEMANA FECHADA é a que teve contagem nas DUAS pontas — ela existe mesmo
  // sem venda carregada, e o consumo dela é real. O CMV é que precisa da
  // venda: sem ela há consumo, não há percentual. Misturar os dois fazia o
  // cartão dizer "0 semanas" com uma semana contada logo abaixo na tabela.
  const fechadas = linhas.filter((l) => l.itens > 0);
  const comVenda = fechadas.filter((l) => l.venda > 0);
  const media =
    comVenda.length > 0
      ? comVenda.reduce((s, l) => s + l.consumo, 0) / comVenda.reduce((s, l) => s + l.venda, 0)
      : null;

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">
          <Link href="/estoque">← Estoque</Link>
        </p>
        <h1>CMV semanal (contado)</h1>
        <p className="sub-explica">
          {casa?.nome}. Este é o CMV que sai da <strong>prateleira</strong>: contagem da segunda,
          mais o que entrou na semana, menos a contagem da segunda seguinte. É o único dos três que
          pega furo — desvio, porção fora do padrão, mercadoria que foi embora.
        </p>
      </div>

      <div className="cards">
        <div className="card">
          <p className="eyebrow">Semanas fechadas</p>
          <p className="big">{fechadas.length}</p>
          <p className="hint">
            {fechadas.length === 0
              ? "é preciso contar em duas segundas seguidas"
              : comVenda.length < fechadas.length
                ? `${fechadas.length - comVenda.length} sem venda carregada — há consumo, não há CMV`
                : "cada uma com contagem nas duas pontas"}
          </p>
        </div>
        <div className="card">
          <p className="eyebrow">CMV médio do período</p>
          <p className="big">{pct(media)}</p>
          <p className="hint">consumo somado ÷ venda somada, não média das médias</p>
        </div>
        <div className="card">
          <p className="eyebrow">Última semana</p>
          <p className="big">{fechadas[0] ? pct(fechadas[0].cmv) : "—"}</p>
          <p className="hint">
            {fechadas[0] ? `${rotulo(fechadas[0].semana)} · ${fechadas[0].itens} itens` : "ainda sem período fechado"}
          </p>
        </div>
      </div>

      {linhas.length === 0 ? (
        <div className="empty">
          Nenhuma semana com contagem ainda. O primeiro CMV contado aparece depois da{" "}
          <strong>segunda contagem</strong> — a primeira é só o marco zero.
        </div>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Semana</th>
                <th className="num">Consumo contado</th>
                <th className="num">Venda</th>
                <th className="num">CMV</th>
                <th className="num">Itens</th>
                <th className="num">Cobertura</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.semana}>
                  <td>{rotulo(l.semana)}</td>
                  <td className="num">{l.consumo > 0 ? fmtCurrency(l.consumo) : "—"}</td>
                  <td className="num">{l.venda > 0 ? fmtCurrency(l.venda) : "—"}</td>
                  <td className="num">
                    <strong>{pct(l.cmv)}</strong>
                    {l.negativos > 0 ? (
                      <span className="tag warn" title="consumo negativo: entrada que não chegou ao sistema, ou contagem na unidade errada">
                        {" "}
                        {l.negativos} negativo{l.negativos > 1 ? "s" : ""}
                      </span>
                    ) : null}
                  </td>
                  <td className="num">{l.itens || "—"}</td>
                  <td className="num">{pct(l.cobertura)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="sub-explica" style={{ marginTop: 14 }}>
            <strong>Cobertura</strong> é quanto da compra da semana está representada pelos itens
            contados nas duas pontas. A contagem pega a curva A inteira e metade da B, então ela
            nunca é 100% — e um CMV de 22% sobre 60% da compra não é 22%. Linha com{" "}
            <strong>negativo</strong> tem produto em que se contou mais do que poderia existir: quase
            sempre é entrada que não chegou ao sistema (compra fora do Teknisa, transferência entre
            casas) ou contagem na unidade errada, caixa contada como quilo.
          </p>
        </>
      )}
    </div>
  );
}
