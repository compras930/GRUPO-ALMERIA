// Constantes de domínio — o SQLite não tem enum nativo, então os papéis e status
// vivem como string no banco e são validados/tipados aqui.

// GERENTE é o responsável pela unidade: conta o estoque toda segunda, lança
// perda todo dia e olha o consumo da própria casa. Não é um papel de compra —
// ele NÃO cria nem aprova pedido, e os helpers de permissão já garantem isso
// por omissão (cada um lista quem pode; quem não está, não pode).
export const PAPEIS = ["ADMIN", "APROVADOR", "SOLICITANTE", "RECEBEDOR", "GERENTE"] as const;
export type Papel = (typeof PAPEIS)[number];

export const PAPEL_LABEL: Record<Papel, string> = {
  ADMIN: "Administrador",
  APROVADOR: "Aprovador",
  SOLICITANTE: "Solicitante",
  RECEBEDOR: "Recebedor",
  GERENTE: "Gerente da unidade",
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

/**
 * Motivos de baixa declarada — mercadoria que saiu da despensa e NÃO virou
 * venda. O gerente lança diariamente.
 *
 * POR QUE O MOTIVO MORA NO `tipo`, e não numa coluna nova. `MovimentoEstoque.tipo`
 * já é texto com prefixo por família (ENTRADA_, AJUSTE_, SAIDA_), e um
 * `GROUP BY tipo` já dá a quebra por motivo. Coluna nova exigiria migração, e
 * migração exige que o banco mude ANTES do código — a coordenação que já custou
 * caro neste projeto. Detalhe livre continua cabendo em `observacao`.
 *
 * AS DUAS ÚLTIMAS NÃO SÃO DESPERDÍCIO, e estão aqui de propósito: cortesia e
 * refeição da equipe também saem do estoque sem virar receita. Para a conta do
 * CMV é a mesma pergunta — "saiu e não vendeu" —, e separá-las em outra tela
 * faria o gerente lançar em dois lugares no mesmo gesto.
 */
export const TIPO_PERDA = [
  "PERDA_PREPARO",
  "PERDA_VALIDADE",
  "PERDA_QUEBRA",
  "PERDA_PRODUCAO",
  "PERDA_CORTESIA",
  "PERDA_CONSUMO_INTERNO",
  "PERDA_DEVOLUCAO",
] as const;
export type TipoPerda = (typeof TIPO_PERDA)[number];

export const TIPO_PERDA_LABEL: Record<TipoPerda, string> = {
  PERDA_PREPARO: "Preparo (aparas, limpeza, porcionamento)",
  PERDA_VALIDADE: "Vencimento",
  PERDA_QUEBRA: "Quebra ou avaria",
  PERDA_PRODUCAO: "Erro de produção (queimou, refez)",
  PERDA_CORTESIA: "Cortesia a cliente",
  PERDA_CONSUMO_INTERNO: "Consumo da equipe",
  // Prato ou drink que voltou do salão. É baixa de ITEM VENDIDO, não de
  // insumo: quem lança escolhe "Caprese", e a ficha diz o que saiu da
  // despensa. Ver registrarPerdaDeItemVendido em src/actions/estoque.ts.
  PERDA_DEVOLUCAO: "Devolvido pelo cliente",
};

export const TIPO_MOVIMENTO = [
  "ENTRADA_NOTA",
  "ENTRADA_RECEBIMENTO",
  "SAIDA_CONSUMO",
  "AJUSTE_CONTAGEM",
  "AJUSTE_MANUAL",
  ...TIPO_PERDA,
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
