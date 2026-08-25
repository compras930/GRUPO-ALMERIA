"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { podeReceber, unidadeVisivel } from "@/lib/permissions";

type ItemRecebidoInput = { itemPedidoId: string; quantidadeRecebida: number; precoUnitRecebido: number };

export async function registrarRecebimento(pedidoId: string, formData: FormData) {
  const user = await requireSession();
  if (!podeReceber(user.papel)) throw new Error("Seu papel não pode registrar recebimentos.");

  const pedido = await prisma.pedidoCompra.findUnique({
    where: { id: pedidoId },
    include: { itens: { include: { itensRecebimento: true } } },
  });
  if (!pedido) throw new Error("Pedido não encontrado.");
  if (!unidadeVisivel(user.papel, user.unidadeId, pedido.unidadeId)) {
    throw new Error("Você não tem acesso a essa unidade.");
  }
  if (!["APROVADO", "ENVIADO", "RECEBIDO_PARCIAL"].includes(pedido.status)) {
    throw new Error("Esse pedido não está em condição de receber itens.");
  }

  const observacao = String(formData.get("observacao") || "").trim() || null;
  const itensRaw = String(formData.get("itens") || "[]");
  let itensInput: ItemRecebidoInput[];
  try {
    itensInput = JSON.parse(itensRaw);
  } catch {
    throw new Error("Itens inválidos.");
  }
  itensInput = itensInput.filter((i) => i.quantidadeRecebida > 0);
  if (itensInput.length === 0) throw new Error("Informe a quantidade recebida de ao menos um item.");

  const itemPedidoPorId = new Map(pedido.itens.map((i) => [i.id, i]));

  await prisma.$transaction(async (tx) => {
    const recebimento = await tx.recebimento.create({
      data: {
        pedidoId,
        recebidoPorId: user.id,
        observacao,
        itens: {
          create: itensInput.map((i) => ({
            itemPedidoId: i.itemPedidoId,
            quantidadeRecebida: i.quantidadeRecebida,
            precoUnitRecebido: i.precoUnitRecebido,
          })),
        },
      },
    });

    for (const item of itensInput) {
      const itemPedido = itemPedidoPorId.get(item.itemPedidoId);
      if (!itemPedido) continue;

      await tx.estoqueSaldo.upsert({
        where: { unidadeId_produtoId: { unidadeId: pedido.unidadeId, produtoId: itemPedido.produtoId } },
        update: { quantidade: { increment: item.quantidadeRecebida } },
        create: {
          unidadeId: pedido.unidadeId,
          produtoId: itemPedido.produtoId,
          quantidade: item.quantidadeRecebida,
        },
      });

      await tx.movimentoEstoque.create({
        data: {
          unidadeId: pedido.unidadeId,
          produtoId: itemPedido.produtoId,
          tipo: "ENTRADA_RECEBIMENTO",
          quantidade: item.quantidadeRecebida,
          referencia: recebimento.id,
          observacao: `Recebimento do pedido #${pedido.numero}`,
        },
      });
    }

    // Recalcula status do pedido com base no total recebido acumulado por item.
    const recebidosPorItem = new Map<string, number>();
    for (const item of pedido.itens) {
      const jaRecebido = item.itensRecebimento.reduce((s, r) => s + r.quantidadeRecebida, 0);
      recebidosPorItem.set(item.id, jaRecebido);
    }
    for (const item of itensInput) {
      recebidosPorItem.set(item.itemPedidoId, (recebidosPorItem.get(item.itemPedidoId) || 0) + item.quantidadeRecebida);
    }

    const totalmenteRecebido = pedido.itens.every(
      (item) => (recebidosPorItem.get(item.id) || 0) >= item.quantidade
    );
    const algumRecebido = pedido.itens.some((item) => (recebidosPorItem.get(item.id) || 0) > 0);

    await tx.pedidoCompra.update({
      where: { id: pedidoId },
      data: { status: totalmenteRecebido ? "RECEBIDO_TOTAL" : algumRecebido ? "RECEBIDO_PARCIAL" : pedido.status },
    });
  });

  revalidatePath(`/pedidos/${pedidoId}`);
  revalidatePath("/pedidos");
  revalidatePath("/estoque");
  redirect(`/pedidos/${pedidoId}`);
}
