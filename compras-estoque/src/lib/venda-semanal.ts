// Lógica da automação 2 (lista de compras automática via n8n): recebe a
// venda da semana (nome do item + quantidade vendida), explode a receita
// de cada item vendido pra somar quanto de cada insumo foi consumido,
// registra o consumo no estoque (mesmo padrão ledger+cache de
// src/actions/recebimentos.ts) e gera um Pedido de Compra rascunho com
// quantidade e preço sugeridos.
import { prisma } from "@/lib/prisma";
import { normalizarNome } from "@/lib/nome-normalizado";
import { carregarIndiceReceitas, carregarPrecoAtualPorProduto, explodirReceitaPura } from "@/lib/receita";
import { idDaUnidadeFisica } from "@/lib/unidade-fisica";
import { resolverItensVendaPura, EXPLICACAO_MOTIVO } from "@/lib/resolucao-item-venda";

export type ItemVendaSemanalInput = {
  nome: string;
  /** Código do produto no PDV, quando a origem manda. Casa por aqui de preferência. */
  codigo?: string | null;
  quantidadeVendida: number;
};

export type ResultadoVendaSemanal = {
  vendaSemanalId: string;
  pedidoCompraId: string | null;
  totalItensVendidos: number;
  casadosPorCodigo: number;
  casadosPorNome: number;
  naoReconhecidos: (ItemVendaSemanalInput & { motivo: string })[];
  /**
   * Itens que casaram por nome e trouxeram um código que o cadastro ainda não
   * tem. Não gravamos automaticamente — casamento por nome é palpite, e gravar
   * o código a partir dele congelaria o palpite como se fosse identidade.
   * Vem na resposta pra alguém confirmar (prisma/scripts/backfill-codigo-pdv.ts).
   */
  codigosASugerir: { itemVendaId: string; nome: string; codigo: string }[];
  itensListaCompra: { produto: string; unidadeMedida: string; quantidadeSugerida: number; precoUnitEsperado: number }[];
};

export class VendaSemanalDuplicadaError extends Error {
  constructor(unidadeNome: string, periodoInicio: string, periodoFim: string) {
    super(`Já existe uma venda semanal registrada para "${unidadeNome}" no período ${periodoInicio} a ${periodoFim}.`);
    this.name = "VendaSemanalDuplicadaError";
  }
}

export async function processarVendaSemanal(
  unidadeNome: string,
  periodoInicioStr: string,
  periodoFimStr: string,
  itens: ItemVendaSemanalInput[],
  importadoPorId: string
): Promise<ResultadoVendaSemanal> {
  const unidade = await prisma.unidade.findUnique({ where: { nome: unidadeNome } });
  if (!unidade) throw new Error(`Unidade "${unidadeNome}" não encontrada.`);

  // A venda é da CASA (é o caixa dela), mas o consumo de estoque e a compra
  // que ela gera são da DESPENSA — no caso de Matri, a do Noroeste.
  const unidadeFisicaId = await idDaUnidadeFisica(unidade.id);

  const periodoInicio = new Date(periodoInicioStr);
  const periodoFim = new Date(periodoFimStr);

  // Idempotência: reenvio acidental da mesma semana não pode consumir
  // estoque 2x nem duplicar pedido de compra.
  const jaExiste = await prisma.vendaSemanal.findFirst({
    where: { unidadeId: unidade.id, periodoInicio, periodoFim },
  });
  if (jaExiste) throw new VendaSemanalDuplicadaError(unidadeNome, periodoInicioStr, periodoFimStr);

  const itensVenda = await prisma.itemVenda.findMany({ where: { unidadeId: unidade.id } });
  const itemVendaPorId = new Map(itensVenda.map((iv) => [iv.id, iv]));

  const [indice, precos, parametros] = await Promise.all([
    carregarIndiceReceitas(unidade.id),
    carregarPrecoAtualPorProduto(unidade.id),
    prisma.parametroEstoqueProduto.findMany({ where: { unidadeId: unidadeFisicaId } }),
  ]);
  const idealPorProduto = new Map(parametros.filter((p) => p.estoqueIdeal != null).map((p) => [p.produtoId, p.estoqueIdeal!]));

  const naoReconhecidos: ResultadoVendaSemanal["naoReconhecidos"] = [];
  const codigosASugerir: ResultadoVendaSemanal["codigosASugerir"] = [];
  const consumoTotal = new Map<string, number>(); // produtoId -> quantidade consumida
  const linhasParaGravar: {
    itemVendaId: string | null;
    nomeBruto: string;
    codigoBruto: string | null;
    quantidadeVendida: number;
  }[] = [];
  let casadosPorCodigo = 0;
  let casadosPorNome = 0;

  // Casa por código quando a origem manda um, por nome quando não — toda a
  // decisão está em src/lib/resolucao-item-venda.ts, que é puro e testado.
  const resolucoes = resolverItensVendaPura(itens, itensVenda);

  for (const r of resolucoes) {
    const item = r.linha as ItemVendaSemanalInput;
    const codigoBruto = String(item.codigo ?? "").trim() || null;
    const nomeBruto = normalizarNome(item.nome);

    if (!r.itemVendaId) {
      // A linha fica gravada mesmo sem casar: é o registro de que aquela venda
      // existiu, e o que permite reconciliar depois sem pedir a planilha de novo.
      naoReconhecidos.push({ ...item, motivo: EXPLICACAO_MOTIVO[r.motivo!] });
      linhasParaGravar.push({ itemVendaId: null, nomeBruto, codigoBruto, quantidadeVendida: item.quantidadeVendida });
      continue;
    }

    if (r.via === "CODIGO") casadosPorCodigo++;
    else casadosPorNome++;
    if (r.codigoSugerido) {
      codigosASugerir.push({ itemVendaId: r.itemVendaId, nome: nomeBruto, codigo: r.codigoSugerido });
    }

    linhasParaGravar.push({ itemVendaId: r.itemVendaId, nomeBruto, codigoBruto, quantidadeVendida: item.quantidadeVendida });

    const itemVenda = itemVendaPorId.get(r.itemVendaId)!;
    if (!itemVenda.receitaId) continue; // sem ficha técnica — não dá pra explodir consumo, mas a venda ainda fica registrada

    const insumos = explodirReceitaPura(itemVenda.receitaId, item.quantidadeVendida, indice);
    for (const [produtoId, qtd] of insumos) {
      consumoTotal.set(produtoId, (consumoTotal.get(produtoId) ?? 0) + qtd);
    }
  }

  const saldosAtuais = await prisma.estoqueSaldo.findMany({ where: { unidadeId: unidadeFisicaId } });
  const saldoPorProduto = new Map(saldosAtuais.map((s) => [s.produtoId, s.quantidade]));

  const { vendaSemanalId, pedidoCompraId, itensListaCompra } = await prisma.$transaction(async (tx) => {
    const vendaSemanal = await tx.vendaSemanal.create({
      data: {
        unidadeId: unidade.id,
        periodoInicio,
        periodoFim,
        importadoPorId,
        itens: { create: linhasParaGravar },
      },
    });

    for (const [produtoId, quantidadeConsumida] of consumoTotal) {
      if (quantidadeConsumida <= 0) continue;
      await tx.estoqueSaldo.upsert({
        where: { unidadeId_produtoId: { unidadeId: unidadeFisicaId, produtoId } },
        update: { quantidade: { decrement: quantidadeConsumida } },
        create: { unidadeId: unidadeFisicaId, produtoId, quantidade: -quantidadeConsumida },
      });
      await tx.movimentoEstoque.create({
        data: {
          unidadeId: unidadeFisicaId,
          produtoId,
          tipo: "SAIDA_CONSUMO",
          quantidade: -quantidadeConsumida,
          referencia: vendaSemanal.id,
          observacao: `Consumo calculado da venda semanal de ${periodoInicioStr} a ${periodoFimStr}`,
        },
      });
    }

    // Lista de compras sugerida: repõe o consumido, ou (se houver estoqueIdeal
    // configurado) completa até o ideal a partir do saldo já descontado do consumo.
    const produtosConsumidos = await tx.produto.findMany({
      where: { id: { in: [...consumoTotal.keys()] } },
      select: { id: true, nome: true, unidadeMedida: true },
    });
    const itensListaCompra: ResultadoVendaSemanal["itensListaCompra"] = [];
    const itensPedido: { produtoId: string; quantidade: number; precoUnitEsperado: number }[] = [];

    for (const produto of produtosConsumidos) {
      const consumido = consumoTotal.get(produto.id) ?? 0;
      if (consumido <= 0) continue;
      const ideal = idealPorProduto.get(produto.id);
      const saldoAposConsumo = (saldoPorProduto.get(produto.id) ?? 0) - consumido;
      const quantidadeSugerida = ideal != null ? Math.max(0, ideal - saldoAposConsumo) : consumido;
      if (quantidadeSugerida <= 0) continue;
      const precoUnitEsperado = precos.get(produto.id) ?? 0;
      itensListaCompra.push({ produto: produto.nome, unidadeMedida: produto.unidadeMedida, quantidadeSugerida, precoUnitEsperado });
      itensPedido.push({ produtoId: produto.id, quantidade: quantidadeSugerida, precoUnitEsperado });
    }

    let pedidoCompraId: string | null = null;
    if (itensPedido.length > 0) {
      const ultimo = await tx.pedidoCompra.findFirst({ orderBy: { numero: "desc" } });
      const numero = (ultimo?.numero ?? 0) + 1;
      const pedido = await tx.pedidoCompra.create({
        data: {
          numero,
          unidadeId: unidadeFisicaId,
          fornecedorId: null,
          solicitanteId: importadoPorId,
          status: "RASCUNHO",
          observacao: `Gerado automaticamente a partir da venda semanal de ${periodoInicioStr} a ${periodoFimStr}.`,
          itens: { create: itensPedido },
        },
      });
      pedidoCompraId = pedido.id;
    }

    return { vendaSemanalId: vendaSemanal.id, pedidoCompraId, itensListaCompra };
  }, { timeout: 60_000 });

  return {
    vendaSemanalId,
    pedidoCompraId,
    totalItensVendidos: itens.length,
    casadosPorCodigo,
    casadosPorNome,
    naoReconhecidos,
    codigosASugerir,
    itensListaCompra,
  };
}
