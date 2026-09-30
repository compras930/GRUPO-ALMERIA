"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { normalizarNome } from "@/lib/nome-normalizado";
import { casasDaCozinha } from "@/lib/unidade-fisica";
import { TIPO_ITEM_VENDA, type TipoItemVenda } from "@/lib/constants";
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
  // Vazio grava null (e não ""), senão dois itens "sem código" colidiriam no
  // índice único (unidadeId, codigoPdv) — NULL é distinto, "" não é.
  const novoCodigoPdv = String(formData.get("codigoPdv") || "").trim() || null;
  const modoPreparo = String(formData.get("modoPreparo") || "").trim() || null;
  const rendimentoQtdRaw = formData.get("rendimentoQtd");
  const rendimentoQtd = rendimentoQtdRaw ? Number(rendimentoQtdRaw) || null : null;
  const rendimentoUnidade = normalizarNome(String(formData.get("rendimentoUnidade") || "")) || null;

  // O código é único por casa. Sem esta checagem, digitar um código que já é de
  // outro prato estoura o índice único e a tela mostra o erro cru do Postgres.
  if (novoCodigoPdv) {
    const jaUsado = await prisma.itemVenda.findFirst({
      where: { unidadeId: item.unidadeId, codigoPdv: novoCodigoPdv, NOT: { id: itemVendaId } },
      select: { nome: true },
    });
    if (jaUsado) {
      throw new Error(
        `O código de PDV "${novoCodigoPdv}" já está cadastrado em "${jaUsado.nome}" nesta casa. Cada código pertence a um item só.`
      );
    }
  }

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
      unidadesPermitidas: await casasDaCozinha(item.unidadeId, tx),
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
      data: { nome: novoNome, categoria: novaCategoria, precoVenda: novoPrecoVenda, codigoPdv: novoCodigoPdv, receitaId },
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

/**
 * Cadastra um prato/bebida/vinho novo no cardápio de uma casa.
 *
 * Nasce SEM ficha técnica, de propósito: o item aparece na lista como "sem
 * ficha" e alguém monta a receita depois. Criar as duas coisas de uma vez
 * obrigaria a escolher ingredientes antes de o prato existir, e é comum o
 * cardápio entrar antes de a ficha estar fechada.
 *
 * O dedupe é CASE-INSENSITIVE, ao contrário da constraint do banco
 * (`@@unique([unidadeId, tipo, categoria, nome])`, que compara byte a byte em
 * Postgres). Sem isto, "Filé au Poivre" e "FILE AU POIVRE" viram dois itens de
 * cardápio e a venda semanal passa a casar ora com um, ora com outro — é o
 * mesmo buraco que criou "BURRATA"/"Burrata" no catálogo de insumos.
 *
 * Item INATIVO com o mesmo nome não é duplicata: é prato que já saiu e está
 * voltando. Aí a mensagem manda reativar em vez de criar, porque criar um
 * segundo registro perderia o histórico de venda do primeiro.
 *
 * Termina em `redirect` pra tela da ficha. Quem chama tem que deixar o
 * NEXT_REDIRECT passar — ver FormNovoItemVenda.
 */
export async function criarItemVenda(formData: FormData) {
  await requireAdmin();

  const unidadeId = String(formData.get("unidadeId") || "");
  const tipo = String(formData.get("tipo") || "");
  const nome = normalizarNome(String(formData.get("nome") || ""));
  const categoria = normalizarNome(String(formData.get("categoria") || "")) || null;
  const codigoPdv = normalizarNome(String(formData.get("codigoPdv") || "")) || null;
  // A planilha e o teclado brasileiro mandam vírgula; Number("28,90") é NaN.
  const precoVenda = Number(String(formData.get("precoVenda") || "").trim().replace(",", "."));

  if (!nome) throw new Error("Informe o nome do item.");
  if (!TIPO_ITEM_VENDA.includes(tipo as TipoItemVenda)) throw new Error(`Tipo inválido: "${tipo}".`);
  if (!Number.isFinite(precoVenda) || precoVenda <= 0) {
    throw new Error("Informe um preço de venda maior que zero.");
  }
  const unidade = await prisma.unidade.findUnique({ where: { id: unidadeId } });
  if (!unidade) throw new Error("Unidade inválida.");

  const existente = await prisma.itemVenda.findFirst({
    where: { unidadeId, tipo, categoria, nome: { equals: nome, mode: "insensitive" } },
  });
  if (existente) {
    throw new Error(
      existente.ativo
        ? `"${existente.nome}" já está no cardápio de ${unidade.nome} nessa categoria. Abra o item para editar em vez de criar outro.`
        : `"${existente.nome}" já existe em ${unidade.nome}, fora do cardápio. Use "Voltar ao cardápio" na lista de itens inativos — criar de novo perderia o histórico de venda dele.`
    );
  }

  // codigoPdv é único POR CASA. Dois itens com o mesmo código fariam a venda
  // semanal casar no errado, e o banco recusaria com um erro cru.
  if (codigoPdv) {
    const dono = await prisma.itemVenda.findFirst({ where: { unidadeId, codigoPdv } });
    if (dono) {
      throw new Error(`O código ${codigoPdv} já é de "${dono.nome}" em ${unidade.nome}.`);
    }
  }

  const item = await prisma.itemVenda.create({
    data: { unidadeId, tipo, categoria, nome, precoVenda, codigoPdv },
  });
  revalidatePath("/cmv");

  // Vai direto pra ficha: prato sem ficha é prato sem custo, e a lista já o
  // mostraria como "sem ficha". Levar pra lá é o passo seguinte de qualquer
  // jeito. (Veio da implementação paralela em db1d6eb, e é melhor que voltar
  // pra lista, que era o que esta função fazia antes.)
  redirect(`/cmv/${item.id}`);
}

/**
 * Tira do cardápio, ou devolve.
 *
 * É `ativo = false`, não DELETE. Prato que saiu do cardápio continua tendo
 * venda registrada nas semanas em que existiu, e é dela que sai o consumo
 * histórico e o CMV do período. Apagar o item apagaria o passado junto — a
 * pergunta "quanto vendemos de picanha em agosto" deixaria de ter resposta.
 */
export async function alternarItemVenda(id: string, ativo: boolean) {
  await requireAdmin();
  await prisma.itemVenda.update({ where: { id }, data: { ativo } });
  revalidatePath("/cmv");
}

/**
 * Apaga de vez — só o que nunca vendeu.
 *
 * Existe para o item cadastrado errado (nome trocado, casa errada, duplicata),
 * onde desativar deixaria lixo na tela para sempre. Com uma semana de venda
 * sequer, recusa e manda desativar: a diferença entre "nunca existiu" e "saiu
 * do cardápio" é justamente o que o histórico guarda.
 */
export async function excluirItemVenda(id: string) {
  await requireAdmin();

  const item = await prisma.itemVenda.findUnique({
    where: { id },
    include: { _count: { select: { itensVendaSemanal: true } } },
  });
  if (!item) throw new Error("Item não encontrado.");

  if (item._count.itensVendaSemanal > 0) {
    throw new Error(
      `"${item.nome}" tem ${item._count.itensVendaSemanal} semana(s) de venda registradas — apagar levaria o histórico junto. Use "Tirar do cardápio".`
    );
  }

  // A Receita não é apagada junto: ela pode ser sub-receita de outra ficha, e
  // um DELETE em cascata aqui quebraria o custo de quem a usa. Ela fica
  // visível e editável em /receitas.
  await prisma.itemVenda.delete({ where: { id } });
  revalidatePath("/cmv");
}
