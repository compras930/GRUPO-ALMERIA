import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { unidadeVisivel } from "@/lib/permissions";
import { idDaUnidadeFisica } from "@/lib/unidade-fisica";
import { fmtCurrency } from "@/lib/format";
import { totaisPorCategoriaPura, SEM_CATEGORIA } from "@/lib/painel-categoria";
import { curvaAbcPura, resumoAbcPura, CORTE_A } from "@/lib/curva-abc";
import { ehEnxuto } from "@/lib/escopo-cmv";
import { carregarIndiceReceitas, carregarPrecoAtualPorProduto, explodirReceitaPura, CicloReceitaError } from "@/lib/receita";
import { calcularConsumoPuro, TIPOS_DE_ENTRADA } from "@/lib/consumo";
import { mesDaChave, mesDaData, ultimosMeses, rotuloCurto } from "@/lib/mes";

/**
 * O painel: o que a casa VENDEU, o que COMPROU e os DOIS CMV, com a compra
 * aberta por categoria e por item.
 *
 * OS DOIS CMV, E POR QUE SÃO DOIS.
 *
 *   TEÓRICO  vem da ficha: quantidade vendida × custo da ficha. Responde
 *            "quanto DEVERIA ter sido gasto pra fazer o que foi vendido".
 *   CONTADO  vem do inventário: saldo antes + entradas − saldo depois.
 *            Responde "quanto SAIU da despensa de verdade".
 *
 * A diferença entre eles é o que o projeto existe pra enxergar — receita mal
 * executada, perda, ou coisa sumindo. Por isso ficam lado a lado e com nome
 * diferente, e por isso nunca se somam.
 *
 * Eles também não medem a mesma JANELA: o teórico é do mês escolhido; o
 * contado é das contagens, que cada produto fecha quando é contado. O card do
 * contado mostra as datas que mediu, em vez de herdar o rótulo do mês.
 */
/** Quantos meses o seletor oferece pra trás. */
const MESES_NO_SELETOR = 6;
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
  searchParams: { mes?: string; unidadeId?: string };
}) {
  const user = await requireSession();
  const isAdmin = user.papel === "ADMIN";

  const agora = new Date();
  const meses = ultimosMeses(agora, MESES_NO_SELETOR);
  const mes = mesDaChave(searchParams.mes) ?? mesDaData(agora);

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
      where: { dataCompra: { gte: mes.inicio, lt: mes.fim }, notaCompra: escopoCompra },
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
      // A venda entra pelo FIM do período: uma semana que fecha dia 2 é venda
      // de quem a recebeu, e contá-la pelo começo jogaria toda virada de mês
      // pro mês anterior.
      where: { vendaSemanal: { ...escopoVenda, periodoFim: { gte: mes.inicio, lt: mes.fim } } },
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
  // ENXUTO × CHEIO, o mesmo corte do painel de compras: o enxuto é o que vira
  // prato vendido e é o número que se compara com a meta — a casa não controla
  // CMV comprando menos detergente. O cheio é o que saiu do caixa.
  const compraEnxuta = compraPorCategoria.filter((c) => ehEnxuto(c.categoria)).reduce((s, c) => s + c.valor, 0);
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
  // CMV DE COMPRAS: compras ÷ vendas do mesmo mês. É o que o painel de compras
  // mostra, e é um PROXY — ele supõe que o estoque não mudou no período. Numa
  // semana em que a casa estoca vinho pra um evento, ele acusa CMV alto sem
  // nada ter saído da despensa. É o único número possível antes de existir
  // contagem, e por isso fica aqui nomeado como o que é, ao lado dos outros.
  const cmvComprasEnxuto = totalVenda > 0 ? (100 * compraEnxuta) / totalVenda : null;
  const cmvComprasCheio = totalVenda > 0 ? (100 * totalCompra) / totalVenda : null;

  // CMV CONTADO (real): o que SAIU da despensa entre duas contagens, valorizado
  // a preço atual, sobre o faturamento da mesma janela.
  //
  //   consumo = saldo contado antes + entradas do período − saldo contado depois
  //
  // Ele não depende de ficha técnica nenhuma — é a diferença entre dois
  // inventários. E não depende do mês escolhido lá em cima: a janela é a das
  // CONTAGENS, que cada produto fecha quando é contado. Por isso o card mostra
  // as datas que ele de fato mediu, em vez de herdar o rótulo do mês; herdar
  // seria dizer "outubro" para um número que mede outra coisa.
  let cmvContado: number | null = null;
  let consumoValor = 0;
  let janela: { de: Date; ate: Date } | null = null;
  let produtosContados = 0;
  if (despensaId) {
    const [contagens, entradas, precosDespensa] = await Promise.all([
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
    ]);
    const linhas = calcularConsumoPuro(
      contagens.map((c) => ({ produtoId: c.produtoId, quantidade: c.quantidadeContada, em: c.criadoEm })),
      entradas.map((m) => ({ produtoId: m.produtoId, quantidade: m.quantidade, em: m.criadoEm }))
    );
    if (linhas.length > 0) {
      const preco = new Map(precosDespensa.map((x) => [x.produtoId, x.preco]));
      // Consumo negativo é impossível fisicamente e já vem sinalizado; somá-lo
      // aqui abateria o consumo de outro produto e esconderia os dois erros de
      // uma vez. Fica de fora, e a tela de Consumo mostra quais são.
      for (const l of linhas) if (l.consumo > 0) consumoValor += l.consumo * (preco.get(l.produtoId) ?? 0);
      produtosContados = linhas.length;
      janela = {
        de: new Date(Math.min(...linhas.map((l) => l.de.getTime()))),
        ate: new Date(Math.max(...linhas.map((l) => l.ate.getTime()))),
      };
      const vendasJanela = await prisma.itemVendaSemanal.findMany({
        where: {
          vendaSemanal: { ...escopoVenda, periodoFim: { gt: janela.de, lte: janela.ate } },
        },
        select: { quantidadeVendida: true, itemVenda: { select: { precoVenda: true } } },
      });
      const faturamentoJanela = vendasJanela.reduce(
        (soma, v) => soma + v.quantidadeVendida * (v.itemVenda?.precoVenda ?? 0),
        0
      );
      if (faturamentoJanela > 0) cmvContado = (100 * consumoValor) / faturamentoJanela;
    }
  }
  const dataCurta = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    p.set("mes", mes.chave);
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
          {casa ? casa.nome : "Todas as casas"} · {mes.rotulo}. Compra segue a despensa e venda segue a
          casa, e a compra entra pela data da NOTA — não pela data da carga.
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
            <span className="filtro-rotulo">Mês</span>
            <div className="tabbar discreta">
              {meses.map((m) => (
                <Link
                  key={m.chave}
                  href={qs({ mes: m.chave })}
                  className={`chip${mes.chave === m.chave ? " ativo" : ""}`}
                >
                  {rotuloCurto(m)}
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
          <p className="sub">
            {fmtCurrency(compraEnxuta)} enxuto · {linhasCompra.length} linhas de nota
          </p>
        </div>
      </div>

      {/*
        OS TRÊS CMV, numa tabela e não em três tiles.

        Três porcentagens soltas lado a lado convidam à leitura errada — a de
        que uma delas é "a certa" e as outras são variação. Elas medem coisas
        diferentes, em janelas diferentes, e é a DIFERENÇA entre elas que
        carrega a informação. Em tabela, cada linha pode dizer o que responde e
        sobre que período, que é o mínimo pra ninguém comparar maçã com laranja.
      */}
      <div className="card" style={{ marginTop: 4 }}>
        <h2 style={{ fontSize: 15, marginBottom: 4 }}>Os três CMV</h2>
        <p className="sub-explica" style={{ marginBottom: 16 }}>
          Eles vão discordar, e isso não é defeito — é a informação. Enxuto é matéria-prima,
          bebidas e vinhos; cheio é tudo o que foi comprado.
        </p>
        <table>
          <thead>
            <tr>
              <th>medida</th>
              <th className="num" style={{ width: 90 }}>valor</th>
              <th>o que responde</th>
              <th style={{ width: 170 }}>janela</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Compras ÷ vendas — enxuto</td>
              <td className="num">{cmvComprasEnxuto === null ? "—" : `${cmvComprasEnxuto.toFixed(1)}%`}</td>
              <td className="cat">quanto comprei de insumo em relação ao que vendi</td>
              <td className="cat">{mes.rotulo}</td>
            </tr>
            <tr>
              <td>Compras ÷ vendas — cheio</td>
              <td className="num">{cmvComprasCheio === null ? "—" : `${cmvComprasCheio.toFixed(1)}%`}</td>
              <td className="cat">o mesmo, somando embalagem, higiene, funcionário e eventos</td>
              <td className="cat">{mes.rotulo}</td>
            </tr>
            <tr>
              <td>Teórico (ficha técnica)</td>
              <td className="num">{cmvTeorico === null ? "—" : `${cmvTeorico.toFixed(1)}%`}</td>
              <td className="cat">quanto DEVERIA ter sido gasto pra fazer o que foi vendido</td>
              <td className="cat">
                {cmvTeorico === null
                  ? "precisa de venda e ficha"
                  : itensSemFicha > 0
                    ? `${mes.rotulo} · ${itensSemFicha} ${itensSemFicha === 1 ? "item sem ficha de fora" : "itens sem ficha de fora"}`
                    : mes.rotulo}
              </td>
            </tr>
            <tr>
              <td>
                <strong>Contado (inventário)</strong>
              </td>
              <td className="num">
                <strong>{cmvContado === null ? "—" : `${cmvContado.toFixed(1)}%`}</strong>
              </td>
              <td className="cat">quanto SAIU da despensa de verdade</td>
              <td className="cat">
                {janela === null
                  ? "precisa de duas contagens do mesmo produto"
                  : `${dataCurta(janela.de)} a ${dataCurta(janela.ate)} · ${produtosContados} produtos`}
              </td>
            </tr>
          </tbody>
        </table>
        {janela !== null && cmvContado === null && (
          <p className="sub-explica" style={{ marginTop: 14 }}>
            O consumo contado foi de {fmtCurrency(consumoValor)}, mas não há venda carregada nessa
            janela — sem denominador não há percentual.
          </p>
        )}
        <p className="sub-explica" style={{ marginTop: 14 }}>
          <strong>Compras ÷ vendas é um proxy:</strong> ele supõe que o estoque não mudou. Numa
          semana em que a casa estoca vinho para um evento, acusa CMV alto sem nada ter saído da
          despensa. É o único número possível antes de existir contagem — e é por isso que o contado
          está em negrito.
        </p>
      </div>

      <div className="duas-colunas">
        <div className="card">
          <h2 style={{ fontSize: 15, marginBottom: 4 }}>Compras por categoria</h2>
          <p className="sub-explica" style={{ marginBottom: 16 }}>
            {fmtCurrency(totalCompra)} em {mes.rotulo}, pelo valor da nota (com imposto e frete).
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
