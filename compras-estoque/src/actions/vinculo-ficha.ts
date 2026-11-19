"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { casasDaUnidadeFisica, idDaUnidadeFisica } from "@/lib/unidade-fisica";

/**
 * Aponta um item do cardápio para a ficha técnica que o descreve.
 *
 * NÃO CRIA NADA. A ficha já existe, escrita pelo chef; o trabalho aqui é só
 * dizer qual é a do prato. É a diferença para a revenda direta, onde o app
 * precisa inventar uma receita de um ingrediente porque ela não existia.
 *
 * A FICHA TEM DE SER DA MESMA COZINHA. Receita segue a despensa (ver
 * src/lib/unidade-fisica.ts): apontar o prato do Wine Garden para a ficha do
 * Beira Lago baixaria estoque na casa errada, e o erro só apareceria semanas
 * depois, como falta inexplicável de um lado e sobra do outro.
 */
export async function vincularFichaAoItem(
  itemVendaId: string,
  receitaId: string
): Promise<{ erro: string } | { ok: true }> {
  await requireAdmin();
  if (!itemVendaId || !receitaId) return { erro: "Escolha a ficha." };

  const item = await prisma.itemVenda.findUnique({
    where: { id: itemVendaId },
    select: { id: true, nome: true, unidadeId: true, receitaId: true },
  });
  if (!item) return { erro: "Item de cardápio não encontrado." };
  if (item.receitaId) return { erro: "Este item já tem ficha. Desfaça antes de trocar." };

  const receita = await prisma.receita.findUnique({
    where: { id: receitaId },
    select: {
      id: true,
      nome: true,
      unidadeId: true,
      rendimentoQtd: true,
      _count: { select: { ingredientes: true } },
    },
  });
  if (!receita) return { erro: "Ficha não encontrada." };

  const despensaDoItem = await idDaUnidadeFisica(item.unidadeId);
  const casasDaCozinha = await casasDaUnidadeFisica(despensaDoItem);
  if (!casasDaCozinha.includes(receita.unidadeId)) {
    return { erro: `A ficha "${receita.nome}" é de outra cozinha.` };
  }

  // Ficha vazia não baixa nada; ficha sem rendimento não divide o custo por
  // porção. Ligar assim trocaria "sem ficha" por "ficha que mente", e o
  // segundo é pior: o relatório fica plausível e errado.
  if (receita._count.ingredientes === 0) {
    return { erro: `A ficha "${receita.nome}" não tem ingrediente nenhum.` };
  }
  if (!receita.rendimentoQtd) {
    return { erro: `A ficha "${receita.nome}" está sem rendimento — o custo por porção sairia errado.` };
  }

  await prisma.itemVenda.update({ where: { id: item.id }, data: { receitaId: receita.id } });

  revalidatePath("/cmv/vincular");
  revalidatePath("/cmv");
  return { ok: true };
}

/**
 * Aplica de uma vez os vínculos de nome idêntico.
 *
 * SÓ OS EXATOS, pela mesma razão da revenda direta: "TARTAR DE ATUM" e
 * "MONTAGEM - TARTAR DE ATUM" quase certamente são o mesmo prato, mas "quase
 * certamente" não é critério para gravar 150 vínculos sem ninguém olhar.
 */
export async function vincularFichasEmLote(
  pares: { itemVendaId: string; receitaId: string }[]
): Promise<{ vinculados: number; erros: number; primeiroErro?: string }> {
  await requireAdmin();
  let vinculados = 0;
  let erros = 0;
  let primeiroErro: string | undefined;
  for (const par of pares) {
    const r = await vincularFichaAoItem(par.itemVendaId, par.receitaId);
    if ("ok" in r) vinculados++;
    else {
      erros++;
      primeiroErro ??= r.erro;
    }
  }
  revalidatePath("/cmv/vincular");
  revalidatePath("/cmv");
  return { vinculados, erros, primeiroErro };
}

/**
 * Desliga o item da ficha.
 *
 * A FICHA NUNCA É APAGADA. Ela é trabalho do chef e pode estar ligada a outros
 * pratos, ou ser sub-receita de meia dúzia deles. Desvincular é dizer "este
 * prato não é esta ficha", não "esta ficha não existe".
 */
export async function desfazerVinculoFicha(itemVendaId: string): Promise<{ erro?: string }> {
  await requireAdmin();
  const item = await prisma.itemVenda.findUnique({
    where: { id: itemVendaId },
    select: { receitaId: true },
  });
  if (!item?.receitaId) return { erro: "Este item não tem ficha." };

  await prisma.itemVenda.update({ where: { id: itemVendaId }, data: { receitaId: null } });

  revalidatePath("/cmv/vincular");
  revalidatePath("/cmv");
  return {};
}
