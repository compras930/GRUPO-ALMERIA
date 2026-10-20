import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { unidadeVisivel } from "@/lib/permissions";
import { idDaUnidadeFisica } from "@/lib/unidade-fisica";
import { fmtCurrency } from "@/lib/format";
import { totaisPorCategoriaPura, SEM_CATEGORIA } from "@/lib/painel-categoria";
import { curvaAbcPura, resumoAbcPura, CORTE_A } from "@/lib/curva-abc";
import { carregarIndiceReceitas, carregarPrecoAtualPorProduto, explodirReceitaPura, CicloReceitaError } from "@/lib/receita";

/**
 * O painel: o que a casa VENDEU, o que COMPROU e qual o CMV teórico, com a
 * compra aberta por categoria e por item.
 *
 * TEÓRICO, E A PALAVRA IMPORTA. Este CMV vem da ficha técnica: quantidade
 * vendida × custo da ficha. Ele responde "quanto DEVERIA ter sido gasto pra
 * fazer o que foi vendido". O CMV contado — o que saiu de verdade da despensa
 * entre duas contagens — é outro número, e mora em /estoque/consumo. A
 * diferença entre os dois é justamente o que o projeto existe pra enxergar:
 * receita mal executada, perda, ou coisa sumindo. Somar ou confundir os dois
 * apaga a única pergunta que interessa.
 */
const PERIODOS = [30, 90] as const;
const TOP = 15;

/**
 * Barras horizontais de uma medida só (reais) por categoria.
 *
 * UMA SÉRIE, UMA COR. A cor não carrega informação aqui — o comprimento já
 * diz tudo. Pintar cada categoria de um tom gastaria o único canal livre
 * repetindo o que a barra mostra, e mandaria o leitor procurar um significado
 * que não existe. A única exceção é o cinza do "Sem categoria", que não é uma
 * categoria entre outras: é o buraco de cadastro.
 */
function BarrasPorCategoria({ dados }: { dados: { categoria: string; valor: number; pct: number }[] }) {
  const maior = Math.max(1, ...dados.map((d) => d.valor));
  return (
    <div className="barras">
      {dados.map((c) => (
        <div className="barra-linha" key={c.categoria} title={`${c.categoria}: ${fmtCurrency(c.valor)}`}>
          <span className="barra-rotulo">{c.categoria}</span>
          <span className="barra-trilho">
            <span
              className={`barra-preenchida${c.categoria === SEM_CATEGORIA ? " vazia" : ""}`}
              style={{ width: `${Math.max(1, (100 * c.valor) / maior)}%`, display: "block" }}
            />
          </span>
          <span className="barra-valor">
            {fmtCurrency(c.valor)}
            <span className="pct">{c.pct.toFixed(1)}%</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { dias?: string; unidadeId?: string };
}) {
  const user = await requireSession();
  const isAdmin = user.papel === "ADMIN";

  const dias = PERIODOS.includes(Number(searchParams.dias) as (typeof PERIODOS)[number])
    ? Number(searchParams.dias)
    : 30;
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

  const casas = await prisma.unidade.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } });

  // Quem não é ADMIN nunca escolhe: é sempre a própria casa, venha o que vier
  // na URL. O seletor é conveniência de quem vê tudo, não uma porta.
  const pedida = isAdmin ? searchParams.unidadeId : user.unidadeId ?? undefined;
  const casaId = pedida && unidadeVisivel(user.papel, user.unidadeId, pedida) ? pedida : null;
  const casa = casaId ? casas.find((c) => c.id === casaId) ?? null : null;

  // Compra segue a DESPENSA e venda segue a CASA — ver src/lib/unidade-fisica.ts.
  const despensaId = casaId ? await idDaUnidadeFisica(casaId) : null;
  const escopoCompra = despensaId ? { unidadeId: despensaId } : {};
  const escopoVenda = casaId ? { unidadeId: casaId } : {};

  const [linhasCompra, vendas] = await Promise.all([
    // TODAS as linhas da nota no período, inclusive as que não casaram com
    // produto: o painel é de DINHEIRO GASTO, e linha não reconhecida também
    // foi paga. Elas caem em "Sem categoria" — que é onde de fato estão,
    // faltando cadastro.
    prisma.itemNotaCompra.findMany({
      where: { dataCompra: { gte: desde }, notaCompra: escopoCompra },
      select: {
        valorTotal: true,
        quantidade: true,
        precoUnitNovo: true,
        produto: { select: { id: true, nome: true, unidadeMedida: true, categoria: true } },
        nomeBruto: true,
        unidadeBruta: true,
      },
    }),
    prisma.itemVendaSemanal.findMany({
      where: { vendaSemanal: { ...escopoVenda, periodoFim: { gte: desde } } },
      select: {
        quantidadeVendida: true,
        itemVenda: { select: { id: true, nome: true, categoria: true, precoVenda: true, receitaId: true } },
      },
    }),
  ]);

  const valorDaLinha = (l: (typeof linhasCompra)[number]) =>
    l.valorTotal ?? (l.quantidade === null ? 0 : l.quantidade * l.precoUnitNovo);

  const compraPorCategoria = totaisPorCategoriaPura(
    linhasCompra.map((l) => ({ categoria: l.produto?.categoria ?? null, valor: valorDaLinha(l) }))
  );
  // O faturamento é CALCULADO aqui: a rota de vendas traz só quantidade, e o
  // valor sai do preço de venda cadastrado. Preço de cardápio desatualizado
  // erra este número e, com ele, o CMV inteiro.
  const vendaPorCategoria = totaisPorCategoriaPura(
    vendas.map((v) => ({
      categoria: v.itemVenda?.categoria ?? null,
      valor: v.quantidadeVendida * (v.itemVenda?.precoVenda ?? 0),
    }))
  );

  const totalCompra = compraPorCategoria.reduce((s, c) => s + c.valor, 0);
  const totalVenda = vendaPorCategoria.reduce((s, c) => s + c.valor, 0);

  // Curva ABC da COMPRA, por item. Linha sem produto entra agrupada pelo nome
  // bruto: ela é dinheiro gasto e precisa aparecer no ranking, mesmo sem
  // cadastro — é assim que ela vira tarefa em vez de sumir.
  const porItem = new Map<string, { id: string; nome: string; unidadeMedida: string; categoria: string | null; valor: number }>();
  for (const l of linhasCompra) {
    const chave = l.produto?.id ?? `bruto:${l.nomeBruto.toLowerCase()}|${l.unidadeBruta ?? ""}`;
    const atual = porItem.get(chave);
    if (atual) atual.valor += valorDaLinha(l);
    else
      porItem.set(chave, {
        id: chave,
        nome: l.produto?.nome ?? l.nomeBruto,
        unidadeMedida: l.produto?.unidadeMedida ?? l.unidadeBruta ?? "",
        categoria: l.produto?.categoria ?? null,
        valor: valorDaLinha(l),
      });
  }
  const abc = curvaAbcPura([...porItem.values()]);
  const resumoAbc = resumoAbcPura(abc);
  const top = abc.slice(0, TOP);

  // CMV TEÓRICO: custo de ficha × quantidade vendida, dividido pelo
  // faturamento. Só existe com venda carregada E ficha cadastrada; o número de
  // itens sem ficha vai junto na tela, porque um CMV teórico calculado sobre
  // metade do cardápio não é um CMV baixo, é um CMV incompleto.
  let custoTeorico = 0;
  let vendaComFicha = 0;
  let itensSemFicha = 0;
  if (casaId && vendas.length > 0) {
    const [indice, precos] = await Promise.all([
      carregarIndiceReceitas(casaId),
      carregarPrecoAtualPorProduto(casaId),
    ]);
    const semFicha = new Set<string>();
    for (const v of vendas) {
      const item = v.itemVenda;
      if (!item) continue;
      if (!item.receitaId) {
        semFicha.add(item.id);
        continue;
      }
      try {
        const receita = indice.get(item.receitaId);
        const base = receita?.rendimentoQtd && receita.rendimentoQtd > 0 ? receita.rendimentoQtd : 1;
        const insumos = explodirReceitaPura(item.receitaId, base, indice);
        let custoLote = 0;
        for (const [produtoId, qtd] of insumos) custoLote += qtd * (precos.get(produtoId) ?? 0);
        const custoUnit = receita?.rendimentoQtd && receita.rendimentoQtd > 0 ? custoLote / receita.rendimentoQtd : custoLote;
        custoTeorico += custoUnit * v.quantidadeVendida;
        vendaComFicha += v.quantidadeVendida * item.precoVenda;
      } catch (e) {
        // Ficha em ciclo não derruba o painel inteiro: ela some da conta e
        // aparece como "sem ficha", que é o que ela é na prática até alguém
        // corrigir. Ver /cmv, que mostra o ciclo com nome e tudo.
        if (e instanceof CicloReceitaError) semFicha.add(item.id);
        else throw e;
      }
    }
    itensSemFicha = semFicha.size;
  }
  const cmvTeorico = vendaComFicha > 0 ? (100 * custoTeorico) / vendaComFicha : null;

  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    p.set("dias", String(dias));
    if (casaId) p.set("unidadeId", casaId);
    for (const [k, v] of Object.entries(extra)) {
      if (v === undefined) p.delete(k);
      else p.set(k, v);
    }
    return `/dashboard?${p.toString()}`;
  };

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">Grupo Almeria</p>
        <h1>Painel</h1>
        <p className="sub-explica">
          {casa ? casa.nome : "Todas as casas"} · últimos {dias} dias. Compra segue a despensa e venda
          segue a casa, e a compra entra pela data da NOTA — não pela data da carga.
        </p>

        <div className="filtros">
          {isAdmin && (
            <div className="filtro">
              <span className="filtro-rotulo">Casa</span>
              <div className="tabbar discreta">
              <Link href={qs({ unidadeId: undefined })} className={`chip${!casaId ? " ativo" : ""}`}>
                Todas
              </Link>
              {casas.map((c) => (
                <Link key={c.id} href={qs({ unidadeId: c.id })} className={`chip${casaId === c.id ? " ativo" : ""}`}>
                  {c.nome}
                </Link>
                ))}
              </div>
            </div>
          )}
          <div className="filtro">
            <span className="filtro-rotulo">Período</span>
            <div className="tabbar discreta">
              {PERIODOS.map((d) => (
              <Link key={d} href={qs({ dias: String(d) })} className={`chip${dias === d ? " ativo" : ""}`}>
                  {d} dias
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <p className="lbl">Vendas</p>
          <div className="val">{totalVenda > 0 ? fmtCurrency(totalVenda) : "—"}</div>
          <p className="sub">
            {totalVenda > 0 ? "faturamento calculado pelo preço de venda" : "nenhuma venda carregada"}
          </p>
        </div>
        <div className="kpi">
          <p className="lbl">Compras</p>
          <div className="val">{fmtCurrency(totalCompra)}</div>
          <p className="sub">{linhasCompra.length} linhas de nota</p>
        </div>
        <div className="kpi destaque">
          <p className="lbl">CMV teórico</p>
          <div className="val">{cmvTeorico === null ? "—" : `${cmvTeorico.toFixed(1)}%`}</div>
          <p className="sub">
            {cmvTeorico === null
              ? "precisa de venda carregada e ficha técnica"
              : itensSemFicha > 0
                ? itensSemFicha === 1
                  ? "1 item vendido sem ficha ficou de fora"
                  : `${itensSemFicha} itens vendidos sem ficha ficaram de fora`
                : "todo item vendido tem ficha"}
          </p>
        </div>
      </div>

      <div className="duas-colunas">
        <div className="card">
          <h2 style={{ fontSize: 15, marginBottom: 4 }}>Compras por categoria</h2>
          <p className="sub-explica" style={{ marginBottom: 16 }}>
            {fmtCurrency(totalCompra)} no período, pelo valor da nota (com imposto e frete).
          </p>
          {compraPorCategoria.length === 0 ? (
            <div className="empty">Nenhuma compra carregada neste período.</div>
          ) : (
            <BarrasPorCategoria dados={compraPorCategoria} />
          )}
          {compraPorCategoria.some((c) => c.categoria === SEM_CATEGORIA) && (
            <p className="sub-explica" style={{ marginTop: 14 }}>
              A barra cinza é compra de produto sem categoria cadastrada. Ela conta no total — o
              painel fecha com a nota — e o tamanho dela é o que falta cadastrar.
            </p>
          )}
        </div>

        <div className="card">
          <h2 style={{ fontSize: 15, marginBottom: 4 }}>Vendas por categoria</h2>
          <p className="sub-explica" style={{ marginBottom: 16 }}>
            Faturamento = quantidade vendida × preço de venda cadastrado. O app não recebe valor do
            painel; preço de cardápio desatualizado erra este número.
          </p>
          {vendaPorCategoria.length === 0 ? (
            <div className="empty">
              Nenhuma venda carregada. A rota <code>/api/n8n/vendas-semanais</code> ainda não rodou —
              sem ela não há faturamento, e sem faturamento não há CMV.
            </div>
          ) : (
            <BarrasPorCategoria dados={vendaPorCategoria} />
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 15, marginBottom: 4 }}>Curva ABC da compra — top {TOP}</h2>
        <p className="sub-explica" style={{ marginBottom: 16 }}>
          Classe A são os itens que respondem pelos primeiros {CORTE_A}% do dinheiro. São eles que
          mudam o CMV quando o preço se mexe, e são eles que a contagem semanal cobre.
        </p>

        {abc.length === 0 ? (
          <div className="empty">Nenhuma compra carregada neste período.</div>
        ) : (
          <>
            <div className="kpis" style={{ marginBottom: 18 }}>
              {resumoAbc.map((r) => (
                <div className="kpi" key={r.classe}>
                  <p className="lbl">Classe {r.classe}</p>
                  <div className="val">{r.itens}</div>
                  <p className="sub">
                    {fmtCurrency(r.valor)} · {r.pct.toFixed(1)}% do gasto
                  </p>
                </div>
              ))}
            </div>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>item</th>
                  <th>categoria</th>
                  <th className="num" style={{ width: 120 }}>comprado</th>
                  <th className="num" style={{ width: 60 }}>%</th>
                  <th className="num" style={{ width: 80 }}>acum.</th>
                  <th style={{ width: 60 }}>classe</th>
                </tr>
              </thead>
              <tbody>
                {top.map((i) => (
                  <tr key={i.id}>
                    <td className="num">{i.posicao}</td>
                    <td>
                      {i.nome}
                      {i.unidadeMedida ? <span className="cat"> · {i.unidadeMedida}</span> : null}
                    </td>
                    <td className="cat">{i.categoria ?? "—"}</td>
                    <td className="num">{fmtCurrency(i.valor)}</td>
                    <td className="num">{i.pct.toFixed(1)}%</td>
                    <td className="num">{i.acumulado.toFixed(1)}%</td>
                    <td>
                      <span className={`tag${i.classe === "A" ? " warn" : ""}`}>{i.classe}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {abc.length > TOP && (
              <p className="sub-explica" style={{ marginTop: 14 }}>
                Mais {abc.length - TOP} itens fora do top {TOP}, somando{" "}
                {fmtCurrency(abc.slice(TOP).reduce((s, i) => s + i.valor, 0))}.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
