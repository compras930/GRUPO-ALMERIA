"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { podeAprovarPedido, podeCriarPedido, unidadeVisivel } from "@/lib/permissions";

type ItemInput = { produtoId: string; quantidade: number; precoUnitEsperado: number };

export async function criarPedido(formData: FormData) {
  const user = await requireSession();
  if (!podeCriarPedido(user.papel)) throw new Error("Seu papel não pode criar pedidos.");

  const unidadeId = String(formData.get("unidadeId") || "");
  const fornecedorId = String(formData.get("fornecedorId") || "");
  const observacao = String(formData.get("observacao") || "").trim() || null;
  const itensRaw = String(formData.get("itens") || "[]");

  if (!unidadeVisivel(user.papel, user.unidadeId, unidadeId)) {
    throw new Error("Você não tem acesso a essa unidade.");
  }
  if (!unidadeId || !fornecedorId) throw new Error("Selecione unidade e fornecedor.");

  let itens: ItemInput[];
  try {
    itens = JSON.parse(itensRaw);
  } catch {
    throw new Error("Itens inválidos.");
  }
  itens = itens.filter((i) => i.produtoId && i.quantidade > 0);
  if (itens.length === 0) throw new Error("Adicione ao menos um item com quantidade.");

  const ultimo = await prisma.pedidoCompra.findFirst({ orderBy: { numero: "desc" } });
  const numero = (ultimo?.numero ?? 0) + 1;

  const pedido = await prisma.pedidoCompra.create({
    data: {
      numero,
      unidadeId,
      fornecedorId,
      solicitanteId: user.id,
      observacao,
      status: "AGUARDANDO_APROVACAO",
      itens: {
        create: itens.map((i) => ({
          produtoId: i.produtoId,
          quantidade: i.quantidade,
          precoUnitEsperado: i.precoUnitEsperado || 0,
        })),
      },
    },
  });

  revalidatePath("/pedidos");
  redirect(`/pedidos/${pedido.id}`);
}

export async function aprovarPedido(id: string) {
  const user = await requireSession();
  if (!podeAprovarPedido(user.papel)) throw new Error("Seu papel não pode aprovar pedidos.");

  const pedido = await prisma.pedidoCompra.findUniqueOrThrow({ where: { id } });
  if (!unidadeVisivel(user.papel, user.unidadeId, pedido.unidadeId)) {
    throw new Error("Você não tem acesso a essa unidade.");
  }
  if (pedido.status !== "AGUARDANDO_APROVACAO") throw new Error("Pedido não está aguardando aprovação.");

  await prisma.pedidoCompra.update({
    where: { id },
    data: { status: "APROVADO", aprovadorId: user.id, aprovadoEm: new Date(), motivoRejeicao: null },
  });
  revalidatePath(`/pedidos/${id}`);
  revalidatePath("/pedidos");
}

export async function rejeitarPedido(id: string, formData: FormData) {
  const user = await requireSession();
  if (!podeAprovarPedido(user.papel)) throw new Error("Seu papel não pode rejeitar pedidos.");

  const pedido = await prisma.pedidoCompra.findUniqueOrThrow({ where: { id } });
  if (!unidadeVisivel(user.papel, user.unidadeId, pedido.unidadeId)) {
    throw new Error("Você não tem acesso a essa unidade.");
  }
  if (pedido.status !== "AGUARDANDO_APROVACAO") throw new Error("Pedido não está aguardando aprovação.");

  const motivo = String(formData.get("motivo") || "").trim();

  await prisma.pedidoCompra.update({
    where: { id },
    data: {
      status: "REJEITADO",
      aprovadorId: user.id,
      aprovadoEm: new Date(),
      motivoRejeicao: motivo || "Sem motivo informado.",
    },
  });
  revalidatePath(`/pedidos/${id}`);
  revalidatePath("/pedidos");
}

export async function marcarEnviado(id: string) {
  const user = await requireSession();
  const pedido = await prisma.pedidoCompra.findUniqueOrThrow({ where: { id } });
  if (!unidadeVisivel(user.papel, user.unidadeId, pedido.unidadeId)) {
    throw new Error("Você não tem acesso a essa unidade.");
  }
  if (pedido.status !== "APROVADO") throw new Error("Pedido precisa estar aprovado.");

  await prisma.pedidoCompra.update({ where: { id }, data: { status: "ENVIADO" } });
  revalidatePath(`/pedidos/${id}`);
  revalidatePath("/pedidos");
}

export async function cancelarPedido(id: string) {
  const user = await requireSession();
  const pedido = await prisma.pedidoCompra.findUniqueOrThrow({ where: { id } });
  if (!unidadeVisivel(user.papel, user.unidadeId, pedido.unidadeId)) {
    throw new Error("Você não tem acesso a essa unidade.");
  }
  if (["RECEBIDO_TOTAL", "CANCELADO"].includes(pedido.status)) {
    throw new Error("Esse pedido não pode mais ser cancelado.");
  }

  await prisma.pedidoCompra.update({ where: { id }, data: { status: "CANCELADO" } });
  revalidatePath(`/pedidos/${id}`);
  revalidatePath("/pedidos");
}
