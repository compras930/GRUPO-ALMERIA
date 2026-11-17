// Quem recebe cada mensagem, com que texto, e o registro de cada envio na
// linha do tempo do chamado. Falha de envio NUNCA desfaz a ação — o chamado
// anda e a tela oferece o envio manual (ver whatsapp.ts).

import { prisma } from "@/lib/prisma";
import { rotuloCategoria, URGENCIA_LABEL, type Urgencia } from "./constantes";
import { fmtTelefone } from "./regras";
import { enviarTemplate, renderizarTemplate, urlBase, whatsappConfigurado, type NomeTemplate } from "./whatsapp";

export type Destinatario = { nome: string; telefone: string };

type ChamadoParaMensagem = {
  id: string;
  numero: number;
  titulo: string;
  descricao: string;
  categoria: string;
  urgencia: string;
  prazoHoras: number | null;
  tokenAcesso: string | null;
  servicoExecutado: string | null;
  motivoRecusa: string | null;
  motivoReprovacao: string | null;
  unidade: { nome: string };
  colaborador: { nome: string; telefone: string } | null;
};

export const linkChamado = (c: { id: string }) => `${urlBase()}/manutencao/${c.id}`;
export const linkColaborador = (c: { tokenAcesso: string | null }) => `${urlBase()}/m/${c.tokenAcesso}`;

function fmtPrazo(h: number | null) {
  if (!h) return "a combinar";
  return h % 24 === 0 ? `${h / 24} dia(s)` : `${h} horas`;
}

/** Os parâmetros de cada modelo, montados num lugar só (envio e envio manual). */
export function parametros(nome: NomeTemplate, c: ChamadoParaMensagem): (string | number)[] {
  const problema = `${c.titulo}. ${c.descricao}`;
  switch (nome) {
    case "chamado_novo":
      return [
        c.numero,
        c.unidade.nome,
        rotuloCategoria(c.categoria),
        URGENCIA_LABEL[c.urgencia as Urgencia] ?? c.urgencia,
        problema,
        linkChamado(c),
      ];
    case "chamado_encaminhado":
      return [
        (c.colaborador?.nome ?? "").split(" ")[0] || "tudo bem",
        c.numero,
        c.unidade.nome,
        problema,
        fmtPrazo(c.prazoHoras),
        linkColaborador(c),
      ];
    case "chamado_para_aprovacao":
      return [c.numero, c.unidade.nome, c.colaborador?.nome ?? "colaborador", c.servicoExecutado ?? "", linkChamado(c)];
    case "chamado_reprovado":
      return [c.numero, c.unidade.nome, c.motivoReprovacao ?? "", linkColaborador(c)];
    case "chamado_recusado":
      return [c.numero, c.unidade.nome, c.motivoRecusa ?? "", linkChamado(c)];
    default:
      throw new Error(`Modelo ${nome} não é de chamado.`);
  }
}

export function textoMensagem(nome: NomeTemplate, c: ChamadoParaMensagem) {
  return renderizarTemplate(nome, parametros(nome, c));
}

/** Telefones de usuários (com login) que recebem um tipo de aviso. */
async function contatosDe(where: object): Promise<Destinatario[]> {
  const us = await prisma.usuario.findMany({
    where: { ativo: true, contatoWhatsapp: { isNot: null }, ...where },
    select: { nome: true, contatoWhatsapp: { select: { telefone: true } } },
  });
  return us.map((u) => ({ nome: u.nome, telefone: u.contatoWhatsapp!.telefone }));
}

function semRepetir(ds: Destinatario[]) {
  const vistos = new Set<string>();
  return ds.filter((d) => (vistos.has(d.telefone) ? false : (vistos.add(d.telefone), true)));
}

/** O responsável da manutenção; se ninguém com esse papel tiver WhatsApp
 *  cadastrado, os administradores — o chamado não pode cair no vazio. */
export async function destinatariosManutencao() {
  const r = await contatosDe({ papel: "MANUTENCAO" });
  return r.length ? r : contatosDe({ papel: "ADMIN" });
}

/** O responsável da loja: os gerentes da casa, e quem abriu o chamado. */
export async function destinatariosDaCasa(unidadeId: string, abertoPorId: string) {
  return semRepetir([
    ...(await contatosDe({ papel: "GERENTE", unidadeId })),
    ...(await contatosDe({ id: abertoPorId })),
  ]);
}

export async function destinatariosDoModelo(
  nome: NomeTemplate,
  c: ChamadoParaMensagem & { unidadeId: string; abertoPorId: string }
): Promise<Destinatario[]> {
  switch (nome) {
    case "chamado_novo":
      return destinatariosManutencao();
    case "chamado_encaminhado":
    case "chamado_reprovado":
      return c.colaborador ? [{ nome: c.colaborador.nome, telefone: c.colaborador.telefone }] : [];
    case "chamado_para_aprovacao":
    case "chamado_recusado":
      return destinatariosDaCasa(c.unidadeId, c.abertoPorId);
    default:
      return [];
  }
}

export const INCLUDE_MENSAGEM = {
  unidade: { select: { nome: true } },
  colaborador: { select: { nome: true, telefone: true } },
} as const;

/** Envia o modelo a todos os destinatários do chamado e registra cada envio. */
export async function notificarChamado(chamadoId: string, nome: NomeTemplate) {
  const c = await prisma.chamadoManutencao.findUnique({ where: { id: chamadoId }, include: INCLUDE_MENSAGEM });
  if (!c) return;
  const destinos = await destinatariosDoModelo(nome, c);
  if (destinos.length === 0) {
    await prisma.eventoChamado.create({
      data: {
        chamadoId,
        tipo: "WHATSAPP_FALHOU",
        descricao: `Nenhum destinatário com WhatsApp cadastrado para "${nome}".`,
      },
    });
    return;
  }
  const params = parametros(nome, c);
  // Sem a API ligada, uma linha só — e neutra: não é falha, é o modo manual.
  if (!whatsappConfigurado()) {
    await prisma.eventoChamado.create({
      data: {
        chamadoId,
        tipo: "WHATSAPP_MANUAL",
        descricao: `Aviso para ${destinos.map((d) => d.nome).join(", ")} pronto para envio manual (WhatsApp automático desligado).`,
      },
    });
    return;
  }
  for (const d of destinos) {
    const r = await enviarTemplate(d.telefone, nome, params);
    await prisma.eventoChamado.create({
      data: {
        chamadoId,
        tipo: r.ok ? "WHATSAPP_ENVIADO" : "WHATSAPP_FALHOU",
        descricao: r.ok
          ? `WhatsApp enviado para ${d.nome} (${fmtTelefone(d.telefone)}).`
          : `WhatsApp para ${d.nome} (${fmtTelefone(d.telefone)}) não saiu: ${r.motivo}`,
      },
    });
  }
}
