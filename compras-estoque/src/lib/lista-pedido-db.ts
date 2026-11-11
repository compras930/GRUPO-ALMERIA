// A lista de compras da casa, agrupada como a planilha que ela já usa.
//
// A ORDEM É A DA PLANILHA, e isso não é nostalgia: as seções seguem o caminho
// de quem anda pela despensa — laticínios, proteínas, mercearia, bebidas,
// limpeza. Ordenar por nome, ou por valor, obrigaria a pessoa a procurar cada
// item em vez de descer a lista de uma vez, que é como ela faz hoje.
//
// TOLERANTE À TABELA QUE AINDA NÃO EXISTE: entre o código subir e o SQL ser
// aplicado à mão no console há uma janela, e nela a consulta estouraria. Aqui
// ela devolve lista vazia, e a tela cai no formulário antigo em vez de morrer.

import { prisma } from "@/lib/prisma";

export type ItemDaLista = {
  id: string;
  nome: string;
  unidadeCompra: string;
  produtoId: string | null;
  fornecedorPadraoId: string | null;
};

export type SecaoDaLista = { secao: string; itens: ItemDaLista[] };

export async function listaDaCasa(unidadeId: string): Promise<SecaoDaLista[]> {
  let itens: (ItemDaLista & { secao: string })[];
  try {
    itens = await prisma.listaPedidoItem.findMany({
      where: { unidadeId, ativo: true },
      select: {
        id: true,
        secao: true,
        nome: true,
        unidadeCompra: true,
        produtoId: true,
        fornecedorPadraoId: true,
      },
      orderBy: { ordem: "asc" },
    });
  } catch {
    return [];
  }

  // Agrupa preservando a ordem de aparição — a mesma da planilha.
  const porSecao = new Map<string, ItemDaLista[]>();
  for (const i of itens) {
    const { secao, ...item } = i;
    if (!porSecao.has(secao)) porSecao.set(secao, []);
    porSecao.get(secao)!.push(item);
  }
  return [...porSecao].map(([secao, itens]) => ({ secao, itens }));
}
