import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { fmtCurrency } from "@/lib/format";
import { TIPO_ITEM_VENDA_LABEL, type TipoItemVenda } from "@/lib/constants";
import {
  carregarIndiceReceitas,
  carregarPrecoAtualPorProduto,
  custoDaLinhaPura,
  explodirReceitaPura,
  CicloReceitaError,
} from "@/lib/receita";
import BotaoImprimir from "@/components/BotaoImprimir";

/**
 * Ficha técnica para imprimir ou salvar em PDF.
 *
 * Mesma razão de existir da folha de contagem: quem usa a ficha está na
 * bancada, com as mãos sujas, não com o app aberto. E ela circula — vai pro
 * grupo do WhatsApp da cozinha, pro caderno do sous-chef, pra parede.
 *
 * O QUE ELA MOSTRA QUE A TELA NÃO MOSTRA: o custo LINHA A LINHA. "R$ 38,40 de
 * custo" não diz se o problema é o camarão ou o açafrão; a coluna por linha
 * diz, e é a partir dela que se decide o que trocar. Ver custoDaLinhaPura.
 *
 * O custo é o de HOJE, recalculado na hora da impressão a partir do preço
 * atual dos insumos — nunca um número guardado. Por isso a folha carimba a
 * data: uma ficha impressa mês passado tem o CMV do mês passado, e quem
 * estiver segurando o papel precisa saber disso.
 */
function fmtPct(v: number | null) {
  if (v === null) return "—";
  return (v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}

const fmtQtd = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 3 });

export default async function ImprimirFichaPage({ params }: { params: { itemVendaId: string } }) {
  await requireAdmin();

  const item = await prisma.itemVenda.findUnique({
    where: { id: params.itemVendaId },
    include: {
      unidade: { select: { nome: true, metaCmvPratos: true, metaCmvBebidas: true, metaCmvVinhos: true } },
      receita: { include: { ingredientes: { include: { produto: true, subReceita: true } } } },
    },
  });
  if (!item) notFound();

  const voltar = `/cmv/${item.id}`;

  if (!item.receita) {
    return (
      <div className="empty">
        <p>
          <strong>{item.nome}</strong> ainda não tem ficha técnica — não há o que imprimir.
        </p>
        <p style={{ marginTop: 12 }}>
          <Link href={voltar} className="btn small">
            Montar a ficha
          </Link>
        </p>
      </div>
    );
  }

  const [indice, precos] = await Promise.all([
    carregarIndiceReceitas(item.unidadeId),
    carregarPrecoAtualPorProduto(item.unidadeId),
  ]);

  // Uma linha da ficha, com o custo do jeito que ela está escrita. Ciclo numa
  // sub-receita derruba o custo daquela linha, não a folha inteira: a ficha
  // impressa continua servindo de lista de ingredientes enquanto alguém
  // conserta o ciclo.
  let temCiclo = false;
  const linhas = item.receita.ingredientes.map((ing) => {
    let custo: number | null = null;
    try {
      custo = custoDaLinhaPura(ing, indice, precos);
    } catch (e) {
      if (e instanceof CicloReceitaError) temCiclo = true;
      else throw e;
    }
    const ehSubReceita = !ing.produtoId;
    return {
      id: ing.id,
      nome: ing.produto?.nome ?? ing.subReceita?.nome ?? "(ingrediente removido)",
      ehSubReceita,
      quantidade: ing.quantidade,
      unidadeMedida: ing.unidadeMedida,
      custo,
      // Insumo com preço zero é o erro mais fácil de não ver numa ficha: o
      // total simplesmente sai menor e ninguém estranha.
      semPreco: !ehSubReceita && !!ing.produtoId && !precos.get(ing.produtoId),
    };
  });

  const custoLote = linhas.reduce((s, l) => s + (l.custo ?? 0), 0);
  const rendimento = item.receita.rendimentoQtd && item.receita.rendimentoQtd > 0 ? item.receita.rendimentoQtd : null;
  const custoPorcao = temCiclo ? null : rendimento ? custoLote / rendimento : custoLote;
  const cmv = custoPorcao !== null && item.precoVenda ? custoPorcao / item.precoVenda : null;

  const meta =
    item.tipo === "PRATO"
      ? item.unidade.metaCmvPratos
      : item.tipo === "BEBIDA"
        ? item.unidade.metaCmvBebidas
        : item.unidade.metaCmvVinhos;

  // Confere que a soma das linhas fecha com a explosão inteira. Se um dia
  // divergir, a folha avisa em vez de imprimir dois números que se contradizem.
  let custoConferido: number | null = null;
  if (!temCiclo) {
    try {
      let total = 0;
      for (const [produtoId, qtd] of explodirReceitaPura(item.receita.id, rendimento ?? 1, indice)) {
        total += qtd * (precos.get(produtoId) ?? 0);
      }
      custoConferido = total;
    } catch {
      custoConferido = null;
    }
  }
  const divergente = custoConferido !== null && Math.abs(custoConferido - custoLote) > 0.005;

  const hoje = new Date().toLocaleDateString("pt-BR");
  const semPreco = linhas.filter((l) => l.semPreco);

  return (
    <div className="folha">
      <div className="folha-cabecalho">
        <div>
          <h1 style={{ margin: 0, fontSize: 20 }}>{item.nome}</h1>
          <p style={{ margin: "3px 0 0", fontSize: 13 }}>
            Ficha técnica · {item.unidade.nome} · {TIPO_ITEM_VENDA_LABEL[item.tipo as TipoItemVenda]}
            {item.categoria ? ` · ${item.categoria}` : ""}
            {item.codigoPdv ? ` · PDV ${item.codigoPdv}` : ""}
          </p>
        </div>
        <div style={{ fontSize: 13, textAlign: "right", whiteSpace: "nowrap" }}>
          <div>Emitida em {hoje}</div>
          <div style={{ marginTop: 6 }}>
            {rendimento ? `Rende ${fmtQtd(rendimento)} ${item.receita.rendimentoUnidade ?? ""}`.trim() : "1 porção"}
          </div>
        </div>
      </div>

      <div className="ficha-resumo">
        <div>
          <p className="lbl">Custo por porção</p>
          <strong>{custoPorcao === null ? "—" : fmtCurrency(custoPorcao)}</strong>
        </div>
        <div>
          <p className="lbl">Preço de venda</p>
          <strong>{fmtCurrency(item.precoVenda)}</strong>
        </div>
        <div>
          <p className="lbl">CMV</p>
          <strong>{fmtPct(cmv)}</strong>
        </div>
        <div>
          <p className="lbl">Meta da casa</p>
          <strong>{fmtPct(meta)}</strong>
        </div>
      </div>

      <table className="folha-tabela">
        <thead>
          <tr>
            <th style={{ width: 28 }}>#</th>
            <th>ingrediente</th>
            <th style={{ width: 90 }} className="num">
              qtd
            </th>
            <th style={{ width: 46 }}>un</th>
            <th style={{ width: 110 }} className="num">
              custo
            </th>
            <th style={{ width: 66 }} className="num">
              % custo
            </th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, n) => (
            <tr key={l.id}>
              <td>{n + 1}</td>
              <td>
                {l.nome}
                {l.ehSubReceita && <span className="ficha-marca">sub-receita</span>}
                {l.semPreco && <span className="ficha-marca alerta">sem preço</span>}
              </td>
              <td className="num">{fmtQtd(l.quantidade)}</td>
              <td>{l.unidadeMedida}</td>
              <td className="num">{l.custo === null ? "—" : fmtCurrency(l.custo)}</td>
              <td className="num">
                {l.custo === null || custoLote <= 0 ? "—" : fmtPct(l.custo / custoLote)}
              </td>
            </tr>
          ))}
          <tr className="ficha-total">
            <td></td>
            <td>{rendimento ? `Total do lote (${fmtQtd(rendimento)} ${item.receita.rendimentoUnidade ?? ""})`.trim() : "Total"}</td>
            <td></td>
            <td></td>
            <td className="num">{fmtCurrency(custoLote)}</td>
            <td className="num">100,0%</td>
          </tr>
        </tbody>
      </table>

      {item.receita.modoPreparo && (
        <div className="ficha-preparo">
          <h2>Modo de preparo</h2>
          <p>{item.receita.modoPreparo}</p>
        </div>
      )}

      <div className="folha-rodape">
        {temCiclo && (
          <p>
            <strong>Atenção:</strong> uma sub-receita desta ficha aponta de volta para si mesma. O custo
            não pode ser calculado até isso ser corrigido — a lista de ingredientes abaixo continua
            valendo.
          </p>
        )}
        {divergente && (
          <p>
            <strong>Atenção:</strong> a soma das linhas ({fmtCurrency(custoLote)}) não fecha com o custo
            explodido ({fmtCurrency(custoConferido!)}). Não use esta folha para decidir preço até
            alguém olhar.
          </p>
        )}
        {semPreco.length > 0 && (
          <p>
            <strong>{semPreco.length}</strong>{" "}
            {semPreco.length === 1 ? "ingrediente está" : "ingredientes estão"} sem preço de compra e{" "}
            {semPreco.length === 1 ? "entrou" : "entraram"} como zero: {semPreco.map((l) => l.nome).join(", ")}.
            O custo acima está MENOR que o real.
          </p>
        )}
        <p>
          O custo é o do preço de compra de <strong>{hoje}</strong>, recalculado na hora da impressão —
          não é um número guardado. Uma folha impressa semana que vem terá outro número se o insumo
          mudar de preço.
        </p>
      </div>

      <div className="folha-acoes">
        <BotaoImprimir />
        <Link href={voltar} className="btn small">
          Voltar à ficha
        </Link>
      </div>
    </div>
  );
}
