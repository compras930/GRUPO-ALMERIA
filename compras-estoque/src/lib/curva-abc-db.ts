// Carrega o que a curva ABC da contagem precisa: a compra da janela e a
// classificação que está gravada hoje.
//
// A JANELA SÃO 3 MESES: o corrente e os dois anteriores, inteiros. Ver a
// escolha explicada em src/lib/curva-abc-aplicar.ts.
//
// A COMPRA É DA DESPENSA, a classificação também — as duas seguem a unidade
// física, não a casa (src/lib/unidade-fisica.ts). Quem chama já resolve isso.
import { prisma } from "@/lib/prisma";
import { ultimosMeses } from "@/lib/mes";
import { curvaAbcPura } from "@/lib/curva-abc";
import type { ClassificacaoAtual, ClassificacaoNova } from "@/lib/curva-abc-aplicar";

export const MESES_DA_JANELA = 3;

export type CurvaDaJanela = {
  novas: ClassificacaoNova[];
  atuais: ClassificacaoAtual[];
  /** A casa conta a curva A inteira toda semana (grupo zero). */
  grupoZero: boolean;
  de: Date;
  ate: Date;
  /** Quanto a casa comprou na janela, só do que casou com produto. */
  totalComprado: number;
  linhas: number;
};

export async function carregarCurvaDaJanela(despensaId: string, hoje = new Date()): Promise<CurvaDaJanela> {
  const meses = ultimosMeses(hoje, MESES_DA_JANELA);
  const de = meses[meses.length - 1].inicio;
  const ate = meses[0].fim;

  const [compras, parametros] = await Promise.all([
    prisma.itemNotaCompra.findMany({
      where: { dataCompra: { gte: de, lt: ate }, notaCompra: { unidadeId: despensaId } },
      select: {
        valorTotal: true,
        quantidade: true,
        precoUnitNovo: true,
        produto: { select: { id: true, nome: true, unidadeMedida: true, categoria: true } },
      },
    }),
    prisma.parametroEstoqueProduto.findMany({
      where: { unidadeId: despensaId },
      select: { produtoId: true, classeAbc: true, grupoContagem: true },
    }),
  ]);

  // LINHA SEM PRODUTO FICA DE FORA, e isto é diferente do painel.
  //
  // O painel mostra DINHEIRO GASTO, então linha não reconhecida entra lá como
  // "sem categoria": ela foi paga. Aqui a pergunta é outra — "o que a cozinha
  // deve contar na prateleira" —, e não dá para contar um produto que não
  // existe no cadastro. Ele aparece no painel como cadastro a fazer, que é
  // onde ele pode ser resolvido.
  const porProduto = new Map<string, number>();
  let totalComprado = 0;
  for (const l of compras) {
    if (!l.produto) continue;
    const valor = l.valorTotal ?? (l.quantidade === null ? 0 : l.quantidade * l.precoUnitNovo);
    porProduto.set(l.produto.id, (porProduto.get(l.produto.id) ?? 0) + valor);
    totalComprado += valor;
  }

  const classificados = curvaAbcPura(
    [...porProduto].map(([id, valor]) => ({ id, nome: id, unidadeMedida: "", categoria: null, valor }))
  );

  return {
    novas: classificados.map((c) => ({ produtoId: c.id, classe: c.classe, valor: c.valor })),
    atuais: parametros.map((p) => ({
      produtoId: p.produtoId,
      classeAbc: p.classeAbc,
      grupoContagem: p.grupoContagem,
    })),
    // Como a casa conta hoje. Preservar a convenção dela importa: trocar o
    // Beira Lago de "toda semana" para rodízio quinzenal, sem ninguém pedir,
    // mudaria o CMV de semanal para quinzenal — e a casa escolheu semanal.
    grupoZero: parametros.some((p) => p.classeAbc === "A" && p.grupoContagem === 0),
    de,
    ate,
    totalComprado,
    linhas: compras.length,
  };
}
