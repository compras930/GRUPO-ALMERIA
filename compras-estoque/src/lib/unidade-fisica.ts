// Distingue "casa" de "unidade física".
//
// Noroeste e Matri são duas casas — cardápio próprio, caixa próprio, venda
// medida em separado, que é exatamente por que existem duas — mas uma unidade
// física só: mesma cozinha, mesma despensa, mesma nota de compra, mesma
// contagem. As outras três (104 Sul, Wine Garden, Beira Lago) são unidades
// físicas de verdade.
//
// Sem essa distinção, tudo que é "por unidade" fica duplicado entre Noroeste e
// Matri: 75 insumos precificados duas vezes, duas despensas pra uma, e cada
// nota de compra teria que ser lançada duas vezes ou uma das casas fica com
// preço velho.
//
// A REGRA:
//   segue a unidade FÍSICA -> PrecoAtualProduto, HistoricoPrecoProduto,
//                             EstoqueSaldo, MovimentoEstoque, ContagemEstoque,
//                             NotaCompra, PedidoCompra, ParametroEstoqueProduto
//   segue a CASA           -> ItemVenda, VendaSemanal
//   (Receita segue a cozinha, mas a unificação dela é uma frente à parte:
//    exige decidir, caso a caso, qual versão vale nas 6 receitas homônimas.)
//
// Núcleo puro separado do acesso a banco, mesmo padrão de explodirReceitaPura
// e resolverIngredientesPura.
import type { PrismaClient, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type MapaEstoque = Map<string, string | null>; // unidadeId -> estoqueEmId

/**
 * Onde o estoque/preço dessa casa realmente mora.
 *
 * Só um nível: uma casa aponta pra uma unidade física, que por definição
 * guarda o próprio estoque. Uma cadeia (A -> B -> C) seria erro de cadastro, e
 * esta função para no primeiro salto em vez de seguir — devolver o id errado
 * em silêncio é pior que devolver o do meio, que ao menos existe e é visível.
 */
export function resolverUnidadeFisicaPura(unidadeId: string, mapa: MapaEstoque): string {
  return mapa.get(unidadeId) ?? unidadeId;
}

/** Cliente Prisma normal OU o `tx` de dentro de um `prisma.$transaction`. */
type Cliente = PrismaClient | Prisma.TransactionClient;

export async function carregarMapaEstoque(cliente: Cliente = prisma): Promise<MapaEstoque> {
  const unidades = await cliente.unidade.findMany({ select: { id: true, estoqueEmId: true } });
  return new Map(unidades.map((u) => [u.id, u.estoqueEmId]));
}

/**
 * Atalho pra quando só uma unidade importa. Quem precisa resolver várias de
 * uma vez usa carregarMapaEstoque + resolverUnidadeFisicaPura, pra não bater
 * no banco uma vez por casa.
 */
export async function idDaUnidadeFisica(unidadeId: string, cliente: Cliente = prisma): Promise<string> {
  const u = await cliente.unidade.findUnique({ where: { id: unidadeId }, select: { estoqueEmId: true } });
  return u?.estoqueEmId ?? unidadeId;
}

/**
 * Todas as casas que vivem numa unidade física: ela mesma e as que apontam pra
 * ela. Noroeste devolve [Noroeste, Matri]; 104 Sul devolve [104 Sul].
 *
 * É o que responde "esta nota de compra mexeu no custo de quais pratos?" — a
 * nota é da despensa, mas o cardápio afetado é o das duas casas. Consultar só
 * a casa da nota deixaria as fichas do Matri fora do relatório de impacto, em
 * silêncio.
 */
export async function casasDaUnidadeFisica(
  unidadeFisicaId: string,
  cliente: Cliente = prisma
): Promise<string[]> {
  const casas = await cliente.unidade.findMany({
    where: { OR: [{ id: unidadeFisicaId }, { estoqueEmId: unidadeFisicaId }] },
    select: { id: true },
  });
  return casas.map((c) => c.id);
}

/**
 * As unidades que guardam estoque próprio — é o que deve aparecer num seletor
 * de "onde contar / onde receber / pra onde comprar".
 *
 * Deixar Matri nesses seletores ofereceria uma despensa que não existe: a
 * contagem iria pra um saldo que ninguém lê e sumiria do estoque de verdade.
 */
export async function unidadesComEstoqueProprio(cliente: Cliente = prisma) {
  return cliente.unidade.findMany({
    where: { ativo: true, estoqueEmId: null },
    orderBy: { nome: "asc" },
  });
}
