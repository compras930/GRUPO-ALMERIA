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

// Unidades oferecidas pra CADASTRO NOVO de produto. KG/LT/UND é o padrão do
// catálogo desde a padronização (G e ML foram convertidos dividindo por 1000; as
// variantes de "unidade" — UN, UNIDADE, UNI, UNID — só trocaram de nome). CX
// continua porque embalagem/descartável não tem como converter sem saber o
// tamanho do pacote, e alguns produtos ficaram legitimamente assim.
//
// A lista anterior ("KG","G","L","ML","UN","CX","PCT","FD") não tinha nem UND nem
// LT — justamente as duas unidades do padrão — então a tela de produtos nunca
// permitiu cadastrar nelas, e a validação que passou a usar esta lista rejeitava
// criar produto em UND/LT pela ficha técnica.
//
// Isto NÃO valida dado existente: o catálogo tem valores legados (G, ML, UN,
// UNIDADE, BOB, PT...) que continuam funcionando. Restringe só o que entra de
// novo, pra não voltar a crescer a colcha de retalhos.
export const UNIDADES_MEDIDA = ["KG", "LT", "UND", "CX"] as const;

export const TIPO_ITEM_VENDA = ["PRATO", "BEBIDA", "VINHO"] as const;
export type TipoItemVenda = (typeof TIPO_ITEM_VENDA)[number];

export const TIPO_ITEM_VENDA_LABEL: Record<TipoItemVenda, string> = {
  PRATO: "Pratos",
  BEBIDA: "Bebidas",
  VINHO: "Vinhos",
};

// E-mail do usuário de serviço usado pra atribuir gravações feitas pelas
// automações via n8n (solicitanteId de PedidoCompra, importadoPorId de
// NotaCompra/VendaSemanal) — nunca loga pela UI, criado em prisma/seed.ts.
export const N8N_SERVICE_USER_EMAIL = "integracao-n8n@grupoalmeria.com.br";
