// Faz as linhas de VENDA que não casaram entrarem, depois que o item de venda
// foi cadastrado.
//
// É o irmão de reprocessar-nao-reconhecidos.ts, do lado da venda, e existe
// pelo mesmo motivo — mas o mecanismo que prende a linha aqui é OUTRO, e vale
// dizer qual:
//
//   Na COMPRA, a linha é pulada pela `chave` antes de tentar casar o nome.
//   Na VENDA, não há chave por linha: a identidade é o PERÍODO inteiro, e
//   reenviar a mesma semana devolve 409. A linha fica gravada com
//   itemVendaId nulo e não há como mandar de novo.
//
// O efeito prático é igual: cadastrar o item depois não traz a venda de volta.
// Na primeira carga do Beira Lago foram 202 linhas de 231 presas assim.
//
// POR QUE NÃO "APAGAR A VENDA SEMANAL E REENVIAR". Porque a carga não só
// registra venda: ela também DÁ BAIXA de estoque (SAIDA_CONSUMO, explodindo a
// ficha de cada item casado) e cria um pedido de compra rascunho. Apagar só a
// VendaSemanal deixaria os movimentos de estoque de pé, e o reenvio baixaria
// tudo de novo — consumo em dobro, calado. Desfazer os movimentos à mão antes
// seria possível, e seria um procedimento com três passos que alguém um dia
// faria pela metade.
//
// POR QUE ISTO NÃO PODE BAIXAR ESTOQUE EM DOBRO. Só são tocadas linhas com
// `itemVendaId IS NULL`, e linha sem item NUNCA explodiu ficha — o `continue`
// em venda-semanal.ts acontece antes de qualquer soma em `consumoTotal`. Não é
// suposição sobre o passado: é o que o próprio dado afirma.
//
// O QUE ELE NÃO FAZ: criar pedido de compra. A carga original já criou um pra
// aquela semana; um segundo rascunho da mesma semana seria confusão, não
// informação. A sugestão de reposição vai na resposta, e quem quiser vira
// pedido pela tela de Pedidos.
import { prisma } from "@/lib/prisma";
import { idDaUnidadeFisica } from "@/lib/unidade-fisica";
import { carregarIndiceReceitas, explodirReceitaPura, CicloReceitaError } from "@/lib/receita";
import { resolverItensVendaPura, EXPLICACAO_MOTIVO } from "@/lib/resolucao-item-venda";
import { emOrdemDeBloqueio } from "@/lib/ordem-de-bloqueio";
import { comRetentativaDeConflito } from "@/lib/transacao";

export type ResultadoReprocessamentoVendas = {
  linhasSemItem: number;
  linhasCasadas: number;
  casadosPorCodigo: number;
  casadosPorNome: number;
  /** Produtos que ganharam baixa teórica agora, e quanto. */
  consumoAplicado: { produto: string; unidadeMedida: string; quantidade: number }[];
  /** Linhas que continuam sem item de venda cadastrado. */
  naoReconhecidos: { nome: string; codigo: string | null; quantidadeVendida: number; motivo: string }[];
  /** Semanas tocadas, pra conferir contra o que a origem mandou. */
  semanas: { vendaSemanalId: string; periodoInicio: string; periodoFim: string }[];
};

export async function reprocessarVendasNaoReconhecidas(
  unidadeNome: string,
  vendaSemanalId?: string
): Promise<ResultadoReprocessamentoVendas> {
  const unidade = await prisma.unidade.findUnique({ where: { nome: unidadeNome } });
  if (!unidade) throw new Error(`Unidade "${unidadeNome}" não encontrada.`);
  // A venda é da CASA; o consumo que ela gera é da DESPENSA.
  const unidadeFisicaId = await idDaUnidadeFisica(unidade.id);

  const linhas = await prisma.itemVendaSemanal.findMany({
    where: {
      itemVendaId: null,
      vendaSemanal: { unidadeId: unidade.id, ...(vendaSemanalId ? { id: vendaSemanalId } : {}) },
    },
    select: {
      id: true,
      nomeBruto: true,
      codigoBruto: true,
      quantidadeVendida: true,
      vendaSemanal: { select: { id: true, periodoInicio: true, periodoFim: true } },
    },
  });

  const vazio: ResultadoReprocessamentoVendas = {
    linhasSemItem: linhas.length,
    linhasCasadas: 0,
    casadosPorCodigo: 0,
    casadosPorNome: 0,
    consumoAplicado: [],
    naoReconhecidos: [],
    semanas: [],
  };
  if (linhas.length === 0) return vazio;

  const catalogo = await prisma.itemVenda.findMany({ where: { unidadeId: unidade.id } });
  const porId = new Map(catalogo.map((iv) => [iv.id, iv]));
  const resolucoes = resolverItensVendaPura(
    linhas.map((l) => ({ nome: l.nomeBruto, codigo: l.codigoBruto, quantidadeVendida: l.quantidadeVendida })),
    catalogo
  );

  const indice = await carregarIndiceReceitas(unidade.id);
  const consumoTotal = new Map<string, number>();
  const aCasar: { linhaId: string; itemVendaId: string }[] = [];
  const naoReconhecidos: ResultadoReprocessamentoVendas["naoReconhecidos"] = [];
  const semanas = new Map<string, { vendaSemanalId: string; periodoInicio: string; periodoFim: string }>();
  let casadosPorCodigo = 0;
  let casadosPorNome = 0;

  resolucoes.forEach((r, n) => {
    const linha = linhas[n];
    if (!r.itemVendaId) {
      naoReconhecidos.push({
        nome: linha.nomeBruto,
        codigo: linha.codigoBruto,
        quantidadeVendida: linha.quantidadeVendida,
        motivo: EXPLICACAO_MOTIVO[r.motivo!],
      });
      return;
    }
    if (r.via === "CODIGO") casadosPorCodigo++;
    else casadosPorNome++;
    aCasar.push({ linhaId: linha.id, itemVendaId: r.itemVendaId });
    semanas.set(linha.vendaSemanal.id, {
      vendaSemanalId: linha.vendaSemanal.id,
      periodoInicio: linha.vendaSemanal.periodoInicio.toISOString().slice(0, 10),
      periodoFim: linha.vendaSemanal.periodoFim.toISOString().slice(0, 10),
    });

    const item = porId.get(r.itemVendaId)!;
    if (!item.receitaId) return; // sem ficha: a venda entra, o consumo não tem como ser calculado
    try {
      const insumos = explodirReceitaPura(item.receitaId, linha.quantidadeVendida, indice);
      for (const [produtoId, qtd] of insumos) {
        consumoTotal.set(produtoId, (consumoTotal.get(produtoId) ?? 0) + qtd);
      }
    } catch (e) {
      // Ficha em ciclo não derruba o reprocessamento inteiro: a venda casa e o
      // consumo dela fica de fora até alguém corrigir a ficha (a tela de
      // Fichas técnicas mostra o ciclo com nome e tudo).
      if (!(e instanceof CicloReceitaError)) throw e;
    }
  });

  if (aCasar.length === 0) {
    return { ...vazio, naoReconhecidos, semanas: [] };
  }

  // A baixa é carimbada com o FIM do período da venda, não com a hora de agora
  // — mesma razão da data da nota na compra: é esse instante que o relatório de
  // consumo lê pra decidir em que semana a saída caiu.
  const fimMaisRecente = new Date(
    Math.max(...linhas.map((l) => l.vendaSemanal.periodoFim.getTime()))
  );

  const produtos = await prisma.produto.findMany({
    where: { id: { in: [...consumoTotal.keys()] } },
    select: { id: true, nome: true, unidadeMedida: true },
  });

  await comRetentativaDeConflito(() =>
    prisma.$transaction(async (tx) => {
    for (const { linhaId, itemVendaId } of aCasar) {
      await tx.itemVendaSemanal.update({ where: { id: linhaId }, data: { itemVendaId } });
    }
    // Ordem estável de id — ver src/lib/ordem-de-bloqueio.ts.
    for (const [produtoId, quantidade] of emOrdemDeBloqueio(consumoTotal)) {
      if (quantidade <= 0) continue;
      await tx.estoqueSaldo.upsert({
        where: { unidadeId_produtoId: { unidadeId: unidadeFisicaId, produtoId } },
        update: { quantidade: { decrement: quantidade } },
        create: { unidadeId: unidadeFisicaId, produtoId, quantidade: -quantidade },
      });
      await tx.movimentoEstoque.create({
        data: {
          unidadeId: unidadeFisicaId,
          produtoId,
          tipo: "SAIDA_CONSUMO",
          quantidade: -quantidade,
          referencia: [...semanas.keys()][0] ?? null,
          observacao: "Consumo de linhas de venda reprocessadas depois do cadastro do item",
          criadoEm: fimMaisRecente,
        },
      });
    }
    }, { timeout: 60_000 })
  );

  const nomePorId = new Map(produtos.map((p) => [p.id, p]));
  return {
    linhasSemItem: linhas.length,
    linhasCasadas: aCasar.length,
    casadosPorCodigo,
    casadosPorNome,
    consumoAplicado: [...consumoTotal]
      .filter(([, q]) => q > 0)
      .map(([produtoId, quantidade]) => ({
        produto: nomePorId.get(produtoId)?.nome ?? produtoId,
        unidadeMedida: nomePorId.get(produtoId)?.unidadeMedida ?? "",
        quantidade,
      }))
      .sort((a, b) => b.quantidade - a.quantidade),
    naoReconhecidos,
    semanas: [...semanas.values()],
  };
}
