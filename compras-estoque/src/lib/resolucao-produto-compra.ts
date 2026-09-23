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
  /** De onde vem a nota. Omitido = TEKNISA, que é o caso das três casas de hoje. */
  origem?: string;
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
  | "UNIDADE_DIVERGENTE"
  /**
   * O código está cadastrado em mais de um produto (CodigoCompraProduto).
   * É erro de cadastro: escolher um gravaria preço no produto errado em
   * silêncio. Não acontece com `Produto.codigoTeknisa`, que é unique.
   */
  | "CODIGO_AMBIGUO";

export type ResolucaoLinhaCompra = {
  produto: ProdutoResumo | null;
  via: "CODIGO" | "NOME" | null;
  motivo: MotivoNaoCasou | null;
  /**
   * Quanto da unidade do produto cabe em UMA unidade de compra. 1 quando a
   * unidade já bate. Quem chama multiplica a quantidade por ele e DIVIDE o
   * preço — ver src/lib/nota-compra.ts.
   */
  fatorConversao: number;
  /**
   * Casou por nome, o produto não tem código gravado e a linha trouxe um.
   * É o código que dá pra aprender pra esse produto — mas quem grava é uma
   * ação explícita (SQL revisado), nunca esta função nem a rota: gravar
   * código a partir de um casamento por nome é o atalho que este arquivo
   * existe pra evitar.
   */
  codigoSugerido: string | null;
};

/** (produtoId, unidade da nota) -> fator. Ver ConversaoUnidadeCompra. */
export type ConversaoResumo = { produtoId: string; unidadeCompra: string; fator: number };

/**
 * Uma linha de CodigoCompraProduto: este código, nesta unidade de compra, é
 * este produto, com este fator. Ver o model no schema.
 */
export type CodigoCompraResumo = {
  origem?: string;
  codigo: string;
  produtoId: string;
  unidadeCompra: string;
  fator: number;
};

/** O que `porCodigoCompra` guarda para cada (origem, código, unidade). */
type EntradaCodigoCompra = { produto: ProdutoResumo; fator: number };

export type IndiceProdutos = {
  /**
   * (origem|||código|||unidade) -> produto + fator. É a tabela
   * CodigoCompraProduto, e é consultada ANTES de `porCodigo`.
   *
   * Vazio até a rota carregar a tabela nova — e com ele vazio a resolução se
   * comporta exatamente como antes dela existir. É o que permite este código
   * ir pra produção antes da tabela.
   */
  porCodigoCompra: Map<string, EntradaCodigoCompra>;
  /** (origem|||código) -> quantos produtos DIFERENTES aquele código responde. */
  produtosPorCodigoCompra: Map<string, number>;
  /** As unidades declaradas para cada (origem|||código), pra explicar a recusa. */
  unidadesPorCodigoCompra: Map<string, string[]>;
  porCodigo: Map<string, ProdutoResumo>;
  porNomeUnidade: Map<string, ProdutoResumo>;
  conversoes: Map<string, number>;
};

/** Origem padrão das notas: as três casas de hoje vêm todas do Teknisa. */
export const ORIGEM_PADRAO = "TEKNISA";

export function montarIndiceProdutos(
  produtos: ProdutoResumo[],
  conversoes: ConversaoResumo[] = [],
  codigosCompra: CodigoCompraResumo[] = []
): IndiceProdutos {
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
  const mapaConversoes = new Map<string, number>();
  for (const c of conversoes) {
    // Fator zero ou negativo não converte nada — divide por zero no preço e
    // zera a entrada de estoque. Cadastro ruim é ignorado, não obedecido.
    if (c.fator > 0) mapaConversoes.set(`${c.produtoId}|||${normalizarUnidade(c.unidadeCompra)}`, c.fator);
  }

  const porId = new Map(produtos.map((p) => [p.id, p]));
  const porCodigoCompra = new Map<string, EntradaCodigoCompra>();
  const produtosDoCodigo = new Map<string, Set<string>>();
  const unidadesPorCodigoCompra = new Map<string, string[]>();
  for (const c of codigosCompra) {
    const codigo = normalizarCodigo(c.codigo);
    const produto = porId.get(c.produtoId);
    // Fator ruim e produto que não está no catálogo carregado são ignorados
    // pelo mesmo motivo das conversões: cadastro quebrado não é obedecido.
    if (!codigo || !produto || !(c.fator > 0)) continue;
    const unidade = normalizarUnidade(c.unidadeCompra);
    const chaveCodigo = `${c.origem ?? ORIGEM_PADRAO}|||${codigo}`;
    porCodigoCompra.set(`${chaveCodigo}|||${unidade}`, { produto, fator: c.fator });

    const quais = produtosDoCodigo.get(chaveCodigo) ?? new Set<string>();
    quais.add(produto.id);
    produtosDoCodigo.set(chaveCodigo, quais);

    const unidades = unidadesPorCodigoCompra.get(chaveCodigo) ?? [];
    if (!unidades.includes(unidade)) unidades.push(unidade);
    unidadesPorCodigoCompra.set(chaveCodigo, unidades);
  }
  const produtosPorCodigoCompra = new Map([...produtosDoCodigo].map(([k, v]) => [k, v.size]));

  return {
    porCodigoCompra,
    produtosPorCodigoCompra,
    unidadesPorCodigoCompra,
    porCodigo,
    porNomeUnidade,
    conversoes: mapaConversoes,
  };
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

  // 0. CodigoCompraProduto, quando a tabela já foi carregada. Vem antes de
  //    tudo porque é a resposta mais específica que existe: este código, nesta
  //    embalagem, é este produto, com este fator.
  //
  //    Índice vazio (a tabela ainda não existe no banco) cai direto no passo 1
  //    e a resolução se comporta como antes.
  if (codigo) {
    const chaveCodigo = `${linha.origem ?? ORIGEM_PADRAO}|||${codigo}`;
    const entrada = indice.porCodigoCompra.get(`${chaveCodigo}|||${unidade}`);
    if (entrada) {
      // Um código cadastrado em dois produtos é erro de cadastro, não uma
      // escolha a fazer aqui. Escolher um gravaria preço num produto e
      // deixaria o outro sem — em silêncio, que é o que este arquivo existe
      // pra evitar. Recusa e reporta; a consulta do passo 6 do script de
      // migração lista esses casos.
      if ((indice.produtosPorCodigoCompra.get(chaveCodigo) ?? 1) > 1) {
        return { produto: null, via: null, motivo: "CODIGO_AMBIGUO", codigoSugerido: null, fatorConversao: 1 };
      }
      return { produto: entrada.produto, via: "CODIGO", motivo: null, codigoSugerido: null, fatorConversao: entrada.fator };
    }
    // O código é conhecido, mas NÃO nesta unidade. É a mesma recusa de sempre
    // — preço de caixa não vira preço de quilo —, agora sabendo exatamente
    // quais embalagens foram declaradas para ele.
    const declaradas = indice.unidadesPorCodigoCompra.get(chaveCodigo);
    if (declaradas && declaradas.length > 0) {
      const qualquer = indice.porCodigoCompra.get(`${chaveCodigo}|||${declaradas[0]}`);
      return {
        produto: qualquer?.produto ?? null,
        via: null,
        motivo: "UNIDADE_DIVERGENTE",
        codigoSugerido: null,
        fatorConversao: 1,
      };
    }
  }

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
        // ...a menos que alguém já tenha dito quanto vale a embalagem. Aí não é
        // divergência, é conversão conhecida: 1 bandeja = 40 g.
        const fator = indice.conversoes.get(`${p.id}|||${unidade}`);
        if (fator) return { produto: p, via: "CODIGO", motivo: null, codigoSugerido: null, fatorConversao: fator };
        return { produto: p, via: null, motivo: "UNIDADE_DIVERGENTE", codigoSugerido: null, fatorConversao: 1 };
      }
      return { produto: p, via: "CODIGO", motivo: null, codigoSugerido: null, fatorConversao: 1 };
    }
  }

  // 2. Sem código, ou código desconhecido: cai pro nome.
  const achado = porNome(indice, linha.nome, unidade);
  if (!achado) {
    return { produto: null, via: null, motivo: "NAO_ENCONTRADO", codigoSugerido: null, fatorConversao: 1 };
  }

  // 3. O nome casa, mas o produto já declara um código DIFERENTE. Os dois
  //    dados se contradizem: ou o Teknisa recadastrou o item com código novo,
  //    ou são dois produtos distintos de nome igual. Casar por nome aqui
  //    seria escolher o texto por cima do identificador.
  const codigoDoProduto = normalizarCodigo(achado.codigoTeknisa);
  if (codigo && codigoDoProduto && codigoDoProduto !== codigo) {
    return { produto: achado, via: null, motivo: "CONFLITO_DE_CODIGO", codigoSugerido: null, fatorConversao: 1 };
  }

  return {
    produto: achado,
    via: "NOME",
    motivo: null,
    codigoSugerido: codigo && !codigoDoProduto ? codigo : null,
    fatorConversao: 1,
  };
}

export const EXPLICACAO_MOTIVO: Record<MotivoNaoCasou, string> = {
  NAO_ENCONTRADO: "nenhum produto com esse nome e unidade no catálogo",
  CONFLITO_DE_CODIGO: "o produto com esse nome já está cadastrado com outro código do Teknisa",
  UNIDADE_DIVERGENTE: "o código casa com um produto cadastrado em outra unidade de medida",
  CODIGO_AMBIGUO: "o código está cadastrado em mais de um produto — corrigir o cadastro antes",
};
