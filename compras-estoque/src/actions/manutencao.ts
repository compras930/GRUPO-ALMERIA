"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import {
  podeAprovarServico,
  podeGerenciarManutencao,
  podeTriarChamado,
  unidadeVisivel,
  veTodosOsChamados,
} from "@/lib/permissions";
import {
  CATEGORIAS_MANUTENCAO,
  MAX_BYTES_FOTO,
  MAX_FOTOS_POR_ENVIO,
  MIMES_FOTO,
  STATUS_CHAMADO_LABEL,
  URGENCIAS,
  type EtapaFoto,
  type StatusChamado,
} from "@/lib/manutencao/constantes";
import { calcularPrazoFinal, chaveTexto, normalizarTelefone, possiveisDuplicados } from "@/lib/manutencao/regras";
import { notificarChamado } from "@/lib/manutencao/notificar";
import type { NomeTemplate } from "@/lib/manutencao/whatsapp";

type Usuario = Awaited<ReturnType<typeof requireSession>>;

/**
 * ERRO QUE A PESSOA PRECISA LER — "marque uma categoria", "WhatsApp inválido".
 *
 * Em produção o Next.js troca a mensagem de qualquer erro LANÇADO por uma
 * server action por um texto genérico em inglês ("An error occurred in the
 * Server Components render…"). Para a mensagem chegar à tela, ela tem que
 * VOLTAR como valor: as ações exportadas abaixo devolvem `{ erro }` em vez de
 * lançar. Erro de verdade (banco fora, bug) continua genérico — e vai pro log.
 */
class ErroUsuario extends Error {}

async function comErro<T>(f: () => Promise<T>): Promise<T | { erro: string }> {
  try {
    return await f();
  } catch (e: any) {
    if (e instanceof ErroUsuario) return { erro: e.message };
    // redirect()/notFound() do Next viajam como exceção — têm que seguir.
    if (typeof e?.digest === "string" && e.digest.startsWith("NEXT_")) throw e;
    console.error("Manutenção: erro inesperado.", e);
    return { erro: "Não foi possível salvar agora. Tente de novo; se continuar, avise o administrador." };
  }
}


function texto(fd: FormData, campo: string, max = 2000) {
  return String(fd.get(campo) ?? "").trim().slice(0, max);
}

function revalidar(id?: string) {
  revalidatePath("/manutencao");
  if (id) revalidatePath(`/manutencao/${id}`);
}

async function fotosDoForm(fd: FormData): Promise<{ mime: string; dados: Buffer }[]> {
  const arquivos = fd.getAll("fotos").filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f && f.size > 0);
  if (arquivos.length > MAX_FOTOS_POR_ENVIO) throw new ErroUsuario(`Envie no máximo ${MAX_FOTOS_POR_ENVIO} fotos.`);
  const out = [];
  for (const f of arquivos) {
    if (!(MIMES_FOTO as readonly string[]).includes(f.type)) throw new ErroUsuario("Foto em formato não aceito (use JPG ou PNG).");
    if (f.size > MAX_BYTES_FOTO) throw new ErroUsuario("Foto grande demais. Tente de novo — o app reduz a foto antes de enviar.");
    out.push({ mime: f.type, dados: Buffer.from(await f.arrayBuffer()) });
  }
  return out;
}

async function evento(chamadoId: string, tipo: string, descricao: string, autor?: string | null) {
  await prisma.eventoChamado.create({ data: { chamadoId, tipo, descricao, autor: autor ?? null } });
}

/** Muda o status SÓ se ele ainda for um dos esperados — dois cliques, duas
 *  abas ou duas pessoas não fazem a mesma transição duas vezes. */
async function transicionar(id: string, de: StatusChamado[], data: Record<string, unknown>) {
  const r = await prisma.chamadoManutencao.updateMany({ where: { id, status: { in: de } }, data });
  if (r.count === 0) {
    const atual = await prisma.chamadoManutencao.findUnique({ where: { id }, select: { status: true } });
    const label = atual ? STATUS_CHAMADO_LABEL[atual.status as StatusChamado] ?? atual.status : "inexistente";
    throw new ErroUsuario(`Este chamado mudou enquanto a tela estava aberta (agora: ${label}). Recarregue a página.`);
  }
}

async function chamadoVisivel(id: string, user: Usuario) {
  const c = await prisma.chamadoManutencao.findUnique({ where: { id } });
  if (!c) throw new ErroUsuario("Chamado não encontrado.");
  if (!veTodosOsChamados(user.papel) && !unidadeVisivel(user.papel, user.unidadeId ?? null, c.unidadeId)) {
    throw new ErroUsuario("Este chamado é de outra casa.");
  }
  return c;
}

// ---------------------------------------------------------------------------
// Casa: abrir e cancelar
// ---------------------------------------------------------------------------

export type ResultadoAbertura =
  | { ok: true; id: string; numero: number }
  | { ok: false; duplicados: { id: string; numero: number; titulo: string; status: string }[] };

async function abrirChamadoImpl(fd: FormData): Promise<ResultadoAbertura> {
  const user = await requireSession();
  const unidadeId = veTodosOsChamados(user.papel) ? texto(fd, "unidadeId", 100) : user.unidadeId;
  if (!unidadeId) throw new ErroUsuario("Escolha a casa do chamado.");
  const categoria = texto(fd, "categoria", 50);
  const urgencia = texto(fd, "urgencia", 20);
  const titulo = texto(fd, "titulo", 120);
  const descricao = texto(fd, "descricao", 2000);
  const local = texto(fd, "local", 120) || null;
  if (!(CATEGORIAS_MANUTENCAO as readonly string[]).includes(categoria)) throw new ErroUsuario("Escolha a categoria.");
  if (!(URGENCIAS as readonly string[]).includes(urgencia)) throw new ErroUsuario("Escolha a urgência.");
  if (!titulo) throw new ErroUsuario("Diga em poucas palavras qual é o problema.");
  if (!descricao) throw new ErroUsuario("Descreva o problema.");
  const fotos = await fotosDoForm(fd);
  const localChave = chaveTexto(local);

  if (fd.get("confirmarMesmoAssim") !== "1") {
    const abertos = await prisma.chamadoManutencao.findMany({
      where: { unidadeId, categoria, status: { in: ["ABERTO", "ENCAMINHADO", "EM_ANDAMENTO", "AGUARDANDO_APROVACAO"] } },
      select: { id: true, numero: true, unidadeId: true, categoria: true, titulo: true, descricao: true, localChave: true, status: true },
    });
    const dup = possiveisDuplicados({ unidadeId, categoria, titulo, descricao, localChave }, abertos);
    if (dup.length) {
      return { ok: false, duplicados: dup.map((d) => ({ id: d.id, numero: d.numero, titulo: d.titulo, status: d.status })) };
    }
  }

  const c = await prisma.chamadoManutencao.create({
    data: {
      unidadeId,
      abertoPorId: user.id,
      categoria,
      urgencia,
      titulo,
      descricao,
      local,
      localChave,
      fotos: { create: fotos.map((f) => ({ ...f, etapa: "ABERTURA" satisfies EtapaFoto })) },
      eventos: { create: { tipo: "ABERTO", descricao: "Chamado aberto.", autor: user.name ?? null } },
    },
  });
  await notificarChamado(c.id, "chamado_novo");
  revalidar(c.id);
  return { ok: true, id: c.id, numero: c.numero };
}

async function cancelarChamadoImpl(id: string) {
  const user = await requireSession();
  const c = await chamadoVisivel(id, user);
  if (c.abertoPorId !== user.id && user.papel !== "ADMIN") throw new ErroUsuario("Só quem abriu pode cancelar.");
  await transicionar(id, ["ABERTO"], { status: "CANCELADO" });
  await evento(id, "CANCELADO", "Chamado cancelado por quem abriu.", user.name);
  revalidar(id);
}

// ---------------------------------------------------------------------------
// Responsável da manutenção: triagem
// ---------------------------------------------------------------------------

async function encaminharChamadoImpl(id: string, fd: FormData) {
  const user = await requireSession();
  if (!podeTriarChamado(user.papel)) throw new ErroUsuario("Só o responsável da manutenção encaminha chamados.");
  const c = await chamadoVisivel(id, user);
  const colaboradorId = texto(fd, "colaboradorId", 100);
  const prazoHoras = Math.round(Number(fd.get("prazoHoras")));
  const obs = texto(fd, "observacao", 500);
  if (!colaboradorId) throw new ErroUsuario("Escolha quem vai atender.");
  if (!Number.isFinite(prazoHoras) || prazoHoras < 1 || prazoHoras > 24 * 60) throw new ErroUsuario("Prazo inválido.");
  const col = await prisma.colaboradorManutencao.findUnique({ where: { id: colaboradorId } });
  if (!col || !col.ativo) throw new ErroUsuario("Colaborador não encontrado ou inativo.");

  const reencaminhando = c.status !== "ABERTO";
  await transicionar(id, ["ABERTO", "ENCAMINHADO", "EM_ANDAMENTO"], {
    status: "ENCAMINHADO",
    colaboradorId,
    prazoHoras,
    encaminhadoEm: new Date(),
    // Link novo a cada encaminhamento: o anterior para de valer.
    tokenAcesso: randomBytes(24).toString("base64url"),
    aceitoEm: null,
    prazoFinal: null,
    ...(c.triadoEm ? {} : { triadoEm: new Date(), triadoPorId: user.id }),
  });
  await evento(
    id,
    reencaminhando ? "REENCAMINHADO" : "ENCAMINHADO",
    `${reencaminhando ? "Reencaminhado" : "Aceito e encaminhado"} para ${col.nome}, prazo de ${prazoHoras} h após o OK.${obs ? ` Obs.: ${obs}` : ""}`,
    user.name
  );
  await notificarChamado(id, "chamado_encaminhado");
  revalidar(id);
}

async function recusarChamadoImpl(id: string, fd: FormData) {
  const user = await requireSession();
  if (!podeTriarChamado(user.papel)) throw new ErroUsuario("Só o responsável da manutenção recusa chamados.");
  const motivo = texto(fd, "motivo", 500);
  if (!motivo) throw new ErroUsuario("Diga o motivo da recusa — ele vai para a casa.");
  await transicionar(id, ["ABERTO"], {
    status: "RECUSADO",
    motivoRecusa: motivo,
    triadoEm: new Date(),
    triadoPorId: user.id,
  });
  await evento(id, "RECUSADO", `Recusado: ${motivo}`, user.name);
  await notificarChamado(id, "chamado_recusado");
  revalidar(id);
}

async function marcarDuplicadoImpl(id: string, fd: FormData) {
  const user = await requireSession();
  if (!podeTriarChamado(user.papel)) throw new ErroUsuario("Só o responsável da manutenção marca duplicados.");
  const c = await chamadoVisivel(id, user);
  const numero = Number(String(fd.get("numero") ?? "").replace(/\D/g, ""));
  const original = await prisma.chamadoManutencao.findUnique({ where: { numero } });
  if (!original || original.id === id) throw new ErroUsuario("Informe o número do chamado original.");
  if (original.unidadeId !== c.unidadeId) throw new ErroUsuario("O chamado original é de outra casa.");
  await transicionar(id, ["ABERTO"], {
    status: "RECUSADO",
    duplicadoDeId: original.id,
    motivoRecusa: `Duplicado do chamado nº ${original.numero}, que já está sendo tratado.`,
    triadoEm: new Date(),
    triadoPorId: user.id,
  });
  await evento(id, "DUPLICADO", `Marcado como duplicado do nº ${original.numero}.`, user.name);
  await evento(original.id, "DUPLICATA", `O chamado nº ${c.numero} foi aberto para o mesmo problema.`, user.name);
  await notificarChamado(id, "chamado_recusado");
  revalidar(id);
}

/** Reenvia a mensagem da etapa atual (ex.: depois de cadastrar o telefone). */
async function reenviarWhatsappImpl(id: string) {
  const user = await requireSession();
  const c = await chamadoVisivel(id, user);
  const modelo: Partial<Record<StatusChamado, NomeTemplate>> = {
    ABERTO: "chamado_novo",
    ENCAMINHADO: "chamado_encaminhado",
    EM_ANDAMENTO: c.reprovacoes > 0 ? "chamado_reprovado" : "chamado_encaminhado",
    AGUARDANDO_APROVACAO: "chamado_para_aprovacao",
    RECUSADO: "chamado_recusado",
  };
  const nome = modelo[c.status as StatusChamado];
  if (!nome) throw new ErroUsuario("Não há mensagem a reenviar nesta etapa.");
  await notificarChamado(id, nome);
  revalidar(id);
}

// ---------------------------------------------------------------------------
// Casa: aprovar ou reprovar o serviço
// ---------------------------------------------------------------------------

async function aprovarServicoImpl(id: string, _fd?: FormData) {
  const user = await requireSession();
  if (!podeAprovarServico(user.papel)) throw new ErroUsuario("Quem aprova o serviço é o gerente da casa.");
  await chamadoVisivel(id, user);
  await transicionar(id, ["AGUARDANDO_APROVACAO"], {
    status: "FINALIZADO",
    finalizadoEm: new Date(),
    aprovadoPorId: user.id,
  });
  await evento(id, "APROVADO", "Serviço aprovado pela casa. Chamado finalizado.", user.name);
  revalidar(id);
}

async function reprovarServicoImpl(id: string, fd: FormData) {
  const user = await requireSession();
  if (!podeAprovarServico(user.papel)) throw new ErroUsuario("Quem reprova o serviço é o gerente da casa.");
  const c = await chamadoVisivel(id, user);
  const motivo = texto(fd, "motivo", 500);
  if (!motivo) throw new ErroUsuario("Diga o que ficou faltando — o colaborador recebe esse texto.");
  await transicionar(id, ["AGUARDANDO_APROVACAO"], {
    status: "EM_ANDAMENTO",
    reprovacoes: c.reprovacoes + 1,
    motivoReprovacao: motivo,
    concluidoEm: null,
  });
  await evento(id, "REPROVADO", `Serviço reprovado: ${motivo}`, user.name);
  await notificarChamado(id, "chamado_reprovado");
  revalidar(id);
}

// ---------------------------------------------------------------------------
// Colaborador (sem login — o token do link é a autorização)
// ---------------------------------------------------------------------------

async function chamadoDoToken(token: string) {
  if (!token || token.length < 20) throw new ErroUsuario("Link inválido.");
  const c = await prisma.chamadoManutencao.findUnique({ where: { tokenAcesso: token }, include: { colaborador: true } });
  if (!c) throw new ErroUsuario("Este link não vale mais — o chamado pode ter sido passado para outra pessoa.");
  return c;
}

async function aceitarPorTokenImpl(token: string) {
  const c = await chamadoDoToken(token);
  const agora = new Date();
  await transicionar(c.id, ["ENCAMINHADO"], {
    status: "EM_ANDAMENTO",
    aceitoEm: agora,
    prazoFinal: calcularPrazoFinal(agora, c.prazoHoras ?? 72),
  });
  await evento(c.id, "ACEITO", `${c.colaborador?.nome ?? "Colaborador"} deu o OK. Prazo começou a contar.`, c.colaborador?.nome);
  revalidar(c.id);
  revalidatePath(`/m/${token}`);
}

async function concluirPorTokenImpl(token: string, fd: FormData) {
  const c = await chamadoDoToken(token);
  const servico = texto(fd, "servico", 2000);
  if (!servico) throw new ErroUsuario("Descreva o serviço que foi feito.");
  const fotos = await fotosDoForm(fd);
  if (fotos.length === 0) throw new ErroUsuario("Envie ao menos uma foto do serviço pronto.");
  await transicionar(c.id, ["EM_ANDAMENTO"], {
    status: "AGUARDANDO_APROVACAO",
    concluidoEm: new Date(),
    servicoExecutado: servico,
  });
  await prisma.fotoChamado.createMany({
    data: fotos.map((f) => ({ ...f, chamadoId: c.id, etapa: "CONCLUSAO" satisfies EtapaFoto })),
  });
  await evento(c.id, "CONCLUIDO", `Serviço concluído: ${servico}`, c.colaborador?.nome);
  await notificarChamado(c.id, "chamado_para_aprovacao");
  revalidar(c.id);
  revalidatePath(`/m/${token}`);
}

// ---------------------------------------------------------------------------
// Cadastros: colaboradores e WhatsApp dos usuários
// ---------------------------------------------------------------------------

async function requireGestaoManutencao() {
  const user = await requireSession();
  if (!podeGerenciarManutencao(user.papel)) throw new ErroUsuario("Sem permissão.");
  return user;
}

async function salvarColaboradorImpl(fd: FormData) {
  await requireGestaoManutencao();
  const id = texto(fd, "id", 100) || null;
  const nome = texto(fd, "nome", 120);
  const telefone = normalizarTelefone(texto(fd, "telefone", 40));
  const categorias = fd
    .getAll("categorias")
    .map(String)
    .filter((c) => (CATEGORIAS_MANUTENCAO as readonly string[]).includes(c));
  // O Agente de Manutenção é o "faz-tudo": sem categoria marcada, ele atende
  // manutenção geral — foi o que a pessoa quis dizer ao marcar só "interno".
  if (categorias.length === 0 && fd.get("interno") === "on") categorias.push("GERAL");
  const data = {
    nome,
    telefone: telefone ?? "",
    categorias,
    interno: fd.get("interno") === "on",
    empresa: texto(fd, "empresa", 120) || null,
    observacao: texto(fd, "observacao", 500) || null,
  };
  if (!nome) throw new ErroUsuario("Informe o nome.");
  if (!telefone) throw new ErroUsuario("WhatsApp inválido. Use DDD + número, ex.: (61) 99999-1234.");
  if (categorias.length === 0) throw new ErroUsuario("Marque ao menos uma categoria que ele atende.");
  if (id) await prisma.colaboradorManutencao.update({ where: { id }, data });
  else await prisma.colaboradorManutencao.create({ data });
  revalidatePath("/manutencao/colaboradores");
}

async function alternarColaboradorImpl(id: string, ativo: boolean) {
  await requireGestaoManutencao();
  await prisma.colaboradorManutencao.update({ where: { id }, data: { ativo } });
  revalidatePath("/manutencao/colaboradores");
}

async function salvarContatoImpl(usuarioId: string, fd: FormData) {
  await requireGestaoManutencao();
  const bruto = texto(fd, "telefone", 40);
  if (!bruto) {
    await prisma.contatoUsuario.deleteMany({ where: { usuarioId } });
  } else {
    const telefone = normalizarTelefone(bruto);
    if (!telefone) throw new ErroUsuario("WhatsApp inválido. Use DDD + número.");
    const recebeRelatorioSemanal = fd.get("relatorio") === "on";
    await prisma.contatoUsuario.upsert({
      where: { usuarioId },
      create: { usuarioId, telefone, recebeRelatorioSemanal },
      update: { telefone, recebeRelatorioSemanal },
    });
  }
  revalidatePath("/manutencao/contatos");
}

// ---------------------------------------------------------------------------
// O que as telas chamam — cada uma devolve `{ erro }` em vez de lançar.
// ---------------------------------------------------------------------------

export async function abrirChamado(fd: FormData) {
  return comErro(() => abrirChamadoImpl(fd));
}

export async function cancelarChamado(id: string) {
  return comErro(() => cancelarChamadoImpl(id));
}

export async function encaminharChamado(id: string, fd: FormData) {
  return comErro(() => encaminharChamadoImpl(id, fd));
}

export async function recusarChamado(id: string, fd: FormData) {
  return comErro(() => recusarChamadoImpl(id, fd));
}

export async function marcarDuplicado(id: string, fd: FormData) {
  return comErro(() => marcarDuplicadoImpl(id, fd));
}

export async function reenviarWhatsapp(id: string) {
  return comErro(() => reenviarWhatsappImpl(id));
}

export async function aprovarServico(id: string, _fd?: FormData) {
  return comErro(() => aprovarServicoImpl(id, _fd));
}

export async function reprovarServico(id: string, fd: FormData) {
  return comErro(() => reprovarServicoImpl(id, fd));
}

export async function aceitarPorToken(token: string) {
  return comErro(() => aceitarPorTokenImpl(token));
}

export async function concluirPorToken(token: string, fd: FormData) {
  return comErro(() => concluirPorTokenImpl(token, fd));
}

export async function salvarColaborador(fd: FormData) {
  return comErro(() => salvarColaboradorImpl(fd));
}

export async function alternarColaborador(id: string, ativo: boolean) {
  return comErro(() => alternarColaboradorImpl(id, ativo));
}

export async function salvarContato(usuarioId: string, fd: FormData) {
  return comErro(() => salvarContatoImpl(usuarioId, fd));
}
