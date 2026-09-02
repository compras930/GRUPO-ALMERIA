// Lógica da automação 2 (lista de compras automática via n8n): recebe a
// venda da semana (nome do item + quantidade vendida), explode a receita
// de cada item vendido pra somar quanto de cada insumo foi consumido,
// registra o consumo no estoque (mesmo padrão ledger+cache de
// src/actions/recebimentos.ts) e gera um Pedido de Compra rascunho com
// quantidade e preço sugeridos.
import { prisma } from "@/lib/prisma";
import { normalizarNome, chaveComparacao } from "@/lib/nome-normalizado";
import { carregarIndiceReceitas, carregarPrecoAtualPorProduto, explodirReceitaPura } from "@/lib/receita";

export type ItemVendaSemanalInput = { nome: string; quantidadeVendida: number };

export type ResultadoVendaSemanal = {
  vendaSemanalId: string;
  pedidoCompraId: string | null;
  totalItensVendidos: number;
  naoReconhecidos: ItemVendaSemanalInput[];
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

  const periodoInicio = new Date(periodoInicioStr);
  const periodoFim = new Date(periodoFimStr);

  // Idempotência: reenvio acidental da mesma semana não pode consumir
  // estoque 2x nem duplicar pedido de compra.
  const jaExiste = await prisma.vendaSemanal.findFirst({
    where: { unidadeId: unidade.id, periodoInicio, periodoFim },
  });
  if (jaExiste) throw new VendaSemanalDuplicadaError(unidadeNome, periodoInicioStr, periodoFimStr);

  const itensVenda = await prisma.itemVenda.findMany({ where: { unidadeId: unidade.id } });
  const porNome = new Map<string, typeof itensVenda[number][]>();
  for (const iv of itensVenda) {
    const chave = chaveComparacao(iv.nome);
    const lista = porNome.get(chave) ?? [];
    lista.push(iv);
    porNome.set(chave, lista);
  }

  const [indice, precos, parametros] = await Promise.all([
    carregarIndiceReceitas(unidade.id),
    carregarPrecoAtualPorProduto(unidade.id),
    prisma.parametroEstoqueProduto.findMany({ where: { unidadeId: unidade.id } }),
  ]);
  const idealPorProduto = new Map(parametros.filter((p) => p.estoqueIdeal != null).map((p) => [p.produtoId, p.estoqueIdeal!]));

  const naoReconhecidos: ItemVendaSemanalInput[] = [];
  const consumoTotal = new Map<string, number>(); // produtoId -> quantidade consumida
  const linhasParaGravar: { itemVendaId: string | null; nomeBruto: string; quantidadeVendida: number }[] = [];

  for (const item of itens) {
    const candidatos = porNome.get(chaveComparacao(item.nome)) ?? [];
    if (candidatos.length !== 1) {
      // 0 = não encontrado; >1 = ambíguo (mesmo nome em tipo/categoria diferente) — os dois casos precisam de revisão humana
      naoReconhecidos.push(item);
      linhasParaGravar.push({ itemVendaId: null, nomeBruto: normalizarNome(item.nome), quantidadeVendida: item.quantidadeVendida });
      continue;
    }
    const itemVenda = candidatos[0];
    linhasParaGravar.push({ itemVendaId: itemVenda.id, nomeBruto: normalizarNome(item.nome), quantidadeVendida: item.quantidadeVendida });
    if (!itemVenda.receitaId) continue; // sem ficha técnica — não dá pra explodir consumo, mas a venda ainda fica registrada

    const insumos = explodirReceitaPura(itemVenda.receitaId, item.quantidadeVendida, indice);
    for (const [produtoId, qtd] of insumos) {
      consumoTotal.set(produtoId, (consumoTotal.get(produtoId) ?? 0) + qtd);
    }
  }

  const saldosAtuais = await prisma.estoqueSaldo.findMany({ where: { unidadeId: unidade.id } });
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
        where: { unidadeId_produtoId: { unidadeId: unidade.id, produtoId } },
        update: { quantidade: { decrement: quantidadeConsumida } },
        create: { unidadeId: unidade.id, produtoId, quantidade: -quantidadeConsumida },
      });
      await tx.movimentoEstoque.create({
        data: {
          unidadeId: unidade.id,
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
          unidadeId: unidade.id,
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
    naoReconhecidos,
    itensListaCompra,
  };
}
