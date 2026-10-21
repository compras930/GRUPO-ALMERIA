import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { unidadesComEstoqueProprio, idDaUnidadeFisica } from "@/lib/unidade-fisica";
import { requireAdmin } from "@/lib/session";
import { TIPOS_DE_ENTRADA } from "@/lib/consumo";
import { TIPO_PERDA } from "@/lib/constants";
import { conciliarPuro, totalizarPuro, type ParcelasProduto } from "@/lib/conciliacao";
import { fmtCurrency } from "@/lib/format";

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
const qtd = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

export default async function ConciliacaoPage({
  searchParams,
}: {
  searchParams: { unidadeId?: string };
}) {
  await requireAdmin();
  const unidades = await unidadesComEstoqueProprio();
  const escolhida = searchParams.unidadeId || unidades[0]?.id;
  const unidadeId = escolhida ? await idDaUnidadeFisica(escolhida) : null;
  if (!unidadeId) return <div className="empty">Nenhuma unidade com estoque próprio.</div>;

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

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">Estoque</p>
        <h1>Conferência da contagem</h1>
      </div>

      <p className="hint">
        Para cada produto contado duas vezes: o que o sistema esperava encontrar
        (contagem anterior + compras − vendas pela ficha − perdas declaradas) contra o que foi
        contado. O período é o de cada produto, entre as duas últimas contagens dele.
      </p>

      {unidades.length > 1 && (
        <div className="btn-row" style={{ marginBottom: 14 }}>
          {unidades.map((u) => (
            <Link
              key={u.id}
              href={`/estoque/conciliacao?unidadeId=${u.id}`}
              className={`btn small${u.id === escolhida ? " primary" : ""}`}
            >
              {u.nome}
            </Link>
          ))}
        </div>
      )}

      {linhas.length === 0 ? (
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

          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Período</th>
                <th className="num">Contado antes</th>
                <th className="num">Comprado</th>
                <th className="num">Vendido (ficha)</th>
                <th className="num">Perda</th>
                <th className="num">Esperado</th>
                <th className="num">Contado</th>
                <th className="num">Diferença</th>
                <th className="num">Em R$</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const p = nomePorProduto.get(l.produtoId);
                const j = janela.get(l.produtoId)!;
                return (
                  <tr key={l.produtoId}>
                    <td>
                      {p?.nome ?? l.produtoId}
                      {l.alerta === "SEM_FICHA" && <span className="tag"> sem ficha</span>}
                    </td>
                    <td className="cat">
                      {data(j.de)} a {data(j.ate)}
                    </td>
                    <td className="num">{qtd(l.saldoInicial)}</td>
                    <td className="num">{qtd(l.comprado)}</td>
                    <td className="num">{qtd(l.vendido)}</td>
                    <td className="num">{qtd(l.perdaDeclarada)}</td>
                    <td className="num">{qtd(l.esperado)}</td>
                    <td className="num">{qtd(l.saldoContado)}</td>
                    <td className="num">
                      {qtd(l.diferenca)} {p?.unidadeMedida}
                    </td>
                    <td className={`num${l.diferencaEmReais < 0 ? " bad" : ""}`}>
                      {fmtCurrency(l.diferencaEmReais)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

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
