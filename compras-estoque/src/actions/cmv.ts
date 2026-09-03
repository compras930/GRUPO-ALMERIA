"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { normalizarNome } from "@/lib/nome-normalizado";
import { carregarIndiceReceitas, explodirReceitaPura, CicloReceitaError } from "@/lib/receita";
import { resolverIngredientesPura, type LinhaIngredienteBruta } from "@/lib/resolucao-ingredientes";

// A lista de ingredientes chega do FichaForm identificando cada linha por id
// (produtoId/subReceitaId), nunca por nome — ver src/lib/resolucao-ingredientes.ts.
type LinhaIngredienteInput = LinhaIngredienteBruta;

/**
 * Cria (se ainda não existir) ou atualiza a ficha técnica de um ItemVenda:
 * nome/categoria/preço de venda do item, e a lista de ingredientes da
 * receita ligada a ele.
 *
 * Cada ingrediente chega identificado por id (produtoId ou subReceitaId) e é
 * só VALIDADO aqui — esta action não cria Produto nem Receita. Antes ela
 * resolvia insumo por nome com `produto.upsert`, o que num catálogo com nomes
 * homônimos (produção tem "BURRATA" e "Burrata", as duas em KG) gravava o
 * ingrediente errado ou criava uma terceira variante, silenciosamente. Pra
 * cadastrar um insumo novo, a tela chama `criarProdutoInline` explicitamente
 * antes de salvar a ficha.
 *
 * Se qualquer linha não resolver, a ação falha listando TODAS as linhas com
 * problema (não só a primeira) e nada é gravado — nenhuma linha é descartada
 * em silêncio.
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
  // Linha sem id resolvido nunca deveria chegar aqui (a tela só monta a linha
  // depois que o usuário escolhe um produto/sub-receita do seletor); se chegar,
  // é bug de client ou payload adulterado — a resolução abaixo falha explícito.
  linhas = linhas.filter((l) => l.quantidade > 0);

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

    // Resolve todas as linhas por id, em lote (2 consultas, não 1 por linha), e
    // valida tudo ANTES de escrever qualquer coisa.
    const resolucao = resolverIngredientesPura(linhas, {
      produtosPorId: new Map(
        (
          await tx.produto.findMany({
            where: { id: { in: linhas.filter((l) => l.tipo === "INSUMO").map((l) => l.produtoId) } },
            select: { id: true, nome: true, unidadeMedida: true },
          })
        ).map((p) => [p.id, p])
      ),
      receitasPorId: new Map(
        (
          await tx.receita.findMany({
            where: { id: { in: linhas.filter((l) => l.tipo === "SUBRECEITA").map((l) => l.subReceitaId) } },
            select: { id: true, nome: true, unidadeId: true, rendimentoUnidade: true },
          })
        ).map((r) => [r.id, r])
      ),
      receitaAtualId: receitaId,
      unidadeId: item.unidadeId,
    });
    if (!resolucao.ok) {
      throw new Error(
        `Não deu pra salvar — corrija os ingredientes abaixo e salve de novo:\n${resolucao.erros.join("\n")}`
      );
    }
    const dadosIngredientes = resolucao.ingredientes;

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
    const indice = await carregarIndiceReceitas(item.unidadeId, tx);
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
