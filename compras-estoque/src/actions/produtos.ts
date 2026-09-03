"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { normalizarNome } from "@/lib/nome-normalizado";
import { UNIDADES_MEDIDA } from "@/lib/constants";

export async function criarProduto(formData: FormData) {
  await requireAdmin();
  const nome = String(formData.get("nome") || "").trim();
  const unidadeMedida = String(formData.get("unidadeMedida") || "").trim();
  if (!nome || !unidadeMedida) throw new Error("Informe nome e unidade de medida.");

  await prisma.produto.create({
    data: {
      nome,
      unidadeMedida,
      categoria: String(formData.get("categoria") || "").trim() || null,
    },
  });
  revalidatePath("/produtos");
}

export async function alternarProduto(id: string, ativo: boolean) {
  await requireAdmin();
  await prisma.produto.update({ where: { id }, data: { ativo } });
  revalidatePath("/produtos");
}

/**
 * Cadastra um produto a partir da tela de ficha técnica (ação explícita do
 * usuário no seletor de ingrediente), devolvendo o id pra linha já ficar
 * resolvida.
 *
 * Existe separada de `criarProduto` (que serve o formulário de /produtos e não
 * precisa devolver nada) por dois motivos:
 *
 * 1. Precisa RETORNAR o produto — uma Server Action usada como `action=` de um
 *    <form> não devolve valor pro client; aqui ela é chamada como função async
 *    normal.
 * 2. Faz dedupe CASE-INSENSITIVE antes de criar. Salvar ficha antes resolvia
 *    insumo por nome com `produto.upsert`, o que criava uma variante nova
 *    sempre que alguém digitava o mesmo nome com outra grafia — foi assim que
 *    produção ficou com "BURRATA" e "Burrata", as duas em KG, e com isso
 *    qualquer resolução por nome virou ambígua. `mode: "insensitive"` roda
 *    nativo no Postgres (ILIKE), sem precisar de citext.
 *
 * O dedupe é escopado pela mesma unidadeMedida de propósito: "BURRATA"/KG e
 * "BURRATA"/UND são itens de catálogo legitimamente diferentes.
 *
 * Quando o produto já existia, devolve `jaExistia: true` em vez de falhar — a
 * tela avisa que reaproveitou o cadastro existente. Nunca silencioso, nunca
 * duplicando.
 */
export async function criarProdutoInline(nomeBruto: string, unidadeMedida: string) {
  await requireAdmin();
  const nome = normalizarNome(nomeBruto);
  if (!nome) throw new Error("Informe o nome do produto.");
  if (!UNIDADES_MEDIDA.includes(unidadeMedida as (typeof UNIDADES_MEDIDA)[number])) {
    throw new Error(`Unidade de medida inválida: "${unidadeMedida}".`);
  }

  const existente = await prisma.produto.findFirst({
    where: { unidadeMedida, nome: { equals: nome, mode: "insensitive" } },
  });
  if (existente) {
    return {
      id: existente.id,
      nome: existente.nome,
      unidadeMedida: existente.unidadeMedida,
      jaExistia: true as const,
    };
  }

  const criado = await prisma.produto.create({ data: { nome, unidadeMedida } });
  revalidatePath("/produtos");
  return { id: criado.id, nome: criado.nome, unidadeMedida: criado.unidadeMedida, jaExistia: false as const };
}
