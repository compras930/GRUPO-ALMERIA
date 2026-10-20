// Faz as linhas que NÃO casaram entrarem, depois que o produto foi cadastrado.
//
// O BURACO QUE ISTO TAPA. A rota pula a linha repetida pela `chave` ANTES de
// tentar casar o nome (ver o filtro `itensNovos` em nota-compra.ts). Isso é
// certo para o que ele foi feito — reexecutar o workflow não pode somar
// mercadoria de novo —, mas tem uma consequência que ninguém tinha olhado:
// linha que chegou antes do produto existir fica gravada com produtoId NULO e
// com a chave ocupada. Reenviar a mesma carga depois de cadastrar o produto
// NÃO a traz de volta: ela é pulada antes de chegar perto do catálogo.
//
// Aconteceu de verdade na primeira carga do Beira Lago: 1.477 linhas,
// R$ 305 mil, presas desse jeito. O passo 4 do contrato de integração dizia
// que bastava recarregar. Estava errado, e está corrigido lá.
//
// POR QUE AQUI, E NÃO "SÓ GRAVAR A CHAVE QUANDO A LINHA CASAR". A segunda
// ideia é tentadora e é pior, por três motivos:
//
//   1. Ela faz a proteção do estoque depender de um estado MUTÁVEL (o produto
//      existia naquele instante?) em vez da identidade da linha. "Uma chave,
//      uma entrada, para sempre" vira "uma chave, uma entrada, se tiver
//      casado" — e garantia condicional não é o que se quer protegendo
//      estoque.
//   2. Ela só resolveria UMA das causas de a linha não entrar. Linha que
//      CASOU mas foi recusada por preço suspeito gravaria a chave do mesmo
//      jeito e ficaria presa igual, pela mesma razão.
//   3. Ela depende de a origem reenviar o histórico para sempre. No dia em
//      que o painel passar a mandar só a última semana — que é o normal —, as
//      linhas presas somem sem ninguém ver.
//
// POR QUE ISTO NÃO PODE SOMAR ESTOQUE EM DOBRO. Só são tocadas linhas com
// `produtoId IS NULL`, e linha sem produto NUNCA entrou em estoque: a entrada
// é somada por produto, dentro do ramo onde o produto existe (nota-compra.ts).
// Não é uma suposição sobre o passado — é o que o próprio dado afirma. Linha
// que casou já tem produtoId e fica de fora, inclusive a que casou e foi
// recusada por preço suspeito: essa não tem como ser provada aqui, então não
// se mexe nela.
import { prisma } from "@/lib/prisma";
import { idDaUnidadeFisica } from "@/lib/unidade-fisica";
import { processarNotaCompra, type ItemPrecoInput, type ResultadoNotaCompra } from "@/lib/nota-compra";

export type ResultadoReprocessamento = {
  /** Linhas sem produto encontradas na despensa (ou na nota pedida). */
  linhasSemProduto: number;
  /** Dessas, quantas foram reenviadas ao processamento. */
  linhasReenviadas: number;
  /** Puladas por não terem o que reprocessar — ver os motivos abaixo. */
  puladas: { semChave: number; semUnidade: number };
  /** O relatório da recarga. Null quando não havia nada a fazer. */
  carga: ResultadoNotaCompra | null;
};

/**
 * @param unidadeNome    nome da casa, igual ao da carga ("Beira Lago")
 * @param importadoPorId usuário a quem a nova nota é atribuída
 * @param notaCompraId   opcional: só as linhas daquela carga
 */
export async function reprocessarNaoReconhecidos(
  unidadeNome: string,
  importadoPorId: string,
  notaCompraId?: string
): Promise<ResultadoReprocessamento> {
  const unidade = await prisma.unidade.findUnique({ where: { nome: unidadeNome } });
  if (!unidade) throw new Error(`Unidade "${unidadeNome}" não encontrada.`);
  // A nota é da DESPENSA, igual em processarNotaCompra.
  const unidadeFisicaId = await idDaUnidadeFisica(unidade.id);

  const linhas = await prisma.itemNotaCompra.findMany({
    where: {
      produtoId: null,
      notaCompra: { unidadeId: unidadeFisicaId },
      ...(notaCompraId ? { notaCompraId } : {}),
    },
    select: {
      id: true,
      notaCompraId: true,
      nomeBruto: true,
      codigoBruto: true,
      unidadeBruta: true,
      // `origemBruta` NÃO é lida aqui de propósito. A coluna existe no
      // schema.prisma e na migração 20260924100000, mas o deploy roda só
      // `prisma generate` — nunca `migrate deploy` —, e aquela migração ainda
      // não foi aplicada no banco de produção. Selecionar a coluna faria esta
      // rota quebrar em produção e funcionar em todo banco de teste, que é o
      // pior tipo de erro. Ela também não faz falta: o XMenu não manda código,
      // e é só pro código que a origem serve.
      quantidade: true,
      valorTotal: true,
      chaveOrigem: true,
      precoUnitNovo: true,
      dataCompra: true,
    },
  });

  // Sem chave a linha não entra em estoque de jeito nenhum (é a trava de
  // nota-compra.ts), então reenviá-la só criaria uma segunda cópia da mesma
  // linha não reconhecida. Sem unidade não há o que casar. Nos dois casos o
  // certo é não mexer e dizer quantas foram.
  const semChave = linhas.filter((l) => !l.chaveOrigem).length;
  const semUnidade = linhas.filter((l) => l.chaveOrigem && !l.unidadeBruta).length;
  const aptas = linhas.filter((l) => l.chaveOrigem && l.unidadeBruta);

  if (aptas.length === 0) {
    return {
      linhasSemProduto: linhas.length,
      linhasReenviadas: 0,
      puladas: { semChave, semUnidade },
      carga: null,
    };
  }

  const itens: ItemPrecoInput[] = aptas.map((l) => ({
    nome: l.nomeBruto,
    unidadeMedida: l.unidadeBruta!,
    preco: l.precoUnitNovo,
    quantidade: l.quantidade ?? undefined,
    valorTotal: l.valorTotal ?? undefined,
    dataCompra: l.dataCompra.toISOString(),
    chave: l.chaveOrigem!,
    // O código volta como veio. Se a linha trazia um e ele ainda não casa, ela
    // simplesmente não casa de novo — não é aqui que se decide isso.
    ...(l.codigoBruto ? { codigo: l.codigoBruto } : {}),
  }));

  // A chave é única no banco, então a linha antiga precisa sair para a nova
  // entrar. É seguro: ela não carrega preço aplicado nem estoque — é um
  // registro de "não casou". O que ela carrega de informação está aqui em
  // memória, e volta se a recarga falhar.
  const ids = aptas.map((l) => l.id);
  await prisma.itemNotaCompra.deleteMany({ where: { id: { in: ids } } });

  try {
    const carga = await processarNotaCompra(
      unidadeNome,
      `reprocessamento de não reconhecidos${notaCompraId ? ` (${notaCompraId})` : ""}`,
      itens,
      importadoPorId,
      false
    );
    return {
      linhasSemProduto: linhas.length,
      linhasReenviadas: aptas.length,
      puladas: { semChave, semUnidade },
      carga,
    };
  } catch (e) {
    // Desfaz o apagão. Sem isto, uma falha no meio (timeout da função, erro de
    // banco) perderia o registro das linhas não reconhecidas — que é
    // justamente a lista que alguém usa pra saber o que cadastrar.
    await prisma.itemNotaCompra.createMany({
      data: aptas.map((l) => ({
        id: l.id,
        notaCompraId: l.notaCompraId,
        produtoId: null,
        nomeBruto: l.nomeBruto,
        codigoBruto: l.codigoBruto,
        unidadeBruta: l.unidadeBruta,
        quantidade: l.quantidade,
        valorTotal: l.valorTotal,
        chaveOrigem: l.chaveOrigem,
        precoUnitNovo: l.precoUnitNovo,
        precoUnitAnterior: null,
        dataCompra: l.dataCompra,
      })),
      skipDuplicates: true,
    });
    throw e;
  }
}
