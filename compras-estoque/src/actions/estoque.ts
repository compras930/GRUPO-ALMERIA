"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { idDaUnidadeFisica } from "@/lib/unidade-fisica";
import { requireSession } from "@/lib/session";
import { unidadeVisivel } from "@/lib/permissions";

/**
 * Registra a contagem de vários produtos de uma vez — o bloco da semana.
 *
 * Campo vazio é PULADO, não vira zero. Quem conta 45 itens e não acha um deles
 * deixa em branco; gravar zero ali diria "conferi e não tem nenhum", que é
 * outra afirmação, e ela entraria no consumo como se o estoque tivesse sumido.
 *
 * Tudo numa transação: uma contagem pela metade, se a conexão cair no meio,
 * deixaria parte dos produtos com data nova e parte com data velha — e o
 * relatório de consumo entre contagens leria períodos que nunca existiram.
 */
export async function registrarContagemEmLote(formData: FormData) {
  const user = await requireSession();
  const unidadeId = String(formData.get("unidadeId") || "");
  if (!unidadeVisivel(user.papel, user.unidadeId, unidadeId)) {
    throw new Error("Você não tem acesso a essa unidade.");
  }
  const unidadeFisicaId = await idDaUnidadeFisica(unidadeId);

  const contadas: { produtoId: string; quantidade: number }[] = [];
  for (const [campo, valor] of formData.entries()) {
    if (!campo.startsWith("qtd_")) continue;
    const texto = String(valor).trim();
    if (texto === "") continue;
    const quantidade = Number(texto.replace(",", "."));
    if (Number.isNaN(quantidade) || quantidade < 0) {
      throw new Error(`Quantidade inválida: "${texto}".`);
    }
    contadas.push({ produtoId: campo.slice(4), quantidade });
  }
  if (contadas.length === 0) throw new Error("Nenhuma quantidade preenchida.");

  await prisma.$transaction(async (tx) => {
    const saldos = await tx.estoqueSaldo.findMany({
      where: { unidadeId: unidadeFisicaId, produtoId: { in: contadas.map((c) => c.produtoId) } },
    });
    const saldoPorProduto = new Map(saldos.map((s) => [s.produtoId, s.quantidade]));

    for (const { produtoId, quantidade } of contadas) {
      const quantidadeSistema = saldoPorProduto.get(produtoId) ?? 0;
      const diferenca = quantidade - quantidadeSistema;

      await tx.contagemEstoque.create({
        data: {
          unidadeId: unidadeFisicaId,
          produtoId,
          quantidadeSistema,
          quantidadeContada: quantidade,
          diferenca,
          contadoPorId: user.id,
        },
      });
      await tx.estoqueSaldo.upsert({
        where: { unidadeId_produtoId: { unidadeId: unidadeFisicaId, produtoId } },
        update: { quantidade },
        create: { unidadeId: unidadeFisicaId, produtoId, quantidade },
      });
      if (diferenca !== 0) {
        await tx.movimentoEstoque.create({
          data: {
            unidadeId: unidadeFisicaId,
            produtoId,
            tipo: "AJUSTE_CONTAGEM",
            quantidade: diferenca,
            observacao: "Ajuste por contagem de inventário",
          },
        });
      }
    }
  });

  revalidatePath("/estoque");
  revalidatePath("/estoque/contagem");
  revalidatePath("/estoque/consumo");
  return { registradas: contadas.length };
}

export async function registrarContagem(formData: FormData) {
  const user = await requireSession();
  const unidadeId = String(formData.get("unidadeId") || "");
  const produtoId = String(formData.get("produtoId") || "");
  const quantidadeContada = Number(formData.get("quantidadeContada"));

  if (!unidadeVisivel(user.papel, user.unidadeId, unidadeId)) {
    throw new Error("Você não tem acesso a essa unidade.");
  }
  if (!produtoId || Number.isNaN(quantidadeContada) || quantidadeContada < 0) {
    throw new Error("Informe produto e quantidade contada válidos.");
  }

  // A contagem é da DESPENSA. O seletor já só oferece unidade com estoque
  // próprio, mas o id vem da URL: resolver aqui impede que uma contagem
  // digitada à mão vá parar num saldo que ninguém lê.
  const unidadeFisicaId = await idDaUnidadeFisica(unidadeId);

  await prisma.$transaction(async (tx) => {
    const saldo = await tx.estoqueSaldo.findUnique({
      where: { unidadeId_produtoId: { unidadeId: unidadeFisicaId, produtoId } },
    });
    const quantidadeSistema = saldo?.quantidade ?? 0;
    const diferenca = quantidadeContada - quantidadeSistema;

    await tx.contagemEstoque.create({
      data: {
        unidadeId: unidadeFisicaId,
        produtoId,
        quantidadeSistema,
        quantidadeContada,
        diferenca,
        contadoPorId: user.id,
      },
    });

    await tx.estoqueSaldo.upsert({
      where: { unidadeId_produtoId: { unidadeId: unidadeFisicaId, produtoId } },
      update: { quantidade: quantidadeContada },
      create: { unidadeId: unidadeFisicaId, produtoId, quantidade: quantidadeContada },
    });

    if (diferenca !== 0) {
      await tx.movimentoEstoque.create({
        data: {
          unidadeId: unidadeFisicaId,
          produtoId,
          tipo: "AJUSTE_CONTAGEM",
          quantidade: diferenca,
          observacao: "Ajuste por contagem de inventário",
        },
      });
    }
  });

  revalidatePath("/estoque");
  revalidatePath("/estoque/contagem");
}
