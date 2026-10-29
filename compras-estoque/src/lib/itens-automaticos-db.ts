// Grava os itens de venda que a carga criou sozinha.
//
// TOLERA A COLUNA QUE AINDA NÃO EXISTE. O deploy roda só `prisma generate`; as
// migrações vão à mão pelo console. Então existe sempre uma janela em que o
// código já sabe de `criadoAutomaticamente` e o banco não — e nessa janela um
// INSERT que cite a coluna derruba a carga inteira com P2022.
//
// Em 23/10 essa janela derrubou a folha de contagem na véspera da primeira
// contagem. Aqui o preço seria mais alto: a carga de venda é o que alimenta o
// faturamento.
//
// Por isso o INSERT tenta com a marca e, se o banco recusar por não conhecer a
// coluna, repete sem ela. O item nasce igual; só não fica marcado — e o
// relatório da carga diz quantos criou de qualquer jeito.
//
// CRIA UM A UM, de propósito. `createMany` abortaria o lote inteiro no
// primeiro conflito de unicidade, e conflito aqui é esperado: o mesmo nome
// pode já existir com outra categoria, e duas casas podem repetir o código.
// Um a um, o que colide é relatado e o resto entra.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ItemAutomatico } from "@/lib/itens-automaticos";

/** Falta a coluna no banco (migração ainda não aplicada). */
const COLUNA_AUSENTE = "P2022";
/** Violação de índice único. */
const JA_EXISTE = "P2002";

export type ItemCriado = { id: string; codigoPdv: string; nome: string };
export type ResultadoCriacao = {
  criados: ItemCriado[];
  /** Código que não virou item, com o motivo. */
  recusados: { codigoPdv: string; nome: string; motivo: string }[];
};

export async function criarItensAutomaticos(
  unidadeId: string,
  itens: ItemAutomatico[]
): Promise<ResultadoCriacao> {
  const criados: ItemCriado[] = [];
  const recusados: ResultadoCriacao["recusados"] = [];

  for (const item of itens) {
    const base = {
      unidadeId,
      tipo: "PRATO",
      categoria: null,
      nome: item.nome,
      precoVenda: item.precoVenda,
      codigoPdv: item.codigoPdv,
      ativo: true,
    };
    try {
      const criado = await prisma.itemVenda.create({
        data: { ...base, criadoAutomaticamente: true },
        select: { id: true, nome: true, codigoPdv: true },
      });
      criados.push({ id: criado.id, nome: criado.nome, codigoPdv: item.codigoPdv });
      continue;
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError)) throw e;
      if (e.code === JA_EXISTE) {
        recusados.push({
          codigoPdv: item.codigoPdv,
          nome: item.nome,
          motivo: "já existe um item com esse nome ou com esse código nesta casa",
        });
        continue;
      }
      if (e.code !== COLUNA_AUSENTE) throw e;
    }

    // Segunda tentativa, sem a marca: a migração ainda não foi aplicada.
    try {
      const criado = await prisma.itemVenda.create({
        data: base,
        select: { id: true, nome: true, codigoPdv: true },
      });
      criados.push({ id: criado.id, nome: criado.nome, codigoPdv: item.codigoPdv });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === JA_EXISTE) {
        recusados.push({
          codigoPdv: item.codigoPdv,
          nome: item.nome,
          motivo: "já existe um item com esse nome ou com esse código nesta casa",
        });
        continue;
      }
      throw e;
    }
  }

  return { criados, recusados };
}
