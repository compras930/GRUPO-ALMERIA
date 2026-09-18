// Casa uma linha de compra vinda do Teknisa contra o Produto cadastrado.
//
// POR QUE POR CÓDIGO. A primeira carga real de preço (17/09/2026, via n8n)
// mandou 650 linhas de compra das duas casas e reconheceu 265 — 41%. As
// outras 385 não são produto que falta: são o mesmo produto escrito de outro
// jeito. O Teknisa manda "ALCATRA BOVINA BOMBOM (COMPRA)" onde o catálogo tem
// "ALCATRA BOVINO KG". Nenhuma normalização de texto resolve isso sem
// arriscar casar coisa errada, e casar errado aqui grava preço errado em
// ficha — silenciosamente.
//
// O `codigoProduto` do Teknisa (12 dígitos, ex. 100000017104) não muda quando
// alguém reescreve o nome. Pareia-se uma vez, por gente, e vale pra sempre.
// É a mesma lição de resolucao-ingredientes.ts e resolucao-item-venda.ts, um
// nível acima: resolver por identificador, nunca por texto digitado.
//
// O código é GLOBAL, não por casa: ao contrário do PDV (um por casa, espaços
// de código que não se comunicam), a compra das casas do Grupo sai toda do
// mesmo Teknisa, com um cadastro de produto só. Por isso `Produto` carrega o
// código direto, com unique simples.
//
// Núcleo puro: sem Prisma, sem I/O. Quem chama carrega o catálogo e passa
// pronto (ver src/lib/nota-compra.ts).
import { normalizarNome, chaveComparacao } from "@/lib/nome-normalizado";

// Sinônimos de unidade. O catálogo só tem KG, LT, UND e CX (UNIDADES_MEDIDA);
// o Teknisa manda a embalagem de compra, que é outra palavra pra mesma coisa.
//
// SÃO SINÔNIMOS, NÃO CONVERSÕES. Garrafa é uma unidade, barril é uma unidade,
// fatia é uma unidade; fardo, lata, balde e bag são um pacote. Nada aqui
// multiplica ou divide número nenhum — só reconhece que "GF" e "UND" nomeiam a
// mesma contagem.
//
// O que NÃO entra aqui, de propósito: qualquer par que exija saber o conteúdo
// da embalagem. Caixa com 360 ovos contra ovo avulso, lata de 2,5 kg contra
// quilo, maço de salsa contra quilo — ali falta um número (quantos, quanto
// pesa) que não está em lugar nenhum do sistema, e inventá-lo aqui gravaria
// preço errado com cara de preço certo. Esses continuam recusados e aparecem
// no relatório de unidades divergentes.
//
// Levantado no dado real de 18/09/2026: os pares abaixo respondiam por
// R$ 32 mil de compra travada, sem nenhuma pergunta a fazer pra ninguém.
const SINONIMO_UNIDADE: Record<string, string> = {
  // uma peça
  UN: "UND",
  UNIDADE: "UND",
  UNI: "UND",
  UNID: "UND",
  PC: "UND",
  GF: "UND",  // garrafa
  FT: "UND",  // fatia
  BBL: "UND", // barril
  RL: "UND",  // rolo
  BOB: "UND", // bobina
  PR: "UND",  // par
  // um pacote fechado
  FD: "CX",   // fardo
  LA: "CX",   // lata
  BD: "CX",   // balde
  BB: "CX",   // bombona
  BG: "CX",   // bag
  GA: "CX",   // galão
  PT: "CX",   // pote
};

export function normalizarUnidade(unidadeBruta: string): string {
  const u = normalizarNome(unidadeBruta).toUpperCase();
  return SINONIMO_UNIDADE[u] ?? u;
}

export function normalizarCodigo(codigo: string | number | null | undefined): string | null {
  const c = String(codigo ?? "").trim();
  return c === "" ? null : c;
}

export type LinhaCompraBruta = {
  nome: string;
  unidadeMedida: string;
  /** Código do produto no Teknisa. Ausente quando a origem não manda. */
  codigo?: string | null;
};

export type ProdutoResumo = {
  id: string;
  nome: string;
  unidadeMedida: string;
  codigoTeknisa: string | null;
};

export type MotivoNaoCasou =
  /** Nenhum produto com esse nome+unidade, e o código (se veio) é desconhecido. */
  | "NAO_ENCONTRADO"
  /** O nome casa com um produto que já declara OUTRO código. */
  | "CONFLITO_DE_CODIGO"
  /** O código casa, mas a unidade da linha é outra. Ver comentário abaixo. */
  | "UNIDADE_DIVERGENTE";

export type ResolucaoLinhaCompra = {
  produto: ProdutoResumo | null;
  via: "CODIGO" | "NOME" | null;
  motivo: MotivoNaoCasou | null;
  /**
   * Casou por nome, o produto não tem código gravado e a linha trouxe um.
   * É o código que dá pra aprender pra esse produto — mas quem grava é uma
   * ação explícita (SQL revisado), nunca esta função nem a rota: gravar
   * código a partir de um casamento por nome é o atalho que este arquivo
   * existe pra evitar.
   */
  codigoSugerido: string | null;
};

export type IndiceProdutos = {
  porCodigo: Map<string, ProdutoResumo>;
  porNomeUnidade: Map<string, ProdutoResumo>;
};

export function montarIndiceProdutos(produtos: ProdutoResumo[]): IndiceProdutos {
  const porCodigo = new Map<string, ProdutoResumo>();
  for (const p of produtos) {
    const c = normalizarCodigo(p.codigoTeknisa);
    // codigoTeknisa é unique no banco, então não há colisão possível aqui.
    if (c) porCodigo.set(c, p);
  }
  const porNomeUnidade = new Map<string, ProdutoResumo>();
  for (const p of produtos) {
    porNomeUnidade.set(`${chaveComparacao(p.nome)}|||${p.unidadeMedida}`, p);
  }
  return { porCodigo, porNomeUnidade };
}

function porNome(indice: IndiceProdutos, nomeBruto: string, unidade: string): ProdutoResumo | null {
  const nome = normalizarNome(nomeBruto);
  const direto = indice.porNomeUnidade.get(`${chaveComparacao(nome)}|||${unidade}`);
  if (direto) return direto;

  // Teknisa às vezes repete a unidade dentro do próprio nome (ex.: "ALCATRA
  // BOVINO KG" com unidade "KG") — tenta de novo tirando o sufixo redundante.
  const sufixo = ` ${unidade}`;
  if (nome.toUpperCase().endsWith(sufixo)) {
    const semSufixo = nome.slice(0, nome.length - sufixo.length).trim();
    return indice.porNomeUnidade.get(`${chaveComparacao(semSufixo)}|||${unidade}`) ?? null;
  }
  return null;
}

export function resolverLinhaCompraPura(linha: LinhaCompraBruta, indice: IndiceProdutos): ResolucaoLinhaCompra {
  const codigo = normalizarCodigo(linha.codigo);
  const unidade = normalizarUnidade(linha.unidadeMedida);

  // 1. Código bate. O nome pode estar diferente à vontade — é pra isso que o
  //    código serve.
  if (codigo) {
    const p = indice.porCodigo.get(codigo);
    if (p) {
      // ...mas a UNIDADE não é cosmética: o preço é gravado por unidade
      // canônica do produto e a ficha multiplica quantidade × preço sem
      // converter nada. Uma linha em CX casando por código com um produto em
      // KG gravaria o preço da caixa como preço do quilo. Enquanto o
      // casamento era só por nome+unidade isso era impossível por
      // construção; por código, precisa de checagem explícita.
      if (p.unidadeMedida !== unidade) {
        return { produto: p, via: null, motivo: "UNIDADE_DIVERGENTE", codigoSugerido: null };
      }
      return { produto: p, via: "CODIGO", motivo: null, codigoSugerido: null };
    }
  }

  // 2. Sem código, ou código desconhecido: cai pro nome.
  const achado = porNome(indice, linha.nome, unidade);
  if (!achado) {
    return { produto: null, via: null, motivo: "NAO_ENCONTRADO", codigoSugerido: null };
  }

  // 3. O nome casa, mas o produto já declara um código DIFERENTE. Os dois
  //    dados se contradizem: ou o Teknisa recadastrou o item com código novo,
  //    ou são dois produtos distintos de nome igual. Casar por nome aqui
  //    seria escolher o texto por cima do identificador.
  const codigoDoProduto = normalizarCodigo(achado.codigoTeknisa);
  if (codigo && codigoDoProduto && codigoDoProduto !== codigo) {
    return { produto: achado, via: null, motivo: "CONFLITO_DE_CODIGO", codigoSugerido: null };
  }

  return {
    produto: achado,
    via: "NOME",
    motivo: null,
    codigoSugerido: codigo && !codigoDoProduto ? codigo : null,
  };
}

export const EXPLICACAO_MOTIVO: Record<MotivoNaoCasou, string> = {
  NAO_ENCONTRADO: "nenhum produto com esse nome e unidade no catálogo",
  CONFLITO_DE_CODIGO: "o produto com esse nome já está cadastrado com outro código do Teknisa",
  UNIDADE_DIVERGENTE: "o código casa com um produto cadastrado em outra unidade de medida",
};
