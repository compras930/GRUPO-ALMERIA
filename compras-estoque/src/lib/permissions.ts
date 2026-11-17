import type { Papel } from "@/lib/constants";

/** ADMIN sempre pode tudo. As demais checagens abaixo são o mínimo de cada papel. */

export function podeAprovarPedido(papel: Papel) {
  return papel === "ADMIN" || papel === "APROVADOR";
}

/**
 * O GERENTE passou a criar pedido em 11/11/2026.
 *
 * Quem sabe o que falta na casa é quem está nela: antes o gerente mandava a
 * lista por mensagem e outra pessoa digitava, o que custava um dia e perdia
 * item no caminho. Criar não é aprovar — o pedido continua saindo como
 * AGUARDANDO_APROVACAO, e a diretriz da semana (ver src/lib/regra-de-pedido.ts)
 * é justamente o que torna seguro abrir a porta.
 */
export function podeCriarPedido(papel: Papel) {
  return papel === "ADMIN" || papel === "SOLICITANTE" || papel === "GERENTE";
}

export function podeReceber(papel: Papel) {
  return papel === "ADMIN" || papel === "RECEBEDOR";
}

export function podeGerenciarCadastros(papel: Papel) {
  return papel === "ADMIN";
}

/**
 * Todo papel vê pedidos — o gerente agora cria os da própria casa, e a lista
 * já é escopada por unidade. Esconder a tela dele esconderia o próprio pedido.
 */
export function podeVerPedidos(_papel: Papel) {
  return true;
}

/**
 * Só o ADMIN pode existir sem casa. Qualquer outro papel SEM unidade é um
 * usuário quebrado nos dois sentidos, e o segundo é o grave:
 *
 *   - não OPERA: contagem e perda pegam a casa do próprio usuário, então as
 *     telas respondem "Nenhuma unidade selecionada" e não há o que fazer;
 *   - VÊ DEMAIS: o Painel escopa por `user.unidadeId`, e nulo não escopa nada
 *     — o gerente de uma casa abriria o mês somado de TODAS elas.
 *
 * É por isso que a regra mora aqui e não só na tela: um gerente criado sem
 * casa não falha, o que seria visível; ele vaza, calado.
 */
export function exigeUnidade(papel: Papel) {
  // O responsável da manutenção atende TODAS as casas, e não vaza nada: o
  // middleware o prende no módulo de Manutenção, onde a visão de todas as
  // casas é justamente o trabalho dele.
  return papel !== "ADMIN" && papel !== "MANUTENCAO";
}

/** Um usuário só vê/opera dados da própria unidade, a menos que seja ADMIN. */
export function unidadeVisivel(papel: Papel, unidadeUsuario: string | null, unidadeAlvo: string) {
  if (papel === "ADMIN") return true;
  return unidadeUsuario === unidadeAlvo;
}

// ---------- Manutenção ----------

/** Papéis que só enxergam o módulo de Manutenção. */
export function somenteManutencao(papel: Papel) {
  return papel === "MANUTENCAO";
}

/** Quem vê os chamados de TODAS as casas. Os demais veem os da própria. */
export function veTodosOsChamados(papel: Papel) {
  return papel === "ADMIN" || papel === "MANUTENCAO";
}

/** Qualquer pessoa da casa abre chamado — quem vê o defeito é quem avisa. */
export function podeAbrirChamado(_papel: Papel) {
  return true;
}

/** Aceitar, recusar e encaminhar: o responsável da manutenção (e o admin). */
export function podeTriarChamado(papel: Papel) {
  return papel === "ADMIN" || papel === "MANUTENCAO";
}

/** Aprovar o serviço feito: o responsável da loja — o gerente da casa. */
export function podeAprovarServico(papel: Papel) {
  return papel === "ADMIN" || papel === "GERENTE";
}

export function podeGerenciarManutencao(papel: Papel) {
  return papel === "ADMIN" || papel === "MANUTENCAO";
}
