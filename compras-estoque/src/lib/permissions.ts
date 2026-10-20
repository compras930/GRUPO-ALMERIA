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

/** Um usuário só vê/opera dados da própria unidade, a menos que seja ADMIN. */
export function unidadeVisivel(papel: Papel, unidadeUsuario: string | null, unidadeAlvo: string) {
  if (papel === "ADMIN") return true;
  return unidadeUsuario === unidadeAlvo;
}
