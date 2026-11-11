// Apagar uma carga de venda já gravada, para que ela possa ser recarregada.
//
// POR QUE EXISTE. A identidade de uma carga de venda é o PERÍODO, e a rota
// recusa qualquer período que se sobreponha a um já carregado (ver
// src/lib/periodo-venda.ts). É a trava que impede somar a mesma venda duas
// vezes e baixar o mesmo estoque duas vezes — e ela tem que continuar lá.
//
// Mas a carga DIÁRIA precisa reenviar o mesmo dia: o dia de hoje ainda está
// aberto às 14h e fechado às 23h. Sem um jeito de substituir, o segundo envio
// bate em 409 e o número do painel congela na primeira rodada do dia.
//
// DESFAZER É O OPOSTO EXATO DE GRAVAR, e nada além disso:
//
//   - devolve ao saldo exatamente o que os movimentos daquela carga tiraram
//     (lendo os movimentos gravados, não recalculando o consumo: recalcular
//     usaria a ficha técnica de HOJE, que pode ter mudado desde a carga, e
//     devolveria uma quantidade que nunca foi tirada);
//   - apaga esses movimentos;
//   - apaga o rascunho de pedido que a carga gerou;
//   - apaga a VendaSemanal, e as linhas vão junto por cascade.
//
// RECUSA EM DOIS CASOS, e os dois são o mesmo medo — mexer no saldo por cima
// de uma informação mais nova que a carga:
//
//   1. PERÍODO QUE NÃO BATE EXATO. Se o que está gravado é a semana inteira e
//      o reenvio é de um dia, apagar a semana para gravar um dia apagaria seis
//      dias de venda sem ninguém pedir.
//   2. CONTAGEM DEPOIS DA CARGA. A contagem SOBRESCREVE o saldo; a venda só o
//      decrementa. Devolver ao saldo o consumo de uma carga que a contagem já
//      liquidou inflaria o estoque — e inflar estoque calado é exatamente o
//      erro que o inventário existe para pegar.

import { prisma } from "@/lib/prisma";
import { idDaUnidadeFisica } from "@/lib/unidade-fisica";
import { emOrdemDeBloqueio } from "@/lib/ordem-de-bloqueio";
import { comRetentativaDeConflito } from "@/lib/transacao";

export class SubstituicaoRecusadaError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "SubstituicaoRecusadaError";
  }
}

export type ResultadoSubstituicao = {
  removeu: boolean;
  vendaSemanalId: string | null;
  linhasRemovidas: number;
  movimentosRevertidos: number;
  quantidadeDevolvida: number;
  rascunhosRemovidos: number;
};

const VAZIO: ResultadoSubstituicao = {
  removeu: false,
  vendaSemanalId: null,
  linhasRemovidas: 0,
  movimentosRevertidos: 0,
  quantidadeDevolvida: 0,
  rascunhosRemovidos: 0,
};

const dia = (d: Date) => d.toISOString().slice(0, 10);

export async function removerCargaDeVenda(
  unidadeNome: string,
  periodoInicioStr: string,
  periodoFimStr: string
): Promise<ResultadoSubstituicao> {
  const unidade = await prisma.unidade.findUnique({ where: { nome: unidadeNome } });
  if (!unidade) throw new Error(`Unidade "${unidadeNome}" não encontrada.`);
  const unidadeFisicaId = await idDaUnidadeFisica(unidade.id);

  const periodoInicio = new Date(periodoInicioStr);
  const periodoFim = new Date(periodoFimStr);

  // Mesma busca por SOBREPOSIÇÃO que a trava usa — e não por período exato.
  // Procurar exato aqui deixaria passar o caso perigoso: uma carga de semana
  // encoberta, a substituição não a acharia, a gravação seguinte bateria no
  // 409 e o diagnóstico seria "o app recusa sem motivo".
  const existentes = await prisma.vendaSemanal.findMany({
    where: {
      unidadeId: unidade.id,
      periodoInicio: { lte: periodoFim },
      periodoFim: { gte: periodoInicio },
    },
    select: { id: true, periodoInicio: true, periodoFim: true, criadoEm: true },
    orderBy: { periodoInicio: "asc" },
  });

  if (existentes.length === 0) return VAZIO;

  if (existentes.length > 1) {
    throw new SubstituicaoRecusadaError(
      `O período ${dia(periodoInicio)} a ${dia(periodoFim)} de ${unidadeNome} encosta em ${existentes.length} cargas já gravadas. Substituir apagaria todas elas — recarregue uma de cada vez.`
    );
  }

  const alvo = existentes[0];
  const mesmoPeriodo =
    alvo.periodoInicio.getTime() === periodoInicio.getTime() &&
    alvo.periodoFim.getTime() === periodoFim.getTime();
  if (!mesmoPeriodo) {
    throw new SubstituicaoRecusadaError(
      `Em ${unidadeNome} já existe a carga de ${dia(alvo.periodoInicio)} a ${dia(alvo.periodoFim)}, que não é o mesmo período de ${dia(periodoInicio)} a ${dia(periodoFim)}. Substituir apagaria venda que este envio não traz.`
    );
  }

  // A contagem sobrescreve o saldo; devolver consumo por cima dela infla o
  // estoque. Só olha a despensa, que é onde o saldo vive.
  const contagemDepois = await prisma.contagemEstoque.findFirst({
    where: { unidadeId: unidadeFisicaId, criadoEm: { gt: alvo.criadoEm } },
    select: { criadoEm: true },
    orderBy: { criadoEm: "desc" },
  });
  if (contagemDepois) {
    throw new SubstituicaoRecusadaError(
      `Houve contagem de estoque em ${unidadeNome} depois desta carga (${contagemDepois.criadoEm.toISOString().slice(0, 16).replace("T", " ")}). A contagem já corrigiu o saldo — devolver o consumo desta carga inflaria o estoque. Recarregue sem substituir, num período que ainda não existe.`
    );
  }

  const movimentos = await prisma.movimentoEstoque.findMany({
    where: { unidadeId: unidadeFisicaId, referencia: alvo.id },
    select: { id: true, produtoId: true, quantidade: true },
  });

  // Mesmo produto pode ter mais de um movimento; soma antes de devolver.
  const porProduto = new Map<string, number>();
  for (const m of movimentos) {
    porProduto.set(m.produtoId, (porProduto.get(m.produtoId) ?? 0) + m.quantidade);
  }

  const observacaoDoRascunho = `Gerado automaticamente a partir da venda semanal de ${periodoInicioStr} a ${periodoFimStr}.`;

  return await comRetentativaDeConflito(() =>
    prisma.$transaction(
      async (tx) => {
        // Ordem estável de id — ver src/lib/ordem-de-bloqueio.ts.
        for (const [produtoId, quantidade] of emOrdemDeBloqueio(porProduto)) {
          if (quantidade === 0) continue;
          // A quantidade gravada é negativa (saída). Devolver é somar o
          // oposto; `increment` com o valor negado faz exatamente isso.
          await tx.estoqueSaldo.upsert({
            where: { unidadeId_produtoId: { unidadeId: unidadeFisicaId, produtoId } },
            update: { quantidade: { increment: -quantidade } },
            create: { unidadeId: unidadeFisicaId, produtoId, quantidade: -quantidade },
          });
        }

        await tx.movimentoEstoque.deleteMany({
          where: { unidadeId: unidadeFisicaId, referencia: alvo.id },
        });

        // O rascunho que a carga gerou não tem ligação de banco com ela — é
        // casado pela observação, que a gravação escreve com as mesmas datas
        // deste envio. Se o texto não bater (formato de data diferente, por
        // exemplo), o rascunho FICA: rascunho a mais é ruído, rascunho de
        // outra carga apagado é venda perdida.
        const rascunhos = await tx.pedidoCompra.deleteMany({
          where: {
            unidadeId: unidadeFisicaId,
            status: "RASCUNHO",
            observacao: observacaoDoRascunho,
          },
        });

        const linhas = await tx.itemVendaSemanal.count({ where: { vendaSemanalId: alvo.id } });
        await tx.vendaSemanal.delete({ where: { id: alvo.id } });

        return {
          removeu: true,
          vendaSemanalId: alvo.id,
          linhasRemovidas: linhas,
          movimentosRevertidos: movimentos.length,
          quantidadeDevolvida: [...porProduto.values()].reduce((s, q) => s - q, 0),
          rascunhosRemovidos: rascunhos.count,
        };
      },
      { timeout: 60_000 }
    )
  );
}
