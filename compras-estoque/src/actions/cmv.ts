"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { normalizarNome } from "@/lib/nome-normalizado";
import { carregarIndiceReceitas, explodirReceitaPura, CicloReceitaError } from "@/lib/receita";

type LinhaIngredienteInput = {
  tipo: "INSUMO" | "SUBRECEITA";
  nome: string;
  unidadeMedida: string;
  quantidade: number;
};

/**
 * Cria (se ainda não existir) ou atualiza a ficha técnica de um ItemVenda:
 * nome/categoria/preço de venda do item, e a lista de ingredientes da
 * receita ligada a ele. Insumo referenciado por nome é criado
 * automaticamente no catálogo se ainda não existir (find-or-create); uma
 * sub-receita referenciada por nome PRECISA já existir na mesma unidade —
 * não cria um "rascunho" fantasma silenciosamente, pra não confundir com
 * uma receita de verdade esquecida a meio caminho.
 *
 * Depois de salvar, valida que a receita não ficou com um ciclo (ela
 * mesma, direta ou indiretamente, apontando de volta pra si) — se ficar,
 * a transação inteira é desfeita e a ação falha com uma mensagem clara,
 * em vez de piorar uma pendência que já existe.
 */
export async function salvarFicha(itemVendaId: string, formData: FormData) {
  await requireAdmin();

  const item = await prisma.itemVenda.findUnique({ where: { id: itemVendaId } });
  if (!item) throw new Error("Item de venda não encontrado.");

  const novoNome = normalizarNome(String(formData.get("nome") || "")) || item.nome;
  const novaCategoria = normalizarNome(String(formData.get("categoria") || "")) || null;
  const novoPrecoVenda = Number(formData.get("precoVenda")) || 0;
  const modoPreparo = String(formData.get("modoPreparo") || "").trim() || null;
  const rendimentoQtdRaw = formData.get("rendimentoQtd");
  const rendimentoQtd = rendimentoQtdRaw ? Number(rendimentoQtdRaw) || null : null;
  const rendimentoUnidade = normalizarNome(String(formData.get("rendimentoUnidade") || "")) || null;

  let linhas: LinhaIngredienteInput[];
  try {
    linhas = JSON.parse(String(formData.get("ingredientes") || "[]"));
  } catch {
    throw new Error("Lista de ingredientes inválida.");
  }
  linhas = linhas.filter((l) => l.nome && l.quantidade > 0);

  await prisma.$transaction(async (tx) => {
    // Garante que existe uma Receita ligada ao item (cria vazia na primeira vez que alguém salva).
    let receitaId = item.receitaId;
    if (!receitaId) {
      const receita = await tx.receita.create({
        data: { unidadeId: item.unidadeId, nome: novoNome, modoPreparo, rendimentoQtd, rendimentoUnidade },
      });
      receitaId = receita.id;
    } else {
      await tx.receita.update({
        where: { id: receitaId },
        data: { modoPreparo, rendimentoQtd, rendimentoUnidade },
      });
    }

    // Resolve cada linha: insumo -> find-or-create Produto; sub-receita -> tem que já existir.
    const dadosIngredientes: { produtoId: string | null; subReceitaId: string | null; quantidade: number; unidadeMedida: string }[] = [];
    for (const linha of linhas) {
      const nome = normalizarNome(linha.nome);
      const unidadeMedida = normalizarNome(linha.unidadeMedida || "UN").toUpperCase();
      if (linha.tipo === "SUBRECEITA") {
        const subReceita = await tx.receita.findUnique({
          where: { unidadeId_nome: { unidadeId: item.unidadeId, nome } },
        });
        if (!subReceita) {
          throw new Error(`Sub-receita "${nome}" não existe nesta unidade ainda — crie a ficha dela primeiro.`);
        }
        if (subReceita.id === receitaId) {
          throw new Error(`Uma receita não pode usar a si mesma ("${nome}") como sub-receita.`);
        }
        dadosIngredientes.push({ produtoId: null, subReceitaId: subReceita.id, quantidade: linha.quantidade, unidadeMedida });
      } else {
        const produto = await tx.produto.upsert({
          where: { nome_unidadeMedida: { nome, unidadeMedida } },
          update: {},
          create: { nome, unidadeMedida },
        });
        dadosIngredientes.push({ produtoId: produto.id, subReceitaId: null, quantidade: linha.quantidade, unidadeMedida });
      }
    }

    await tx.ingredienteReceita.deleteMany({ where: { receitaId } });
    for (const d of dadosIngredientes) {
      await tx.ingredienteReceita.create({ data: { receitaId: receitaId!, ...d } });
    }

    await tx.itemVenda.update({
      where: { id: itemVendaId },
      data: { nome: novoNome, categoria: novaCategoria, precoVenda: novoPrecoVenda, receitaId },
    });

    // Confere que essa edição não criou um ciclo novo (a receita apontando, direta ou
    // indiretamente, de volta pra si mesma) — se criou, desfaz tudo (throw dentro da
    // transação reverte o commit) em vez de deixar a pendência piorar.
    const indice = await carregarIndiceReceitas(item.unidadeId);
    try {
      explodirReceitaPura(receitaId!, 1, indice);
    } catch (e) {
      if (e instanceof CicloReceitaError) {
        throw new Error(
          `Essa combinação de ingredientes criaria um ciclo (uma receita citando a si mesma, direta ou indiretamente): ${e.caminho.join(" → ")}. Ajuste os ingredientes e salve de novo.`
        );
      }
      throw e;
    }
  });

  revalidatePath(`/cmv/${itemVendaId}`);
  revalidatePath("/cmv");
}
