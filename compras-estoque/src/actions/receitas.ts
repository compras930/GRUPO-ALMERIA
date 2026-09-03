"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { normalizarNome } from "@/lib/nome-normalizado";
import { carregarIndiceReceitas, explodirReceitaPura, CicloReceitaError } from "@/lib/receita";
import { resolverIngredientesPura, type LinhaIngredienteBruta } from "@/lib/resolucao-ingredientes";

// Mesma convenção de salvarFicha: cada linha vem identificada por id
// (produtoId/subReceitaId), nunca por nome — ver src/lib/resolucao-ingredientes.ts.
type LinhaIngredienteInput = LinhaIngredienteBruta;

/**
 * Cria ou atualiza uma "sub-receita solta" — uma Receita que existe por conta
 * própria (ex.: um molho, uma marinada, um preparo-base), sem estar ligada a
 * nenhum ItemVenda. É o complemento de salvarFicha (que só edita a receita
 * de um prato/bebida/vinho já cadastrado como item de venda): sem esta ação
 * não havia como cadastrar do zero uma sub-receita que ainda não é
 * referenciada em nenhuma ficha existente.
 *
 * `receitaId` null = cria uma nova (precisa de `unidadeId` no FormData);
 * `receitaId` preenchido = edita a receita existente (nome pode mudar, mas
 * tem que continuar único dentro da unidade).
 *
 * Como em salvarFicha, os ingredientes são identificados por id e apenas
 * validados aqui (esta action não cria Produto) — resolver insumo por nome
 * gravava o ingrediente errado quando o catálogo tem nomes homônimos. Se
 * qualquer linha não resolver, a ação falha listando todas de uma vez e nada
 * é gravado.
 */
export async function salvarSubReceita(receitaId: string | null, formData: FormData) {
  await requireAdmin();

  const novoNome = normalizarNome(String(formData.get("nome") || ""));
  if (!novoNome) throw new Error("Nome é obrigatório.");
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
  linhas = linhas.filter((l) => l.quantidade > 0);

  let unidadeId: string;
  if (receitaId) {
    const atual = await prisma.receita.findUnique({ where: { id: receitaId } });
    if (!atual) throw new Error("Sub-receita não encontrada.");
    unidadeId = atual.unidadeId;
  } else {
    unidadeId = String(formData.get("unidadeId") || "");
    if (!unidadeId) throw new Error("Selecione a unidade.");
  }

  await prisma.$transaction(async (tx) => {
    let id = receitaId;
    if (!id) {
      const existente = await tx.receita.findUnique({ where: { unidadeId_nome: { unidadeId, nome: novoNome } } });
      if (existente) throw new Error(`Já existe uma receita chamada "${novoNome}" nesta unidade.`);
      const criada = await tx.receita.create({ data: { unidadeId, nome: novoNome, modoPreparo, rendimentoQtd, rendimentoUnidade } });
      id = criada.id;
    } else {
      const outraComEsseNome = await tx.receita.findUnique({ where: { unidadeId_nome: { unidadeId, nome: novoNome } } });
      if (outraComEsseNome && outraComEsseNome.id !== id) {
        throw new Error(`Já existe uma receita chamada "${novoNome}" nesta unidade.`);
      }
      await tx.receita.update({ where: { id }, data: { nome: novoNome, modoPreparo, rendimentoQtd, rendimentoUnidade } });
    }

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
      receitaAtualId: id,
      unidadeId,
    });
    if (!resolucao.ok) {
      throw new Error(
        `Não deu pra salvar — corrija os ingredientes abaixo e salve de novo:\n${resolucao.erros.join("\n")}`
      );
    }
    const dadosIngredientes = resolucao.ingredientes;

    await tx.ingredienteReceita.deleteMany({ where: { receitaId: id } });
    for (const d of dadosIngredientes) {
      await tx.ingredienteReceita.create({ data: { receitaId: id!, ...d } });
    }

    // Mesma checagem de ciclo pós-salvamento que salvarFicha faz — desfaz tudo
    // se essa edição criar uma referência circular, em vez de deixar piorar.
    const indice = await carregarIndiceReceitas(unidadeId, tx);
    try {
      explodirReceitaPura(id!, 1, indice);
    } catch (e) {
      if (e instanceof CicloReceitaError) {
        throw new Error(
          `Essa combinação de ingredientes criaria um ciclo (uma receita citando a si mesma, direta ou indiretamente): ${e.caminho.join(" → ")}. Ajuste os ingredientes e salve de novo.`
        );
      }
      throw e;
    }
  });

  revalidatePath("/receitas");
  revalidatePath("/cmv");
}
