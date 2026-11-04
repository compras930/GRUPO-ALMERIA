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
  if (itens.length === 0) return { criados: [], recusados: [] };

  const base = itens.map((i) => ({
    unidadeId,
    tipo: "PRATO",
    categoria: null,
    nome: i.nome,
    precoVenda: i.precoVenda,
    codigoPdv: i.codigoPdv,
    ativo: true,
  }));

  // EM LOTE, NÃO UM A UM. A primeira carga de uma casa nova traz centenas de
  // itens — 355 no 104 Sul, 437 no Noroeste. Um INSERT por item, contra um
  // banco remoto, gasta o orçamento de 60 segundos da função antes de chegar
  // ao fim, e a carga morre no meio sem dizer por quê.
  //
  // `skipDuplicates` resolve o conflito de unicidade sem abortar o lote: o que
  // o banco recusar simplesmente não entra, e aparece depois em `recusados`.
  //
  // NA PRÁTICA `recusados` fica quase sempre vazio, e o motivo é sutil: o
  // único de (unidade, tipo, categoria, nome) não pega aqui, porque a
  // categoria nasce NULA e o Postgres trata NULL como distinto num índice
  // único. Dois itens de mesmo nome e códigos diferentes convivem — o que
  // está CERTO para este projeto: o código é a identidade, o nome não é. Resta
  // o único de (unidade, código), e esse não dispara porque item com código já
  // cadastrado não chega até aqui: ele teria casado na resolução.
  //
  // A lista continua existindo como rede: se um dia um desses dois índices
  // pegar, o item some do cadastro e a carga precisa dizer qual.
  try {
    await prisma.itemVenda.createMany({
      data: base.map((b) => ({ ...b, criadoAutomaticamente: true })),
      skipDuplicates: true,
    });
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== COLUNA_AUSENTE) throw e;
    // A migração ainda não foi aplicada: grava sem a marca. O item nasce
    // igual, só não fica marcado — e o relatório da carga diz quantos criou
    // de qualquer jeito.
    await prisma.itemVenda.createMany({ data: base, skipDuplicates: true });
  }

  // Quem entrou, de fato. Vale também como conferência: se o banco recusou
  // algum por unicidade, ele não aparece aqui e vira recusado.
  const codigos = itens.map((i) => i.codigoPdv);
  const gravados = await prisma.itemVenda.findMany({
    where: { unidadeId, codigoPdv: { in: codigos } },
    select: { id: true, nome: true, codigoPdv: true },
  });

  const porCodigo = new Map(gravados.map((g) => [g.codigoPdv!, g]));
  const criados: ItemCriado[] = [];
  const recusados: ResultadoCriacao["recusados"] = [];
  for (const item of itens) {
    const g = porCodigo.get(item.codigoPdv);
    if (g) criados.push({ id: g.id, nome: g.nome, codigoPdv: item.codigoPdv });
    else
      recusados.push({
        codigoPdv: item.codigoPdv,
        nome: item.nome,
        motivo: "o banco recusou a gravação — conflito de unicidade nesta casa",
      });
  }
  return { criados, recusados };
}
