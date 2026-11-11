// Os pedidos da semana, das quatro casas, prontos para serem separados por
// fornecedor.
//
// É a tela de quem COMPRA, e por isso ela junta as casas em vez de separá-las:
// a mesma mensagem vai para a Alimente com os itens do Wine Garden e do
// Noroeste dentro, porque é uma entrega só. Ver o exemplo que a compra já
// manda no WhatsApp, reproduzido em src/lib/pedido-por-fornecedor.ts.
//
// SÓ O QUE AINDA NÃO FOI ENVIADO. Pedido já marcado como enviado ao fornecedor
// sai da tela: ele virou cobrança, não decisão. Rejeitado e cancelado também —
// mandar item de pedido cancelado seria comprar o que alguém recusou.

import { prisma } from "@/lib/prisma";
import { diaEmBrasiliaPura, semanaDePedidoPura } from "@/lib/regra-de-pedido";

const ABERTOS = ["RASCUNHO", "AGUARDANDO_APROVACAO", "APROVADO"];

export type ItemParaSeparar = {
  id: string;
  nome: string;
  unidade: string;
  quantidade: number;
  fornecedorId: string | null;
  casa: string;
  casaFiscal: string;
  casaCnpj: string | null;
  pedidoNumero: number;
  tipo: string;
};

export async function itensDaSemanaParaSeparar(agora = new Date()) {
  const semana = semanaDePedidoPura(diaEmBrasiliaPura(agora));

  const pedidos = await prisma.pedidoCompra.findMany({
    where: { semanaRef: semana.inicio, status: { in: ABERTOS } },
    select: {
      numero: true,
      tipo: true,
      unidade: { select: { nome: true, nomeFiscal: true, cnpj: true } },
      itens: {
        select: {
          id: true,
          quantidade: true,
          nomeBruto: true,
          unidadeBruta: true,
          fornecedorId: true,
          produto: { select: { nome: true, unidadeMedida: true } },
        },
      },
    },
    orderBy: { numero: "asc" },
  });

  const itens: ItemParaSeparar[] = pedidos.flatMap((p) =>
    p.itens.map((i) => ({
      id: i.id,
      nome: i.produto?.nome ?? i.nomeBruto ?? "(sem nome)",
      unidade: i.unidadeBruta ?? i.produto?.unidadeMedida ?? "",
      quantidade: i.quantidade,
      fornecedorId: i.fornecedorId,
      casa: p.unidade.nome,
      // O nome que o fornecedor conhece, com o curto como reserva: casa nova
      // sem nome fiscal preenchido não pode sumir da mensagem.
      casaFiscal: p.unidade.nomeFiscal ?? p.unidade.nome,
      casaCnpj: p.unidade.cnpj,
      pedidoNumero: p.numero,
      tipo: p.tipo,
    }))
  );

  return { semana, itens, pedidos: pedidos.length };
}
