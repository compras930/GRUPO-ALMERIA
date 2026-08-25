// Constantes de domínio — o SQLite não tem enum nativo, então os papéis e status
// vivem como string no banco e são validados/tipados aqui.

export const PAPEIS = ["ADMIN", "APROVADOR", "SOLICITANTE", "RECEBEDOR"] as const;
export type Papel = (typeof PAPEIS)[number];

export const PAPEL_LABEL: Record<Papel, string> = {
  ADMIN: "Administrador",
  APROVADOR: "Aprovador",
  SOLICITANTE: "Solicitante",
  RECEBEDOR: "Recebedor",
};

export const STATUS_PEDIDO = [
  "RASCUNHO",
  "AGUARDANDO_APROVACAO",
  "APROVADO",
  "REJEITADO",
  "ENVIADO",
  "RECEBIDO_PARCIAL",
  "RECEBIDO_TOTAL",
  "CANCELADO",
] as const;
export type StatusPedido = (typeof STATUS_PEDIDO)[number];

export const STATUS_PEDIDO_LABEL: Record<StatusPedido, string> = {
  RASCUNHO: "Rascunho",
  AGUARDANDO_APROVACAO: "Aguardando aprovação",
  APROVADO: "Aprovado",
  REJEITADO: "Rejeitado",
  ENVIADO: "Enviado ao fornecedor",
  RECEBIDO_PARCIAL: "Recebido parcialmente",
  RECEBIDO_TOTAL: "Recebido totalmente",
  CANCELADO: "Cancelado",
};

export const TIPO_MOVIMENTO = [
  "ENTRADA_RECEBIMENTO",
  "SAIDA_CONSUMO",
  "AJUSTE_CONTAGEM",
  "AJUSTE_MANUAL",
] as const;
export type TipoMovimento = (typeof TIPO_MOVIMENTO)[number];

export const UNIDADES_MEDIDA = ["KG", "G", "L", "ML", "UN", "CX", "PCT", "FD"] as const;
