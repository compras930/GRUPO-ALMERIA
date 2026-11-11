// Quantos pedidos esta casa já fez na semana — a única pergunta que a regra
// precisa fazer ao banco (ver src/lib/regra-de-pedido.ts).
//
// TOLERANTE À COLUNA QUE AINDA NÃO EXISTE. O deploy roda só
// `prisma generate`, então há sempre uma janela entre o código subir e o
// `ALTER TABLE` ser aplicado à mão no console. Nessa janela, `semanaRef` não
// existe e a consulta estouraria com P2022 — derrubando a tela de pedidos
// inteira. Aqui ela cai para a data de criação, que sempre existe: a resposta
// é a mesma, e a tela continua de pé.

import { prisma } from "@/lib/prisma";
import { casasDaCozinha } from "@/lib/unidade-fisica";
import {
  avaliarPedidoPura,
  diaEmBrasiliaPura,
  semanaDePedidoPura,
  type AvaliacaoDePedido,
} from "@/lib/regra-de-pedido";

/** Status que NÃO contam como pedido feito — ver avaliarPedidoPura. */
const NAO_CONTAM = ["CANCELADO", "REJEITADO"];

export type PedidoDaSemana = {
  id: string;
  numero: number;
  tipo: string;
  motivoExtra: string | null;
  criadoEm: Date;
};

/**
 * A SEMANA É DA DESPENSA, NÃO DA CASA.
 *
 * Noroeste e Matri são duas casas e uma despensa só — mesma cozinha, mesma
 * prateleira, mesmo fornecedor. Contar a semana por casa daria a elas DOIS
 * pedidos normais por semana para um estoque só, e a diretriz ("um por
 * semana") viraria letra morta justamente onde o gasto é maior.
 *
 * Ver src/lib/unidade-fisica.ts. Para as outras três casas isto não muda nada:
 * cada uma é a própria despensa.
 */
export async function pedidosDaSemana(
  unidadeId: string,
  agora = new Date()
): Promise<{ hoje: string; semana: ReturnType<typeof semanaDePedidoPura>; pedidos: PedidoDaSemana[] }> {
  const hoje = diaEmBrasiliaPura(agora);
  const semana = semanaDePedidoPura(hoje);
  const inicio = new Date(`${semana.inicio}T03:00:00.000Z`); // 00h de Brasília
  const fim = new Date(`${semana.fim}T03:00:00.000Z`);
  fim.setUTCDate(fim.getUTCDate() + 1);

  const daCozinha = await casasDaCozinha(unidadeId);

  try {
    const pedidos = await prisma.pedidoCompra.findMany({
      where: { unidadeId: { in: daCozinha }, semanaRef: semana.inicio, status: { notIn: NAO_CONTAM } },
      select: { id: true, numero: true, tipo: true, motivoExtra: true, criadoEm: true },
      orderBy: { numero: "asc" },
    });
    return { hoje, semana, pedidos };
  } catch {
    const antigos = await prisma.pedidoCompra.findMany({
      where: { unidadeId: { in: daCozinha }, criadoEm: { gte: inicio, lt: fim }, status: { notIn: NAO_CONTAM } },
      select: { id: true, numero: true, criadoEm: true },
      orderBy: { numero: "asc" },
    });
    return {
      hoje,
      semana,
      pedidos: antigos.map((p) => ({ ...p, tipo: "NORMAL", motivoExtra: null })),
    };
  }
}

/** O que a tela e a ação precisam saber antes de deixar criar o pedido. */
export async function avaliarPedidoDaCasa(
  unidadeId: string,
  entrada: { motivo?: string | null; detalhe?: string | null } = {},
  agora = new Date()
): Promise<AvaliacaoDePedido & { pedidos: PedidoDaSemana[] }> {
  const { hoje, pedidos } = await pedidosDaSemana(unidadeId, agora);
  return {
    ...avaliarPedidoPura({ hoje, jaFeitosNaSemana: pedidos.length, ...entrada }),
    pedidos,
  };
}
