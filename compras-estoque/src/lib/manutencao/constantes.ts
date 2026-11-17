// Domínio dos chamados de manutenção — status, categorias, urgências e a cor
// de cada situação no painel. Vive em string no banco, validado aqui (mesmo
// padrão de src/lib/constants.ts).

export const STATUS_CHAMADO = [
  "ABERTO",
  "ENCAMINHADO",
  "EM_ANDAMENTO",
  "AGUARDANDO_APROVACAO",
  "FINALIZADO",
  "RECUSADO",
  "CANCELADO",
] as const;
export type StatusChamado = (typeof STATUS_CHAMADO)[number];

export const STATUS_CHAMADO_LABEL: Record<StatusChamado, string> = {
  ABERTO: "Aguardando triagem",
  ENCAMINHADO: "Aguardando OK do colaborador",
  EM_ANDAMENTO: "Em execução",
  AGUARDANDO_APROVACAO: "Aguardando aprovação da casa",
  FINALIZADO: "Finalizado",
  RECUSADO: "Recusado",
  CANCELADO: "Cancelado",
};

/**
 * As três cores do painel, como foram pedidas:
 *
 *   🔴 EM ABERTO     — ninguém está trabalhando nele ainda (triagem ou
 *                      esperando o colaborador dar o OK)
 *   🟡 EM ANDAMENTO  — o colaborador aceitou; inclui o "terminei, falta a
 *                      casa aprovar", porque o chamado ainda não acabou
 *   🟢 FINALIZADO    — a casa aprovou o serviço
 *
 * Recusado e cancelado ficam fora das três (cinza): não são manutenção que
 * aconteceu, e somá-los ao "finalizado" inflaria o número que importa.
 */
export const GRUPOS_PAINEL = ["ABERTO", "ANDAMENTO", "FINALIZADO", "ENCERRADO"] as const;
export type GrupoPainel = (typeof GRUPOS_PAINEL)[number];

export function grupoDoStatus(status: string): GrupoPainel {
  switch (status) {
    case "ABERTO":
    case "ENCAMINHADO":
      return "ABERTO";
    case "EM_ANDAMENTO":
    case "AGUARDANDO_APROVACAO":
      return "ANDAMENTO";
    case "FINALIZADO":
      return "FINALIZADO";
    default:
      return "ENCERRADO";
  }
}

export const GRUPO_PAINEL_LABEL: Record<GrupoPainel, string> = {
  ABERTO: "Em aberto",
  ANDAMENTO: "Em andamento",
  FINALIZADO: "Finalizado",
  ENCERRADO: "Recusado / cancelado",
};

export const STATUS_DO_GRUPO: Record<GrupoPainel, StatusChamado[]> = {
  ABERTO: ["ABERTO", "ENCAMINHADO"],
  ANDAMENTO: ["EM_ANDAMENTO", "AGUARDANDO_APROVACAO"],
  FINALIZADO: ["FINALIZADO"],
  ENCERRADO: ["RECUSADO", "CANCELADO"],
};

export const CATEGORIAS_MANUTENCAO = [
  "ELETRICA",
  "HIDRAULICA",
  "ALVENARIA",
  "REFRIGERACAO",
  "AR_CONDICIONADO",
  "EQUIPAMENTOS_COZINHA",
  "GAS",
  "MARCENARIA",
  "SERRALHERIA",
  "PINTURA",
  "INFORMATICA",
  "GERAL",
] as const;
export type CategoriaManutencao = (typeof CATEGORIAS_MANUTENCAO)[number];

export const CATEGORIA_LABEL: Record<CategoriaManutencao, string> = {
  ELETRICA: "Elétrica",
  HIDRAULICA: "Hidráulica / encanamento",
  ALVENARIA: "Alvenaria / pedreiro",
  REFRIGERACAO: "Refrigeração (câmara, freezer, geladeira)",
  AR_CONDICIONADO: "Ar-condicionado / exaustão",
  EQUIPAMENTOS_COZINHA: "Máquinas e equipamentos de cozinha",
  GAS: "Gás",
  MARCENARIA: "Marcenaria / móveis",
  SERRALHERIA: "Serralheria / portas e grades",
  PINTURA: "Pintura",
  INFORMATICA: "Informática / PDV / rede",
  GERAL: "Manutenção geral (agente de manutenção)",
};

export function rotuloCategoria(c: string) {
  return CATEGORIA_LABEL[c as CategoriaManutencao] ?? c;
}

export const URGENCIAS = ["URGENTE", "ALTA", "NORMAL", "BAIXA"] as const;
export type Urgencia = (typeof URGENCIAS)[number];

export const URGENCIA_LABEL: Record<Urgencia, string> = {
  URGENTE: "Urgente — parou a operação",
  ALTA: "Alta — atrapalha o serviço",
  NORMAL: "Normal",
  BAIXA: "Baixa — quando der",
};

/** Prazo sugerido na triagem, em horas a partir do OK do colaborador. O
 *  responsável pode trocar caso a caso. */
export const PRAZO_PADRAO_HORAS: Record<Urgencia, number> = {
  URGENTE: 24,
  ALTA: 48,
  NORMAL: 72,
  BAIXA: 168,
};

export const ETAPAS_FOTO = ["ABERTURA", "CONCLUSAO"] as const;
export type EtapaFoto = (typeof ETAPAS_FOTO)[number];

/** Limites das fotos. Elas chegam já reduzidas pelo navegador (lado maior
 *  1280 px, JPEG) — o teto aqui é a rede de segurança, não o tamanho normal. */
export const MAX_FOTOS_POR_ENVIO = 5;
export const MAX_BYTES_FOTO = 1_500_000;
export const MIMES_FOTO = ["image/jpeg", "image/png", "image/webp"] as const;

/** Janela para chamar de REPETIDO: mesmo defeito, mesmo lugar, mesma casa. */
export const DIAS_JANELA_REPETIDO = 30;
