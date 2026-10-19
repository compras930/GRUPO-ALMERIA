"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { idDaUnidadeFisica } from "@/lib/unidade-fisica";
import { requireSession } from "@/lib/session";
import { unidadeVisivel } from "@/lib/permissions";
import { TIPO_PERDA } from "@/lib/constants";

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

/**
 * Lança uma baixa declarada: mercadoria que saiu da despensa e não virou venda.
 *
 * O gerente da unidade lança DIARIAMENTE, no momento em que acontece. Perda
 * anotada no fim da semana, de memória, é estimativa — e estimativa dentro de
 * um indicador de CMV é pior que ausência, porque tem cara de medição.
 *
 * O MOVIMENTO É NEGATIVO e abate o saldo, para a prateleira ficar honesta entre
 * contagens. Mas ele NÃO entra na conta de consumo: o tipo PERDA_* fica fora de
 * TIPOS_DE_ENTRADA de propósito. A baixa já está dentro do consumo — o que foi
 * jogado fora já não está na contagem final. Somar seria contar duas vezes.
 * Ver o comentário de perdasPorProdutoPura em src/lib/consumo.ts.
 *
 * Não existe saldo mínimo nem recusa por "não tem tanto em estoque": se a
 * prateleira diz que há 2 kg e o gerente jogou 3 fora, quem está errado é o
 * saldo, e travar a baixa só faria a realidade ficar de fora do sistema. O
 * saldo negativo resultante aparece na tela de estoque, que é onde deve
 * aparecer.
 */
export async function registrarPerda(formData: FormData) {
  const user = await requireSession();
  const unidadeId = String(formData.get("unidadeId") || "");
  const produtoId = String(formData.get("produtoId") || "");
  const tipo = String(formData.get("tipo") || "");
  const observacao = String(formData.get("observacao") || "").trim() || null;
  // Teclado brasileiro manda vírgula; Number("1,5") é NaN.
  const quantidade = Number(String(formData.get("quantidade") || "").trim().replace(",", "."));

  if (!unidadeVisivel(user.papel, user.unidadeId, unidadeId)) {
    throw new Error("Você não tem acesso a essa unidade.");
  }
  if (!produtoId) throw new Error("Escolha o produto.");
  if (!(TIPO_PERDA as readonly string[]).includes(tipo)) throw new Error("Escolha o motivo da baixa.");
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    throw new Error("Informe uma quantidade maior que zero.");
  }

  const unidadeFisicaId = await idDaUnidadeFisica(unidadeId);

  await prisma.$transaction(async (tx) => {
    await tx.movimentoEstoque.create({
      data: {
        unidadeId: unidadeFisicaId,
        produtoId,
        tipo,
        // Negativo: a convenção de MovimentoEstoque é "positivo = entrada,
        // negativo = saída". O formulário pede número positivo porque ninguém
        // digita "-3" pra dizer que jogou 3 fora.
        quantidade: -quantidade,
        referencia: user.id,
        observacao,
      },
    });

    await tx.estoqueSaldo.upsert({
      where: { unidadeId_produtoId: { unidadeId: unidadeFisicaId, produtoId } },
      update: { quantidade: { decrement: quantidade } },
      create: { unidadeId: unidadeFisicaId, produtoId, quantidade: -quantidade },
    });
  });

  revalidatePath("/estoque/perdas");
  revalidatePath("/estoque");
  revalidatePath("/estoque/consumo");
}
