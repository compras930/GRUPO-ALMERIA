import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { carregarContexto } from "@/lib/selecao-db";
import { idDaUnidadeFisica, casasDaUnidadeFisica } from "@/lib/unidade-fisica";
import { faturamentoDaLinhaPura } from "@/lib/faturamento";
import { sugerirFichasPuras } from "@/lib/vinculo-ficha";
import VincularFichaForm, {
  type ItemNaTela,
  type FichaNaLista,
} from "@/components/VincularFichaForm";

/**
 * VÍNCULO FICHA ↔ ITEM DO CARDÁPIO.
 *
 * POR QUE ESTA TELA EXISTE. As fichas do Beira Lago estão todas no app, com
 * ingrediente e rendimento — e mesmo assim não produzem número nenhum. A venda
 * só baixa estoque através da ficha DO ITEM VENDIDO, e o item só sabe qual é a
 * sua ficha se alguém disser. É o último elo entre a planilha do chef e o CMV
 * teórico.
 *
 * Enquanto não se diz, acontece com o prato o que já acontecia com a água: a
 * conferência mostra "vendido 0", a saída inteira aparece como falta, e não há
 * com o que comparar o CMV real.
 */
export default async function VincularFichaPage({
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
        Escolha uma casa no menu — cardápio e ficha são de uma cozinha, e o mesmo nome pode ser
        outro prato na casa do lado.
      </div>
    );
  }
  const casa = ctx.casas.find((c) => c.id === casaId);
  const despensaId = await idDaUnidadeFisica(casaId);
  const casasDaCozinha = await casasDaUnidadeFisica(despensaId);

  const [itens, fichas, vendas] = await Promise.all([
    prisma.itemVenda.findMany({
      where: { unidadeId: { in: casasDaCozinha }, ativo: true },
      select: {
        id: true,
        nome: true,
        tipo: true,
        categoria: true,
        receitaId: true,
        receita: {
          select: { nome: true, _count: { select: { ingredientes: true } } },
        },
      },
    }),
    // Só fichas desta cozinha: receita segue a despensa. Ficha vazia fica de
    // fora — ligar a ela trocaria "sem ficha" por "ficha que não baixa nada",
    // que é pior, porque parece resolvido.
    prisma.receita.findMany({
      where: { unidadeId: { in: casasDaCozinha }, ingredientes: { some: {} } },
      select: {
        id: true,
        nome: true,
        rendimentoQtd: true,
        _count: { select: { ingredientes: true } },
      },
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

  // Quanto cada prato vendeu — é o que ordena a fila. Cada vínculo compra
  // exatidão, e o prato que faturou mais compra mais.
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
  const sugestoes = sugerirFichasPuras(
    semFicha.map((i) => ({ id: i.id, nome: i.nome })),
    fichas.map((f) => ({ id: f.id, nome: f.nome }))
  );
  const sugestaoPorItem = new Map(sugestoes.map((s) => [s.alvoId, s]));

  // Os já vinculados ficam na lista: é assim que alguém confere o que ligou
  // semana passada, e desfaz o que ligou errado.
  const naTela: ItemNaTela[] = itens
    .map((i) => {
      const s = sugestaoPorItem.get(i.id);
      const v = vendidoPorItem.get(i.id);
      return {
        itemVendaId: i.id,
        nome: i.nome,
        tipo: i.tipo,
        categoria: i.categoria,
        faturamento: v?.faturamento ?? 0,
        quantidadeVendida: v?.quantidade ?? 0,
        fichaVinculada: i.receita?.nome ?? null,
        sugestaoReceitaId: s?.candidatoId ?? null,
        confianca: s?.confianca ?? "NENHUMA",
        motivo: s?.motivo ?? "",
      };
    })
    .sort((a, b) => b.faturamento - a.faturamento);

  const naLista: FichaNaLista[] = fichas.map((f) => ({
    receitaId: f.id,
    nome: f.nome,
    ingredientes: f._count.ingredientes,
    temRendimento: f.rendimentoQtd != null,
  }));

  const pendentes = naTela.filter((i) => !i.fichaVinculada);
  const faturamentoPendente = pendentes.reduce((s, i) => s + i.faturamento, 0);
  const semRendimento = naLista.filter((f) => !f.temRendimento).length;

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">
          <Link href="/cmv">← Fichas técnicas</Link>
        </p>
        <h1>Ligar prato à ficha</h1>
        <p className="sub-explica">
          {casa?.nome}. A venda só baixa estoque pela ficha <strong>do item vendido</strong> — e o
          item só sabe qual é a sua ficha se alguém disser. Enquanto não disser, o prato aparece
          com <strong>vendido 0</strong> na conferência, a saída dele vira falta, e não existe CMV
          teórico para comparar com o real.
        </p>
      </div>

      <div className="cards">
        <div className="card">
          <p className="eyebrow">Sem ficha</p>
          <p className={`big${pendentes.length > 0 ? " bad" : ""}`}>{pendentes.length}</p>
          <p className="hint">pratos do cardápio que não baixam estoque nenhum</p>
        </div>
        <div className="card">
          <p className="eyebrow">Faturamento sem baixa</p>
          <p className="big">
            {faturamentoPendente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
          <p className="hint">o quanto desta venda some da conta de estoque</p>
        </div>
        <div className="card">
          <p className="eyebrow">Fichas disponíveis</p>
          <p className="big">{naLista.length}</p>
          <p className="hint">
            {semRendimento > 0
              ? `${semRendimento} sem rendimento — essas não podem ser ligadas`
              : "todas com rendimento e ingrediente"}
          </p>
        </div>
      </div>

      {naTela.length === 0 ? (
        <div className="empty">
          Nenhum item de cardápio nesta casa. Se você esperava ver os pratos aqui, confira se a
          venda já foi carregada — o item de cardápio nasce da carga.
        </div>
      ) : (
        <>
          <VincularFichaForm itens={naTela} fichas={naLista} />
          <p className="sub-explica" style={{ marginTop: 16 }}>
            <strong>O vínculo vale da próxima carga em diante.</strong> As semanas já carregadas
            continuam sem a baixa, porque ela é feita no momento em que a venda entra. Para
            recalcular uma semana que já entrou, reenvie-a com <code>substituir</code> — a carga
            apaga a anterior, devolve o estoque que baixou e grava de novo, agora com os vínculos
            valendo.
          </p>
          <p className="hint">
            Ficha <strong>sem rendimento</strong> não entra: sem ele o app soma o custo dos
            ingredientes e não tem por quanto dividir, e o custo por porção sairia errado. Ligar
            assim trocaria &ldquo;sem ficha&rdquo; por &ldquo;ficha que mente&rdquo;, que é pior,
            porque parece resolvido.
          </p>
        </>
      )}
    </div>
  );
}
