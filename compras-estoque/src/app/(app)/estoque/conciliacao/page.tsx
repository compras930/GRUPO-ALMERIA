import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { unidadesComEstoqueProprio, idDaUnidadeFisica, casasDaUnidadeFisica } from "@/lib/unidade-fisica";
import { requireAdmin } from "@/lib/session";
import { TIPOS_DE_ENTRADA } from "@/lib/consumo";
import { TIPO_PERDA } from "@/lib/constants";
import { conciliarPuro, totalizarPuro, type ParcelasProduto } from "@/lib/conciliacao";
import { fmtCurrency } from "@/lib/format";
import { calcularCmvTeorico } from "@/lib/cmv-teorico";
import { faturamentoDaLinhaPura } from "@/lib/faturamento";
import { ehCategoriaDeEventoPura } from "@/lib/categoria-venda";
import { quebrarFaltaPura, filaDeFichasPura, type VendaSemFichaResumo } from "@/lib/consumo-sem-ficha";
import { carregarContexto } from "@/lib/selecao-db";
import { mesDaChave } from "@/lib/mes";
import {
  conferenciaMensalPura,
  contagensPorSemanaPura,
  semanasDoMesPuras,
  segundaPura,
} from "@/lib/conferencia-mensal";
import TabelaConferencia from "@/components/TabelaConferencia";

/**
 * A conferência da contagem — ver src/lib/conciliacao.ts para a conta.
 *
 * SÓ ADMIN, e não por sigilo: é uma tela que ACUSA, e quem conta não deve ler
 * o próprio resultado antes de quem vai conversar com ele sobre o resultado.
 *
 * Cada produto é um PERÍODO PRÓPRIO: entre as duas últimas contagens DELE, que
 * no rodízio não são as mesmas datas para todo mundo. Somar tudo numa janela
 * única de calendário misturaria compra de um produto com contagem de outro.
 */
const data = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
/**
 * DUAS CASAS, e não três.
 *
 * A terceira casa é ruído de balança lido como precisão: ninguém conta 2,375 kg
 * de picanha, e o dígito a mais faz a coluna inteira parecer um número de
 * laboratório. Quem precisa do valor exato tem a diferença em reais ao lado.
 */
const qtd = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const rotuloDaSemana = (semana: string) => `${semana.slice(8, 10)}/${semana.slice(5, 7)}`;

export default async function ConciliacaoPage({
  searchParams,
}: {
  searchParams: { unidadeId?: string; mes?: string; vista?: string };
}) {
  await requireAdmin();
  // A casa vem do menu lateral; a URL ainda manda quando vem preenchida.
  // Ver src/lib/selecao.ts.
  const unidades = await unidadesComEstoqueProprio();
  const ctx = await carregarContexto({ papel: "ADMIN", unidadeId: null }, searchParams);
  const escolhida = ctx.casaId || unidades[0]?.id;
  const unidadeId = escolhida ? await idDaUnidadeFisica(escolhida) : null;
  if (!unidadeId) return <div className="empty">Nenhuma unidade com estoque próprio.</div>;
  // Duas perguntas, duas vistas: "o que faltou na última contagem" (segunda de
  // manhã) e "o que falta toda semana" (fim do mês). A segunda só existe
  // porque uma falta isolada e uma falta repetida pedem conversas diferentes.
  const vista = searchParams.vista === "mes" ? "mes" : "semana";
  const mes = mesDaChave(ctx.mes);
  const q = (extra: Record<string, string>) =>
    "?" + new URLSearchParams({ ...(escolhida ? { unidadeId: escolhida } : {}), ...extra }).toString();

  const [contagens, movimentos, precos, produtos] = await Promise.all([
    prisma.contagemEstoque.findMany({
      where: { unidadeId },
      orderBy: { criadoEm: "asc" },
      select: { produtoId: true, quantidadeContada: true, criadoEm: true },
    }),
    // Entradas, baixa de venda e perdas num só carregamento: são a mesma
    // tabela, e três consultas sobre ela só multiplicariam ida e volta.
    prisma.movimentoEstoque.findMany({
      where: {
        unidadeId,
        tipo: { in: [...TIPOS_DE_ENTRADA, "SAIDA_CONSUMO", ...TIPO_PERDA] },
      },
      select: { produtoId: true, tipo: true, quantidade: true, criadoEm: true },
    }),
    prisma.precoAtualProduto.findMany({ where: { unidadeId }, select: { produtoId: true, preco: true } }),
    prisma.produto.findMany({ select: { id: true, nome: true, unidadeMedida: true } }),
  ]);

  const porProduto = new Map<string, { quantidadeContada: number; criadoEm: Date }[]>();
  for (const c of contagens) {
    porProduto.set(c.produtoId, [...(porProduto.get(c.produtoId) ?? []), c]);
  }

  const precoPorProduto = new Map(precos.map((p) => [p.produtoId, p.preco]));
  const nomePorProduto = new Map(produtos.map((p) => [p.id, p]));

  const parcelas: ParcelasProduto[] = [];
  const janela = new Map<string, { de: Date; ate: Date }>();

  for (const [produtoId, lista] of porProduto) {
    // Produto contado uma vez só é marco zero, não período fechado.
    if (lista.length < 2) continue;
    const anterior = lista[lista.length - 2];
    const atual = lista[lista.length - 1];
    janela.set(produtoId, { de: anterior.criadoEm, ate: atual.criadoEm });

    let comprado = 0;
    let vendido = 0;
    let perdaDeclarada = 0;
    for (const m of movimentos) {
      if (m.produtoId !== produtoId) continue;
      // Mesma régua do relatório de consumo: entrada no instante da contagem
      // anterior já estava na prateleira quando ela foi feita; no instante da
      // atual, ainda não.
      if (!(m.criadoEm > anterior.criadoEm && m.criadoEm <= atual.criadoEm)) continue;
      // As saídas são gravadas negativas; aqui elas são parcelas que SUBTRAEM,
      // então entram pelo módulo e o sinal mora na fórmula, não no dado.
      if (m.tipo === "SAIDA_CONSUMO") vendido += Math.abs(m.quantidade);
      else if ((TIPO_PERDA as readonly string[]).includes(m.tipo)) perdaDeclarada += Math.abs(m.quantidade);
      else comprado += m.quantidade;
    }

    parcelas.push({
      produtoId,
      saldoInicial: anterior.quantidadeContada,
      comprado,
      vendido,
      perdaDeclarada,
      saldoContado: atual.quantidadeContada,
      preco: precoPorProduto.get(produtoId) ?? 0,
    });
  }

  const linhas = conciliarPuro(parcelas);
  const totais = totalizarPuro(linhas);

  // ===================================================================
  // A VISTA DO MÊS e o aviso de casa que não contou.
  //
  // As semanas vêm do mês escolhido no menu, e começam na segunda que o mês
  // toca — inclusive a que começou no mês anterior, porque é a contagem dela
  // que abre o primeiro período.
  const semanas = mes ? semanasDoMesPuras(mes.inicio, new Date(mes.fim.getTime() - 1)) : [];
  const contagensBrutas = contagens.map((c) => ({
    produtoId: c.produtoId,
    quantidade: c.quantidadeContada,
    em: c.criadoEm,
  }));
  const porSemana = contagensPorSemanaPura(contagensBrutas, semanas);
  const linhasDoMes =
    vista === "mes"
      ? conferenciaMensalPura({
          contagens: contagensBrutas,
          movimentos: movimentos.map((m) => ({
            produtoId: m.produtoId,
            tipo: m.tipo,
            quantidade: m.quantidade,
            em: m.criadoEm,
          })),
          precoPorProduto: precoPorProduto,
          semanas,
          tiposDeEntrada: TIPOS_DE_ENTRADA,
          tiposDePerda: TIPO_PERDA,
        })
      : [];

  // SEMANA PASSADA SEM CONTAGEM é o aviso que importa: a semana corrente ainda
  // está acontecendo, e cobrar contagem na terça de manhã seria cobrar o que
  // ainda vai ser feito.
  const hoje = new Date();
  const semanaCorrente = segundaPura(hoje);
  // A primeira coluna costuma ser a semana que COMEÇOU no mês anterior — ela
  // existe porque é a contagem dela que abre o primeiro período. Mas cobrar
  // contagem dela aqui seria cobrar o mês passado na tela deste mês.
  const primeiroDiaDoMes = mes ? mes.inicio.toISOString().slice(0, 10) : "";
  const semanasFechadas = porSemana.filter(
    (s) => s.semana < semanaCorrente && s.semana >= primeiroDiaDoMes
  );
  const semContagem = semanasFechadas.filter((s) => s.produtos === 0);
  const contouNestaSemana = (porSemana.find((s) => s.semana === semanaCorrente)?.produtos ?? 0) > 0;

  // ===================================================================
  // DE ONDE VEM A FALTA — ver src/lib/consumo-sem-ficha.ts.
  //
  // A JANELA É A DA CASA, não a de cada produto. Acima, cada produto fecha
  // período quando é contado; aqui precisa de uma janela só, porque a venda
  // vem por SEMANA e não dá para recortar uma semana de venda no instante em
  // que um produto foi contado. Então: do dia da contagem anterior ao dia da
  // última, e entram as semanas de venda que FECHAM dentro disso.
  //
  // Isso é grosso, e de propósito grosso: uma semana que fecha dentro da
  // janela entra inteira. Com contagem semanal as duas quase coincidem; com
  // contagem fora de cadência, a estimativa fica larga — e é por isso que a
  // tela diz qual janela usou, em vez de só mostrar o número.
  const instantes = [...new Set(contagens.map((c) => c.criadoEm.toISOString().slice(0, 10)))].sort();
  const diaAnterior = instantes[instantes.length - 2] ?? null;
  const diaAtual = instantes[instantes.length - 1] ?? null;
  const janelaDaCasa =
    diaAnterior && diaAtual
      ? {
          de: new Date(`${diaAnterior}T00:00:00.000Z`),
          ate: new Date(`${diaAtual}T23:59:59.999Z`),
        }
      : null;

  const casas = await casasDaUnidadeFisica(unidadeId);
  const vendasDaJanela = janelaDaCasa
    ? await prisma.itemVendaSemanal.findMany({
        where: {
          vendaSemanal: {
            unidadeId: { in: casas },
            periodoFim: { gt: janelaDaCasa.de, lte: janelaDaCasa.ate },
          },
        },
        select: {
          quantidadeVendida: true,
          valorVendido: true,
          itemVenda: {
            select: { id: true, nome: true, categoria: true, precoVenda: true, receitaId: true },
          },
        },
      })
    : [];

  // O CMV teórico sai das MESMAS linhas da janela, não do mês: é a proporção
  // daquele período que vai ser aplicada à falta daquele período.
  const cmv = await calcularCmvTeorico(casas[0] ?? unidadeId, vendasDaJanela);

  // Agrupa por item: o mesmo prato aparece em várias semanas da janela.
  const porItem = new Map<string, VendaSemFichaResumo>();
  for (const v of vendasDaJanela) {
    const item = v.itemVenda;
    if (!item || item.receitaId) continue; // só o que NÃO tem ficha
    const faturamento = faturamentoDaLinhaPura({
      quantidadeVendida: v.quantidadeVendida,
      valorVendido: v.valorVendido,
      precoVenda: item.precoVenda,
    });
    const atual = porItem.get(item.id);
    if (atual) {
      atual.quantidadeVendida += v.quantidadeVendida;
      atual.faturamento += faturamento;
    } else {
      porItem.set(item.id, {
        itemVendaId: item.id,
        nome: item.nome,
        categoria: item.categoria,
        quantidadeVendida: v.quantidadeVendida,
        faturamento,
        ehEvento: ehCategoriaDeEventoPura(item.categoria),
      });
    }
  }
  const vendasSemFicha = [...porItem.values()];
  // A falta inteira: a dos produtos com ficha e a dos que nenhuma receita
  // menciona. As duas são mercadoria que a prateleira não tem e a conta
  // esperava, e as duas podem ter virado prato sem ficha.
  const faltaTotal = totais.faltaEmReais + totais.faltaSemFichaEmReais;
  const quebra = quebrarFaltaPura(faltaTotal, vendasSemFicha, cmv.pct);
  const fila = filaDeFichasPura(vendasSemFicha);

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">Estoque</p>
        <h1>Conferência da contagem</h1>
      </div>

      <div className="card btn-row" style={{ alignItems: "center" }}>
        <span className="eyebrow" style={{ margin: 0 }}>Vista</span>
        <Link href={q({ vista: "semana" })} className={`btn small${vista === "semana" ? " primary" : ""}`}>
          Última contagem
        </Link>
        <Link href={q({ vista: "mes" })} className={`btn small${vista === "mes" ? " primary" : ""}`}>
          Mês inteiro, semana a semana
        </Link>
        <span style={{ flex: 1 }} />
        <span className="hint">
          {mes ? mes.rotulo : "escolha o mês no menu"} · {semanas.length} semanas
        </span>
      </div>

      {/* O AVISO DE QUEM NÃO CONTOU.
          Casa que não conta não aparece como falta: aparece como tela vazia, e
          silêncio parece boa notícia. A semana corrente fica de fora da
          cobrança — ela ainda está acontecendo. */}
      {semContagem.length > 0 && (
        <div className="aviso-diretriz extra">
          <strong>
            {semContagem.length === 1
              ? "Uma semana fechada sem contagem nenhuma"
              : `${semContagem.length} semanas fechadas sem contagem nenhuma`}
            :
          </strong>{" "}
          {semContagem.map((s) => rotuloDaSemana(s.semana)).join(", ")}. Sem contagem nas duas
          pontas não há o que conferir — a semana não aparece como "tudo certo", ela simplesmente
          não existe no relatório.
        </div>
      )}
      {!contouNestaSemana && (
        <div className="aviso-diretriz">
          A contagem da semana de {rotuloDaSemana(semanaCorrente)} ainda não foi lançada nesta casa.
        </div>
      )}

      <p className="hint">
        {vista === "mes" ? (
          <>
            Uma coluna por semana do mês, e em cada célula a diferença daquela semana: o que o
            sistema esperava encontrar (contagem anterior + compras − vendas pela ficha − perdas
            declaradas) contra o que foi contado.
          </>
        ) : (
          <>
            Para cada produto contado duas vezes: o que o sistema esperava encontrar (contagem
            anterior + compras − vendas pela ficha − perdas declaradas) contra o que foi contado. O
            período é o de cada produto, entre as duas últimas contagens dele.
          </>
        )}
      </p>


      {vista === "mes" ? (
        /* O MÊS INTEIRO, SEMANA A SEMANA.
           Uma falta isolada é porção generosa ou erro de contagem; a MESMA
           falta quatro semanas seguidas é outra coisa — e só aparece com as
           semanas lado a lado. A coluna "semanas com falta" é o resumo desse
           padrão, e dá para ordenar por ela. */
        linhasDoMes.length === 0 ? (
          <div className="empty">
            Nenhum produto com duas contagens dentro de {mes?.rotulo ?? "o mês escolhido"}. A
            conferência precisa de duas pontas: a primeira contagem é só o marco zero.
          </div>
        ) : (
          <>
            {/* QUANTIDADE NA FRENTE, VALOR EMBAIXO.
                Quem conta pensa em caixa, quilo e litro — foi isso que ele
                pegou na mão. O valor fica na segunda linha porque serve para
                outra coisa: priorizar. 1 kg de picanha e 1 kg de sal não
                disputam a mesma atenção, e só o dinheiro diz isso. */}
            <TabelaConferencia
              ordemInicial={semanas.length + 2}
              colunas={[
                { chave: "produto", rotulo: "Produto" },
                ...semanas.map((sem) => ({ chave: sem, rotulo: rotuloDaSemana(sem), num: true })),
                { chave: "comprado", rotulo: "Comprado no mês", num: true },
                { chave: "total", rotulo: "Diferença do mês", num: true },
                { chave: "repete", rotulo: "Semanas com falta", num: true },
              ]}
              linhas={linhasDoMes.map((l) => {
                const p = nomePorProduto.get(l.produtoId);
                const un = p?.unidadeMedida ?? "";
                const preco = precoPorProduto.get(l.produtoId) ?? 0;
                return {
                  chave: l.produtoId,
                  celulas: [
                    {
                      valor: p?.nome ?? l.produtoId,
                      texto: p?.nome ?? l.produtoId,
                      nota: un,
                    },
                    ...l.celulas.map((c) =>
                      c === null
                        ? // VAZIO NÃO É ZERO: zero diria "conferido, nada
                          // faltou" sobre uma semana que ninguém conferiu.
                          { valor: 0, texto: "—", classe: "muted", titulo: "sem contagem nas duas pontas" }
                        : {
                            valor: c.diferenca,
                            texto: `${qtd(c.diferenca)} ${un}`,
                            classe: c.diferencaEmReais < 0 ? "bad" : undefined,
                            nota: c.comprado > 0 ? `compra ${qtd(c.comprado)}` : undefined,
                            titulo: `${data(c.de)} a ${data(c.ate)} · ${fmtCurrency(
                              c.diferencaEmReais
                            )} · contado ${qtd(c.saldoInicial)} → ${qtd(c.saldoContado)} · comprou ${qtd(
                              c.comprado
                            )} · ficha ${qtd(c.vendido)}`,
                          }
                    ),
                    {
                      valor: l.compradoNoMes,
                      texto: `${qtd(l.compradoNoMes)} ${un}`,
                      nota: fmtCurrency(l.compradoNoMes * preco),
                      titulo: "entradas de nota e recebimento nas semanas conferidas",
                    },
                    {
                      valor: l.totalQuantidade,
                      texto: `${qtd(l.totalQuantidade)} ${un}`,
                      classe: l.totalEmReais < 0 ? "bad" : undefined,
                      nota: fmtCurrency(l.totalEmReais),
                    },
                    {
                      valor: l.semanasComFalta,
                      texto: `${l.semanasComFalta} de ${l.semanasConferidas}`,
                      classe: l.semanasComFalta >= 3 ? "bad" : undefined,
                      titulo: "faltou em quantas das semanas conferidas",
                    },
                  ],
                };
              })}
            />
            <p className="hint" style={{ marginTop: 14 }}>
              Cada célula é a diferença daquela semana <strong>na unidade do produto</strong>, no
              período entre duas contagens dele; embaixo, o que entrou de compra naquela semana.{" "}
              <strong>Traço quer dizer que não houve contagem nas duas pontas</strong> — não que a
              semana fechou sem diferença. Passe o mouse na célula para ver o valor em reais e as
              quantidades do período.
            </p>
            <p className="hint">
              Nas duas últimas colunas de número, a linha de cima é quantidade e a de baixo é
              dinheiro. O valor sai do <strong>preço atual</strong> do insumo — é o mesmo critério
              do resto do app, e por isso ele muda quando o preço muda.
            </p>
            <p className="hint">
              A coluna <strong>semanas com falta</strong> é o que separa o acaso do padrão: faltar
              uma vez pode ser porção, balança ou contagem apressada; faltar toda semana é rotina, e
              rotina tem causa.
            </p>
          </>
        )
      ) : linhas.length === 0 ? (
        <div className="empty">
          Nenhum produto foi contado duas vezes ainda. A primeira contagem é o marco zero: ela
          sobrescreve o saldo e não tem com o que ser comparada. Esta tela começa a valer na
          segunda contagem.
        </div>
      ) : (
        <>
          <div className="cards">
            <div className="card">
              <p className="eyebrow">Falta</p>
              <p className="big bad">{fmtCurrency(totais.faltaEmReais)}</p>
              <p className="hint">
                Saiu mais do que a ficha e as perdas explicam. Só produto COM ficha entra aqui.
              </p>
            </div>
            <div className="card">
              <p className="eyebrow">Falta sem ficha</p>
              <p className="big">{fmtCurrency(totais.faltaSemFichaEmReais)}</p>
              <p className="hint">
                Produto que nenhuma receita menciona: a venda dele conta zero, então toda a saída
                aparece como falta. Isto mede ficha por escrever, não mercadoria sumida.
              </p>
            </div>
            <div className="card">
              <p className="eyebrow">Sobra</p>
              <p className="big">{fmtCurrency(totais.sobraEmReais)}</p>
              <p className="hint">Contado a mais do que a conta previa.</p>
            </div>
            <div className="card">
              <p className="eyebrow">Líquido</p>
              <p className="big">{fmtCurrency(totais.liquidoEmReais)}</p>
              <p className="hint">
                Olhe as duas colunas acima, não esta. Falta grande com sobra grande quase sempre é
                troca de produto na contagem, e o líquido esconde isso.
              </p>
            </div>
            <div className="card">
              <p className="eyebrow">Produtos conferidos</p>
              <p className="big">{totais.produtos}</p>
              <p className="hint">{totais.semFicha} ainda sem ficha técnica.</p>
            </div>
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <h2 style={{ fontSize: 15, marginBottom: 4 }}>De onde vem a falta</h2>
            {janelaDaCasa ? (
              <p className="hint" style={{ marginBottom: 14 }}>
                Janela da casa: {data(janelaDaCasa.de)} a {data(janelaDaCasa.ate)} — entram as semanas
                de venda que fecham dentro dela.{" "}
                {quebra.cmvUsadoPct == null ? (
                  <strong>
                    Sem CMV teórico no período, não dá para estimar: a falta inteira aparece como
                    perda. Cadastre ficha em pelo menos um prato vendido e este número passa a existir.
                  </strong>
                ) : (
                  <>
                    <strong>É estimativa</strong>, e a premissa é esta: o prato sem ficha consome na
                    mesma proporção dos que têm — {quebra.cmvUsadoPct.toFixed(1)}% do que fatura.
                    Não há no sistema nada que ligue um prato sem ficha a um insumo, então esta
                    quebra vale para o TOTAL e não para as linhas por produto lá embaixo.
                  </>
                )}
              </p>
            ) : (
              <p className="hint" style={{ marginBottom: 14 }}>
                Só com duas contagens dá para delimitar uma janela de venda.
              </p>
            )}
            <div className="cards">
              <div className="card">
                <p className="eyebrow">Consumo de pratos sem ficha</p>
                <p className="big">{fmtCurrency(quebra.pratosSemFichaEmReais)}</p>
                <p className="hint">
                  {fila.length} {fila.length === 1 ? "prato vendido" : "pratos vendidos"} sem ficha na
                  janela. Isto não é perda: é mercadoria que virou prato e o app não soube descontar.
                </p>
              </div>
              <div className="card">
                <p className="eyebrow">Eventos</p>
                <p className="big">{fmtCurrency(quebra.eventosEmReais)}</p>
                <p className="hint">
                  Pacote fechado, que o PDV não detalha prato a prato. Nunca vai ter ficha, por
                  construção — separado para não entupir a fila abaixo com tarefa que não existe.
                </p>
              </div>
              <div className="card">
                <p className="eyebrow">Perda</p>
                <p className="big bad">{fmtCurrency(quebra.perdaEmReais)}</p>
                <p className="hint">
                  O que sobra depois das duas: quebra, erro de contagem, ficha com rendimento errado
                  ou mercadoria sumida. <strong>É este número que vale conversar.</strong>
                </p>
              </div>
            </div>
            {quebra.cortadaNoTeto && (
              <p className="sub-explica" style={{ marginTop: 12 }}>
                <strong>A estimativa passou da falta e foi cortada nela</strong>, por isso a perda
                ficou zerada. Quer dizer que a premissa não está valendo nesta janela: ou a venda sem
                ficha pega um período maior que o da contagem, ou esses pratos consomem bem menos que
                a média das fichas existentes.
              </p>
            )}
          </div>

          {fila.length > 0 && (
            <div className="card">
              <h2 style={{ fontSize: 15, marginBottom: 4 }}>Fichas a escrever, por ordem de tamanho</h2>
              <p className="hint" style={{ marginBottom: 14 }}>
                Ordenado por faturamento, não por quantidade: a pergunta é qual ficha compra mais
                exatidão por hora de trabalho. Evento fica de fora — não há ficha a escrever nele.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Prato</th>
                    <th>Categoria</th>
                    <th className="num">Vendidos</th>
                    <th className="num">Faturou</th>
                    <th className="num">Consumo estimado</th>
                  </tr>
                </thead>
                <tbody>
                  {fila.map((v) => (
                    <tr key={v.itemVendaId}>
                      <td>{v.nome}</td>
                      <td className="cat">{v.categoria ?? "—"}</td>
                      <td className="num">{qtd(v.quantidadeVendida)}</td>
                      <td className="num">{fmtCurrency(v.faturamento)}</td>
                      <td className="num">
                        {quebra.cmvUsadoPct == null
                          ? "—"
                          : fmtCurrency((v.faturamento * quebra.cmvUsadoPct) / 100)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* A TABELA ORDENÁVEL — clique no cabeçalho. Abre em "Em R$",
              crescente, que põe a maior falta no topo: é a pergunta da segunda
              de manhã. As outras colunas respondem as perguntas seguintes sem
              ninguém precisar exportar para planilha. */}
          <TabelaConferencia
            ordemInicial={8}
            colunas={[
              { chave: "produto", rotulo: "Produto" },
              { chave: "antes", rotulo: "Contado antes", num: true },
              { chave: "comprado", rotulo: "Comprado", num: true },
              { chave: "vendido", rotulo: "Vendido (ficha)", num: true },
              { chave: "perda", rotulo: "Perda", num: true },
              { chave: "esperado", rotulo: "Esperado", num: true },
              { chave: "contado", rotulo: "Contado", num: true },
              { chave: "diferenca", rotulo: "Diferença", num: true },
              { chave: "reais", rotulo: "Em R$", num: true },
            ]}
            linhas={linhas.map((l) => {
              const p = nomePorProduto.get(l.produtoId);
              const j = janela.get(l.produtoId)!;
              return {
                chave: l.produtoId,
                celulas: [
                  {
                    valor: p?.nome ?? l.produtoId,
                    texto: p?.nome ?? l.produtoId,
                    tag: l.alerta === "SEM_FICHA" ? "sem ficha" : undefined,
                  },
                  // A DATA VEM JUNTO DO NÚMERO: "contado antes: 12" não diz
                  // nada sozinho — 12 de quando? Dois produtos da mesma tela
                  // podem ter sido contados em semanas diferentes.
                  { valor: l.saldoInicial, texto: qtd(l.saldoInicial), nota: data(j.de) },
                  { valor: l.comprado, texto: qtd(l.comprado) },
                  { valor: l.vendido, texto: qtd(l.vendido) },
                  { valor: l.perdaDeclarada, texto: qtd(l.perdaDeclarada) },
                  { valor: l.esperado, texto: qtd(l.esperado) },
                  { valor: l.saldoContado, texto: qtd(l.saldoContado), nota: data(j.ate) },
                  { valor: l.diferenca, texto: `${qtd(l.diferenca)} ${p?.unidadeMedida ?? ""}` },
                  {
                    valor: l.diferencaEmReais,
                    texto: fmtCurrency(l.diferencaEmReais),
                    classe: l.diferencaEmReais < 0 ? "bad" : undefined,
                  },
                ],
              };
            })}
          />

          <p className="hint" style={{ marginTop: 14 }}>
            <strong>Produto marcado &ldquo;sem ficha&rdquo;</strong> não tem receita que o mencione,
            então a coluna de venda fica zerada e toda a saída dele aparece como falta. Não é sumiço
            — é ficha que ainda não foi escrita. A fila está no Painel, em ordem de quanto cada item
            vendeu.
          </p>
          <p className="hint">
            O relatório diz <strong>onde</strong> olhar, não a causa. Falta de picanha pode ser
            porção generosa, ficha errada, contagem na unidade trocada ou furto — e nenhum número
            desta tela distingue os quatro.
          </p>
        </>
      )}
    </div>
  );
}
