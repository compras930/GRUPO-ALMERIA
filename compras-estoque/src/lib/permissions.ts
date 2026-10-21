import type { Papel } from "@/lib/constants";

/** ADMIN sempre pode tudo. As demais checagens abaixo são o mínimo de cada papel. */

export function podeAprovarPedido(papel: Papel) {
  return papel === "ADMIN" || papel === "APROVADOR";
}

export function podeCriarPedido(papel: Papel) {
  return papel === "ADMIN" || papel === "SOLICITANTE";
}

export function podeReceber(papel: Papel) {
  return papel === "ADMIN" || papel === "RECEBEDOR";
}

export function podeGerenciarCadastros(papel: Papel) {
  return papel === "ADMIN";
}

/**
 * O GERENTE opera a casa — conta estoque, lança perda, olha consumo — e não
 * participa do fluxo de compra. Esconder os pedidos dele não é segurança (as
 * ações já recusam por papel); é tirar da tela número que não é da conta dele
 * e que ele não tem como resolver.
 */
export function podeVerPedidos(papel: Papel) {
  return papel !== "GERENTE";
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
  return papel !== "ADMIN";
}

/** Um usuário só vê/opera dados da própria unidade, a menos que seja ADMIN. */
export function unidadeVisivel(papel: Papel, unidadeUsuario: string | null, unidadeAlvo: string) {
  if (papel === "ADMIN") return true;
  return unidadeUsuario === unidadeAlvo;
}
