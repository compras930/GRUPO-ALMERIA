// Lógica da automação 1 (preço automático via n8n): recebe a planilha
// "última compra" do Teknisa, casa cada linha contra o catálogo de Produto
// por nome (só match exato — nunca funde por aproximação, mesmo princípio
// já usado nas outras importações desta base), atualiza PrecoAtualProduto/
// HistoricoPrecoProduto respeitando "só sobrescreve se a data for mais
// recente", e reporta quais ItemVenda foram impactados (em cascata, via
// sub-receita) comparando o custo antes/depois da atualização.
import { prisma } from "@/lib/prisma";
import { normalizarNome, chaveComparacao } from "@/lib/nome-normalizado";
import {
  carregarIndiceReceitas,
  carregarPrecoAtualPorProduto,
  receitasAfetadasPor,
  explodirReceitaPura,
  type IndiceReceitas,
} from "@/lib/receita";

// Sinônimos de unidade que o catálogo já usa (ver padronização KG/LT/UND
// feita nesta conversa) — normaliza a unidade que vier da planilha antes
// de tentar casar, pra "UN"/"UNIDADE" da planilha não falhar em bater com
// um produto já cadastrado em "UND".
const SINONIMO_UNIDADE: Record<string, string> = {
  UN: "UND",
  UNIDADE: "UND",
  UNI: "UND",
  UNID: "UND",
  PC: "UND",
};

function normalizarUnidade(unidadeBruta: string): string {
  const u = normalizarNome(unidadeBruta).toUpperCase();
  return SINONIMO_UNIDADE[u] ?? u;
}

export type ItemPrecoInput = { nome: string; unidadeMedida: string; preco: number; dataCompra: string };

export type ResultadoNotaCompra = {
  notaCompraId: string;
  totalRecebido: number;
  precosAtualizados: number;
  precosIgnoradosMaisAntigos: number;
  naoReconhecidos: ItemPrecoInput[];
  itensImpactados: {
    itemVendaId: string;
    nome: string;
    tipo: string;
    custoAntes: number | null;
    custoDepois: number | null;
    cmvAntes: number | null;
    cmvDepois: number | null;
  }[];
};

/** Acha o Produto correspondente a uma linha da planilha, só por match exato de nome+unidade. */
function encontrarProduto(
  porChave: Map<string, { id: string }>,
  nomeBruto: string,
  unidadeBruta: string
): { id: string } | null {
  const nome = normalizarNome(nomeBruto);
  const unidade = normalizarUnidade(unidadeBruta);
  const direto = porChave.get(`${chaveComparacao(nome)}|||${unidade}`);
  if (direto) return direto;

  // Teknisa às vezes repete a unidade dentro do próprio nome (ex.: "ALCATRA
  // BOVINO KG" com unidade "KG") — tenta de novo tirando esse sufixo redundante.
  const sufixo = ` ${unidade}`;
  if (nome.toUpperCase().endsWith(sufixo)) {
    const semSufixo = nome.slice(0, nome.length - sufixo.length).trim();
    return porChave.get(`${chaveComparacao(semSufixo)}|||${unidade}`) ?? null;
  }
  return null;
}

/**
 * Custo de uma receita a partir de um mapa de preços já carregado (não bate
 * no banco) — mesma fórmula de custoReceita (src/lib/receita.ts), só que
 * recebendo o mapa como parâmetro pra poder rodar com precosAntes E
 * precosDepois sem ida nenhuma ao banco entre as duas.
 */
function custoComPrecos(receitaId: string, indice: IndiceReceitas, precos: Map<string, number>): number | null {
  const receita = indice.get(receitaId);
  const qtdBase = receita?.rendimentoQtd && receita.rendimentoQtd > 0 ? receita.rendimentoQtd : 1;
  try {
    const insumos = explodirReceitaPura(receitaId, qtdBase, indice);
    let custoLote = 0;
    for (const [produtoId, qtd] of insumos) custoLote += qtd * (precos.get(produtoId) ?? 0);
    return receita?.rendimentoQtd ? custoLote / receita.rendimentoQtd : custoLote;
  } catch {
    return null; // ciclo — não deveria acontecer aqui (item já apareceria com status CICLO na tela de CMV), mas não trava o relatório
  }
}

export async function processarNotaCompra(
  unidadeNome: string,
  arquivoNome: string | null,
  itens: ItemPrecoInput[],
  importadoPorId: string
): Promise<ResultadoNotaCompra> {
  const unidade = await prisma.unidade.findUnique({ where: { nome: unidadeNome } });
  if (!unidade) throw new Error(`Unidade "${unidadeNome}" não encontrada.`);

  const produtos = await prisma.produto.findMany({ select: { id: true, nome: true, unidadeMedida: true } });
  const porChave = new Map(produtos.map((p) => [`${chaveComparacao(p.nome)}|||${p.unidadeMedida}`, { id: p.id }]));

  // Snapshot do índice/preços ANTES de qualquer escrita, pra poder comparar
  // custo antes/depois sem precisar de uma segunda ida ao banco no final.
  const [indice, precosAntes] = await Promise.all([
    carregarIndiceReceitas(unidade.id),
    carregarPrecoAtualPorProduto(unidade.id),
  ]);

  const naoReconhecidos: ItemPrecoInput[] = [];
  const produtosAlterados = new Set<string>();
  const precosDepois = new Map(precosAntes);
  let precosAtualizados = 0;
  let precosIgnoradosMaisAntigos = 0;

  const notaCompraId = await prisma.$transaction(async (tx) => {
    const notaCompra = await tx.notaCompra.create({
      data: { unidadeId: unidade.id, arquivoNome: arquivoNome ?? "n8n", importadoPorId },
    });

    for (const item of itens) {
      const produto = encontrarProduto(porChave, item.nome, item.unidadeMedida);
      const dataCompra = new Date(item.dataCompra);

      if (!produto) {
        naoReconhecidos.push(item);
        await tx.itemNotaCompra.create({
          data: {
            notaCompraId: notaCompra.id,
            produtoId: null,
            nomeBruto: normalizarNome(item.nome),
            precoUnitNovo: item.preco,
            dataCompra,
          },
        });
        continue;
      }

      const existente = await tx.precoAtualProduto.findUnique({
        where: { unidadeId_produtoId: { unidadeId: unidade.id, produtoId: produto.id } },
      });

      await tx.itemNotaCompra.create({
        data: {
          notaCompraId: notaCompra.id,
          produtoId: produto.id,
          nomeBruto: normalizarNome(item.nome),
          precoUnitNovo: item.preco,
          precoUnitAnterior: existente?.preco ?? null,
          dataCompra,
        },
      });

      if (existente && existente.dataCompra >= dataCompra) {
        precosIgnoradosMaisAntigos++;
        continue;
      }

      await tx.precoAtualProduto.upsert({
        where: { unidadeId_produtoId: { unidadeId: unidade.id, produtoId: produto.id } },
        update: { preco: item.preco, dataCompra },
        create: { unidadeId: unidade.id, produtoId: produto.id, preco: item.preco, dataCompra },
      });
      await tx.historicoPrecoProduto.create({
        data: { unidadeId: unidade.id, produtoId: produto.id, preco: item.preco, origem: "NOTA_COMPRA", origemId: notaCompra.id, dataCompra },
      });

      precosAtualizados++;
      produtosAlterados.add(produto.id);
      precosDepois.set(produto.id, item.preco);
    }

    return notaCompra.id;
  }, { timeout: 60_000 });

  // Custo/CMV impactados: calcula com precosAntes e precosDepois (em memória,
  // sem nova ida ao banco) pra todo ItemVenda cuja receita usa, direta ou
  // indiretamente, algum dos produtos que mudaram de preço.
  const receitasAfetadas = receitasAfetadasPor(produtosAlterados, indice);
  const itensImpactados: ResultadoNotaCompra["itensImpactados"] = [];
  if (receitasAfetadas.size > 0) {
    const itensVenda = await prisma.itemVenda.findMany({
      where: { unidadeId: unidade.id, receitaId: { in: [...receitasAfetadas] } },
    });
    for (const item of itensVenda) {
      const antes = custoComPrecos(item.receitaId!, indice, precosAntes);
      const depois = custoComPrecos(item.receitaId!, indice, precosDepois);
      itensImpactados.push({
        itemVendaId: item.id,
        nome: item.nome,
        tipo: item.tipo,
        custoAntes: antes,
        custoDepois: depois,
        cmvAntes: antes !== null && item.precoVenda ? antes / item.precoVenda : null,
        cmvDepois: depois !== null && item.precoVenda ? depois / item.precoVenda : null,
      });
    }
  }

  return {
    notaCompraId,
    totalRecebido: itens.length,
    precosAtualizados,
    precosIgnoradosMaisAntigos,
    naoReconhecidos,
    itensImpactados,
  };
}
