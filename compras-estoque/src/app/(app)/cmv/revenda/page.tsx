import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { carregarContexto } from "@/lib/selecao-db";
import { idDaUnidadeFisica, casasDaUnidadeFisica } from "@/lib/unidade-fisica";
import { faturamentoDaLinhaPura } from "@/lib/faturamento";
import { sugerirVinculosPuros } from "@/lib/revenda-direta";
import RevendaDiretaForm, { type ItemNaTela } from "@/components/RevendaDiretaForm";

/**
 * REVENDA DIRETA — o item que se vende exatamente como se compra.
 *
 * POR QUE ESTA TELA EXISTE. A venda só baixa estoque pela ficha técnica. Para
 * um prato isso é correto: sem ficha, ninguém sabe quanto de cada insumo ele
 * leva. Para água, cerveja, refrigerante e vinho, não falta informação
 * nenhuma — falta dizer que o item do cardápio e o produto da despensa são a
 * mesma coisa.
 *
 * Enquanto não se diz, a conferência mostra "vendido 0" para a água mais
 * vendida da casa, e a saída inteira dela aparece como FALTA. O relatório
 * acusa sumiço onde houve venda, e quem lê perde a confiança no relatório
 * inteiro — que é o pior resultado possível desta ferramenta.
 */
export default async function RevendaPage({
  searchParams,
}: {
  searchParams: { unidadeId?: string };
}) {
  await requireAdmin();
  const ctx = await carregarContexto({ papel: "ADMIN", unidadeId: null }, searchParams);
  const casaId = ctx.casaId;
  if (!casaId) {
    return (
      <div className="empty">
        Escolha uma casa no menu — cardápio é de uma casa, e o mesmo nome pode ser outra coisa na
        casa do lado.
      </div>
    );
  }
  const casa = ctx.casas.find((c) => c.id === casaId);
  const despensaId = await idDaUnidadeFisica(casaId);
  const casasDaCozinha = await casasDaUnidadeFisica(despensaId);

  const [itens, produtos, vendas] = await Promise.all([
    prisma.itemVenda.findMany({
      where: { unidadeId: { in: casasDaCozinha }, ativo: true },
      select: {
        id: true,
        nome: true,
        tipo: true,
        categoria: true,
        precoVenda: true,
        receitaId: true,
        receita: { select: { ingredientes: { select: { produto: { select: { nome: true } } } } } },
      },
    }),
    // Só o que tem estoque próprio nesta despensa pode ser baixado por venda.
    prisma.produto.findMany({
      where: { ativo: true },
      select: { id: true, nome: true, unidadeMedida: true },
      orderBy: { nome: "asc" },
    }),
    prisma.itemVendaSemanal.findMany({
      where: { vendaSemanal: { unidadeId: { in: casasDaCozinha } } },
      select: {
        quantidadeVendida: true,
        valorVendido: true,
        itemVenda: { select: { id: true, precoVenda: true } },
      },
    }),
  ]);

  // Quanto cada item vendeu — é o que ordena a fila: cada vínculo compra
  // exatidão, e a água mais vendida compra muito mais que o licor raro.
  const vendidoPorItem = new Map<string, { quantidade: number; faturamento: number }>();
  for (const v of vendas) {
    if (!v.itemVenda) continue;
    const atual = vendidoPorItem.get(v.itemVenda.id) ?? { quantidade: 0, faturamento: 0 };
    atual.quantidade += v.quantidadeVendida;
    atual.faturamento += faturamentoDaLinhaPura({
      quantidadeVendida: v.quantidadeVendida,
      valorVendido: v.valorVendido,
      precoVenda: v.itemVenda.precoVenda,
    });
    vendidoPorItem.set(v.itemVenda.id, atual);
  }

  const semFicha = itens.filter((i) => !i.receitaId);
  const sugestoes = sugerirVinculosPuros(
    semFicha.map((i) => ({
      itemVendaId: i.id,
      nome: i.nome,
      tipo: i.tipo,
      faturamento: vendidoPorItem.get(i.id)?.faturamento ?? 0,
    })),
    produtos.map((p) => ({ produtoId: p.id, nome: p.nome, unidadeMedida: p.unidadeMedida }))
  );
  const sugestaoPorItem = new Map(sugestoes.map((s) => [s.itemVendaId, s]));

  // Os já vinculados por esta tela ficam na lista: é como alguém confere o que
  // ligou semana passada, e desfaz o que ligou errado.
  const naTela: ItemNaTela[] = itens
    .map((i) => {
      const s = sugestaoPorItem.get(i.id);
      const umIngrediente = i.receita?.ingredientes.length === 1;
      const v = vendidoPorItem.get(i.id);
      return {
        itemVendaId: i.id,
        nome: i.nome,
        tipo: i.tipo,
        categoria: i.categoria,
        faturamento: v?.faturamento ?? 0,
        quantidadeVendida: v?.quantidade ?? 0,
        produtoVinculado: umIngrediente
          ? i.receita!.ingredientes[0].produto?.nome ?? "(produto apagado)"
          : null,
        sugestaoProdutoId: s?.produtoId ?? null,
        confianca: s?.confianca ?? "NENHUMA",
        motivo: s?.motivo ?? "",
        temFicha: Boolean(i.receitaId),
      };
    })
    // Ficha de verdade (mais de um ingrediente) não é assunto desta tela.
    .filter((i) => !i.temFicha || i.produtoVinculado)
    .sort((a, b) => b.faturamento - a.faturamento);

  const pendentes = naTela.filter((i) => !i.produtoVinculado);
  const faturamentoPendente = pendentes.reduce((s, i) => s + i.faturamento, 0);

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">
          <Link href="/cmv">← Fichas técnicas</Link>
        </p>
        <h1>Revenda direta</h1>
        <p className="sub-explica">
          {casa?.nome}. Item que se vende <strong>exatamente como se compra</strong> — água,
          cerveja, refrigerante, vinho. Enquanto ele não estiver ligado ao produto da despensa, a
          venda dele não baixa estoque: a conferência mostra <strong>vendido 0</strong> e a saída
          inteira aparece como falta, acusando sumiço onde houve venda.
        </p>
      </div>

      <div className="cards">
        <div className="card">
          <p className="eyebrow">Sem vínculo</p>
          <p className={`big${pendentes.length > 0 ? " bad" : ""}`}>{pendentes.length}</p>
          <p className="hint">itens de cardápio que não baixam estoque nenhum</p>
        </div>
        <div className="card">
          <p className="eyebrow">Faturamento sem baixa</p>
          <p className="big">
            {faturamentoPendente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
          <p className="hint">o quanto desta venda some da conta de estoque</p>
        </div>
        <div className="card">
          <p className="eyebrow">Já vinculados</p>
          <p className="big">{naTela.length - pendentes.length}</p>
          <p className="hint">continuam na lista para conferir e desfazer</p>
        </div>
      </div>

      {naTela.length === 0 ? (
        <div className="empty">
          Nenhum item de cardápio sem ficha nesta casa. Se você esperava ver a água aqui, confira se
          a venda já foi carregada — o item de cardápio nasce da carga.
        </div>
      ) : (
        <>
          <RevendaDiretaForm
            itens={naTela}
            produtos={produtos.map((p) => ({ produtoId: p.id, nome: p.nome, unidadeMedida: p.unidadeMedida }))}
          />
          <p className="sub-explica" style={{ marginTop: 16 }}>
            <strong>O vínculo vale da próxima carga em diante.</strong> As semanas já carregadas
            continuam sem a baixa, porque ela é feita no momento em que a venda entra. Para
            recalcular uma semana que já entrou, reenvie-a com <code>substituir</code> — a carga
            apaga a anterior, devolve o estoque que ela baixou e grava de novo, agora com os
            vínculos valendo.
          </p>
          <p className="hint">
            <strong>Por unidade</strong> é quanto do produto sai a cada unidade vendida. Um para um
            na maioria: vende-se a garrafa que se comprou. Mas a casa que compra fardo e vende lata,
            ou compra 700 ml e vende dose de 50, diz isso aqui — e aí 1 venda baixa 0,05 do produto.
          </p>
        </>
      )}
    </div>
  );
}
