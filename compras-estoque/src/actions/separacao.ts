"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

/**
 * Define o fornecedor de um item do pedido — e APRENDE com isso.
 *
 * A troca feita aqui vira o fornecedor padrão daquele item na lista da casa,
 * para a semana seguinte já vir separada. É o que faz a separação deixar de
 * ser trabalho manual toda semana: na primeira vez alguém decide, nas
 * seguintes só confere.
 *
 * APRENDE SÓ PARA A CASA DO PEDIDO. O Wine Garden pode comprar queijo da
 * Alimente e o Beira Lago do mesmo item na Casa do Queijo — e normalmente é
 * assim mesmo, por preço e por entrega. Propagar a escolha para as outras
 * casas seria decidir por elas.
 */
export async function definirFornecedorDoItem(itemId: string, fornecedorId: string | null) {
  await requireAdmin();

  const item = await prisma.itemPedido.findUnique({
    where: { id: itemId },
    select: { nomeBruto: true, pedido: { select: { unidadeId: true } } },
  });
  if (!item) throw new Error("Item não encontrado.");

  await prisma.itemPedido.update({ where: { id: itemId }, data: { fornecedorId } });

  // A memória é por NOME, porque é o nome que liga o item do pedido à linha da
  // lista — o produto do cadastro pode nem existir ainda.
  if (item.nomeBruto) {
    await prisma.listaPedidoItem.updateMany({
      where: { unidadeId: item.pedido.unidadeId, nome: item.nomeBruto },
      data: { fornecedorPadraoId: fornecedorId },
    });
  }

  revalidatePath("/pedidos/separar");
}
