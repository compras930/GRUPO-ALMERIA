"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { normalizarNome } from "@/lib/nome-normalizado";

/**
 * Liga um item de cardápio ao produto que ele é — a revenda direta.
 *
 * GRAVA COMO RECEITA DE UM INGREDIENTE, e não como um campo novo. Todo o resto
 * do app (baixa de estoque na carga de venda, consumo, CMV teórico,
 * conferência, lista de compras) já sabe trabalhar com receita; um segundo
 * caminho "venda direta" seria uma segunda regra para a mesma pergunta, e aí
 * ninguém mais sabe qual está valendo quando os dois discordarem.
 *
 * A RECEITA É DA CASA DO ITEM, porque receita segue a cozinha — ver
 * src/lib/unidade-fisica.ts.
 */
export async function vincularRevendaDireta(
  itemVendaId: string,
  produtoId: string,
  quantidade: number
): Promise<{ erro: string } | { ok: true }> {
  await requireAdmin();
  if (!itemVendaId || !produtoId) return { erro: "Escolha o produto." };
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    return { erro: "A quantidade por unidade vendida tem que ser maior que zero." };
  }

  const item = await prisma.itemVenda.findUnique({
    where: { id: itemVendaId },
    select: { id: true, nome: true, unidadeId: true, receitaId: true },
  });
  if (!item) return { erro: "Item de venda não encontrado." };
  if (item.receitaId) return { erro: "Este item já tem ficha técnica." };

  const produto = await prisma.produto.findUnique({
    where: { id: produtoId },
    select: { id: true, unidadeMedida: true },
  });
  if (!produto) return { erro: "Produto não encontrado." };

  await prisma.$transaction(async (tx) => {
    const receita = await tx.receita.create({
      data: {
        unidadeId: item.unidadeId,
        nome: normalizarNome(item.nome),
        // Rendimento 1: a receita rende exatamente uma unidade vendida, que é
        // o que "revenda" quer dizer. Sem isso o custo sairia dividido por um
        // rendimento inventado.
        rendimentoQtd: 1,
        rendimentoUnidade: "UND",
        ingredientes: {
          create: [{ produtoId: produto.id, quantidade, unidadeMedida: produto.unidadeMedida }],
        },
      },
    });
    await tx.itemVenda.update({ where: { id: item.id }, data: { receitaId: receita.id } });
  });

  revalidatePath("/cmv/revenda");
  revalidatePath("/cmv");
  return { ok: true };
}

/**
 * Aplica de uma vez os vínculos de nome idêntico.
 *
 * SÓ OS EXATOS. Parecido vai um a um: "COCA COLA ZERO" e "COCA COLA ZERO
 * 310ML LATA" podem ser a mesma coisa ou podem ser lata e garrafa, e a
 * diferença é o dobro do estoque descontado.
 */
export async function vincularEmLote(
  pares: { itemVendaId: string; produtoId: string }[]
): Promise<{ vinculados: number; erros: number }> {
  await requireAdmin();
  let vinculados = 0;
  let erros = 0;
  for (const par of pares) {
    const r = await vincularRevendaDireta(par.itemVendaId, par.produtoId, 1);
    if ("ok" in r) vinculados++;
    else erros++;
  }
  revalidatePath("/cmv/revenda");
  return { vinculados, erros };
}

/**
 * Desfaz o vínculo.
 *
 * DESLIGA SEMPRE, APAGA QUASE NUNCA. A receita só é apagada quando ela é
 * claramente a casquinha que esta tela criou — um ingrediente só, e nenhum
 * outro item de cardápio apontando para ela. Ficha escrita à mão não pode
 * sumir por um clique em "desvincular": o trabalho de quem a escreveu não é
 * deste botão.
 */
export async function desfazerRevendaDireta(itemVendaId: string): Promise<{ erro?: string }> {
  await requireAdmin();
  const item = await prisma.itemVenda.findUnique({
    where: { id: itemVendaId },
    select: { receitaId: true },
  });
  if (!item?.receitaId) return { erro: "Este item não tem ficha." };

  const receita = await prisma.receita.findUnique({
    where: { id: item.receitaId },
    select: {
      id: true,
      _count: { select: { ingredientes: true, itensVenda: true, usadaComoSubReceitaEm: true } },
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.itemVenda.update({ where: { id: itemVendaId }, data: { receitaId: null } });
    const descartavel =
      receita &&
      receita._count.ingredientes === 1 &&
      receita._count.itensVenda <= 1 &&
      receita._count.usadaComoSubReceitaEm === 0;
    if (descartavel) await tx.receita.delete({ where: { id: receita!.id } });
  });

  revalidatePath("/cmv/revenda");
  revalidatePath("/cmv");
  return {};
}
