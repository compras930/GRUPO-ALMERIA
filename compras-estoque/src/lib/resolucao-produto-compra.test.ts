import { describe, expect, it } from "vitest";
import {
  montarIndiceProdutos,
  resolverLinhaCompraPura,
  type ProdutoResumo,
} from "@/lib/resolucao-produto-compra";

const CATALOGO: ProdutoResumo[] = [
  { id: "p1", nome: "ALCATRA BOVINO KG", unidadeMedida: "KG", codigoTeknisa: "100000017104" },
  { id: "p2", nome: "BATATA SURECRISP 7MM", unidadeMedida: "KG", codigoTeknisa: null },
  { id: "p3", nome: "AGUA COM GAS", unidadeMedida: "UND", codigoTeknisa: null },
];

const indice = montarIndiceProdutos(CATALOGO);

describe("resolverLinhaCompraPura", () => {
  it("casa por código mesmo com o nome completamente diferente", () => {
    // O caso que motivou a coluna: o Teknisa manda o nome de compra, o
    // catálogo tem o nome de estoque, e só o código liga os dois.
    const r = resolverLinhaCompraPura(
      { nome: "ALCATRA BOVINA BOMBOM (COMPRA)", unidadeMedida: "KG", codigo: "100000017104" },
      indice
    );
    expect(r.via).toBe("CODIGO");
    expect(r.produto?.id).toBe("p1");
  });

  it("recusa quando o código casa mas a unidade é outra", () => {
    // Preço de caixa não pode virar preço de quilo. Sem esta checagem, casar
    // por código reabre o buraco que o casamento por nome+unidade fechava.
    const r = resolverLinhaCompraPura(
      { nome: "ALCATRA BOVINA BOMBOM (COMPRA)", unidadeMedida: "CX", codigo: "100000017104" },
      indice
    );
    expect(r.via).toBeNull();
    expect(r.motivo).toBe("UNIDADE_DIVERGENTE");
    expect(r.produto?.id).toBe("p1"); // vem junto pra poder reportar qual é
  });

  it("cai pro nome quando não veio código", () => {
    const r = resolverLinhaCompraPura({ nome: "BATATA SURECRISP 7MM", unidadeMedida: "KG" }, indice);
    expect(r.via).toBe("NOME");
    expect(r.produto?.id).toBe("p2");
    expect(r.codigoSugerido).toBeNull();
  });

  it("sugere o código quando casou por nome e o produto ainda não tem código", () => {
    const r = resolverLinhaCompraPura(
      { nome: "BATATA SURECRISP 7MM", unidadeMedida: "KG", codigo: "100000019999" },
      indice
    );
    expect(r.via).toBe("NOME");
    expect(r.codigoSugerido).toBe("100000019999");
  });

  it("não sugere código quando o produto já tem o mesmo código", () => {
    const r = resolverLinhaCompraPura(
      { nome: "ALCATRA BOVINO KG", unidadeMedida: "KG", codigo: "100000017104" },
      indice
    );
    expect(r.via).toBe("CODIGO");
    expect(r.codigoSugerido).toBeNull();
  });

  it("recusa quando o nome casa com produto que declara OUTRO código", () => {
    const r = resolverLinhaCompraPura(
      { nome: "ALCATRA BOVINO KG", unidadeMedida: "KG", codigo: "999999999999" },
      indice
    );
    expect(r.via).toBeNull();
    expect(r.motivo).toBe("CONFLITO_DE_CODIGO");
  });

  it("tira o sufixo redundante de unidade do nome que veio na planilha", () => {
    // Planilha "BATATA SURECRISP 7MM KG" + un KG casa com o cadastro
    // "BATATA SURECRISP 7MM". O contrário NÃO vale: o sufixo é tirado só do
    // lado da planilha, nunca do catálogo — tirar do catálogo criaria colisão
    // entre "X" e "X KG" cadastrados na mesma unidade.
    const r = resolverLinhaCompraPura({ nome: "BATATA SURECRISP 7MM KG", unidadeMedida: "KG" }, indice);
    expect(r.via).toBe("NOME");
    expect(r.produto?.id).toBe("p2");
  });

  it("aceita sinônimo de unidade (UN -> UND)", () => {
    const r = resolverLinhaCompraPura({ nome: "AGUA COM GAS", unidadeMedida: "un" }, indice);
    expect(r.via).toBe("NOME");
    expect(r.produto?.id).toBe("p3");
  });

  it("trata embalagem como sinônimo de contagem: garrafa é unidade, fardo é caixa", () => {
    // R$ 32 mil de compra estavam travados por isto em 18/09/2026: vinho
    // comprado em GF contra cadastro em UND, água em FD contra cadastro em CX.
    const catalogo: ProdutoResumo[] = [
      { id: "v1", nome: "GRAN LEGADO", unidadeMedida: "UND", codigoTeknisa: "900001000349" },
      { id: "a1", nome: "ACQUISSIMA PASSION", unidadeMedida: "CX", codigoTeknisa: "905000005158" },
    ];
    const idx = montarIndiceProdutos(catalogo);
    expect(resolverLinhaCompraPura({ nome: "x", unidadeMedida: "GF", codigo: "900001000349" }, idx).via).toBe("CODIGO");
    expect(resolverLinhaCompraPura({ nome: "x", unidadeMedida: "FD", codigo: "905000005158" }, idx).via).toBe("CODIGO");
  });

  it("PCT é pacote, e pacote é um CX — veio do XMenu do Beira Lago", () => {
    const catalogo: ProdutoResumo[] = [
      { id: "d1", nome: "GUARDANAPO", unidadeMedida: "CX", codigoTeknisa: "900000000001" },
    ];
    const r = resolverLinhaCompraPura(
      { nome: "x", unidadeMedida: "PCT", codigo: "900000000001" },
      montarIndiceProdutos(catalogo)
    );
    expect(r.via).toBe("CODIGO");
  });

  it("NÃO trata como sinônimo o par que exige saber o conteúdo da embalagem", () => {
    // Caixa com 360 ovos contra ovo avulso: falta um número (quantos) que não
    // está no sistema. Aceitar aqui gravaria R$ 170 como preço de um ovo.
    const catalogo: ProdutoResumo[] = [
      { id: "o1", nome: "OVOS GRANDE BRANCO UND", unidadeMedida: "UND", codigoTeknisa: "110030000604" },
    ];
    const r = resolverLinhaCompraPura({ nome: "x", unidadeMedida: "CX", codigo: "110030000604" }, montarIndiceProdutos(catalogo));
    expect(r.via).toBeNull();
    expect(r.motivo).toBe("UNIDADE_DIVERGENTE");
  });

  it("converte quando alguém já disse quanto vale a embalagem", () => {
    const catalogo: ProdutoResumo[] = [
      { id: "m1", nome: "MICROVERDE KG", unidadeMedida: "KG", codigoTeknisa: "110010013603" },
      { id: "o1", nome: "OVOS GRANDE BRANCO UND", unidadeMedida: "UND", codigoTeknisa: "110030000604" },
    ];
    const idx = montarIndiceProdutos(catalogo, [
      { produtoId: "m1", unidadeCompra: "UND", fator: 0.04 }, // bandeja de 40 g
      { produtoId: "o1", unidadeCompra: "CX", fator: 360 },   // caixa de 360 ovos
    ]);

    const bandeja = resolverLinhaCompraPura({ nome: "x", unidadeMedida: "UND", codigo: "110010013603" }, idx);
    expect(bandeja.via).toBe("CODIGO");
    expect(bandeja.fatorConversao).toBe(0.04);
    // R$ 15 a bandeja de 40 g = R$ 375 o quilo.
    expect(15 / bandeja.fatorConversao).toBeCloseTo(375, 6);

    const caixa = resolverLinhaCompraPura({ nome: "x", unidadeMedida: "CX", codigo: "110030000604" }, idx);
    expect(caixa.fatorConversao).toBe(360);
    // R$ 170 a caixa = R$ 0,4722 o ovo, que é o preço já cadastrado.
    expect(170 / caixa.fatorConversao).toBeCloseTo(0.4722, 4);
  });

  it("fator zero ou negativo é ignorado, não obedecido", () => {
    // Dividir o preço por zero daria Infinity, e a entrada de estoque seria 0.
    // Cadastro ruim tem que cair no caminho seguro, que é recusar a linha.
    const catalogo: ProdutoResumo[] = [
      { id: "m1", nome: "MICROVERDE KG", unidadeMedida: "KG", codigoTeknisa: "110010013603" },
    ];
    for (const fator of [0, -1]) {
      const idx = montarIndiceProdutos(catalogo, [{ produtoId: "m1", unidadeCompra: "UND", fator }]);
      const r = resolverLinhaCompraPura({ nome: "x", unidadeMedida: "UND", codigo: "110010013603" }, idx);
      expect(r.motivo).toBe("UNIDADE_DIVERGENTE");
    }
  });

  it("conversão só vale pra unidade declarada — outra embalagem segue recusada", () => {
    const catalogo: ProdutoResumo[] = [
      { id: "m1", nome: "MICROVERDE KG", unidadeMedida: "KG", codigoTeknisa: "110010013603" },
    ];
    const idx = montarIndiceProdutos(catalogo, [{ produtoId: "m1", unidadeCompra: "UND", fator: 0.04 }]);
    const r = resolverLinhaCompraPura({ nome: "x", unidadeMedida: "CX", codigo: "110010013603" }, idx);
    expect(r.motivo).toBe("UNIDADE_DIVERGENTE");
  });

  it("não encontra quando nome e código são desconhecidos", () => {
    const r = resolverLinhaCompraPura(
      { nome: "COISA QUE NAO EXISTE", unidadeMedida: "KG", codigo: "100000088888" },
      indice
    );
    expect(r.via).toBeNull();
    expect(r.motivo).toBe("NAO_ENCONTRADO");
    expect(r.produto).toBeNull();
  });

  it("código desconhecido não impede o casamento por nome", () => {
    // Produto novo no Teknisa, já cadastrado aqui: casa por nome e o código
    // vira sugestão — que é como o pareamento se alimenta sozinho.
    const r = resolverLinhaCompraPura(
      { nome: "AGUA COM GAS", unidadeMedida: "UND", codigo: "100000077777" },
      indice
    );
    expect(r.via).toBe("NOME");
    expect(r.codigoSugerido).toBe("100000077777");
  });
});

// ---------------------------------------------------------------------------
// CodigoCompraProduto — um produto, vários códigos.
//
// Estes testes rodam contra o índice novo, que a rota só passa a carregar
// depois de a tabela existir no banco. Até lá `codigosCompra` chega vazio e
// nada aqui muda o comportamento de produção — o primeiro teste deste bloco é
// exatamente essa garantia.
// ---------------------------------------------------------------------------
describe("resolverLinhaCompraPura com CodigoCompraProduto", () => {
  const LEITE: ProdutoResumo = { id: "l1", nome: "Leite integral", unidadeMedida: "LT", codigoTeknisa: "105060008520" };
  const OVOS: ProdutoResumo = { id: "o1", nome: "OVOS GRANDE BRANCO UND", unidadeMedida: "UND", codigoTeknisa: "110030000604" };

  it("índice vazio se comporta exatamente como antes da tabela existir", () => {
    // A garantia que permite este código ir pra produção antes da migração.
    const semTabela = montarIndiceProdutos([LEITE]);
    const comTabelaVazia = montarIndiceProdutos([LEITE], [], []);
    const linha = { nome: "LEITE INTEGRAL PIRACANJUBA 12X1L (COMPRA)", unidadeMedida: "CX", codigo: "105060008521" };
    expect(resolverLinhaCompraPura(linha, comTabelaVazia)).toEqual(resolverLinhaCompraPura(linha, semTabela));
    expect(resolverLinhaCompraPura(linha, comTabelaVazia).motivo).toBe("NAO_ENCONTRADO");
  });

  it("o caso que motivou a tabela: dois códigos do Teknisa, um produto só", () => {
    // O litro é 105060008520 e a caixa com doze é 105060008521. Com
    // codigoTeknisa cabia um; o outro ficava eternamente sem casar, e criar um
    // segundo "Leite integral 12x1L" quebraria as fichas que usam o primeiro.
    const idx = montarIndiceProdutos([LEITE], [], [
      { codigo: "105060008520", produtoId: "l1", unidadeCompra: "LT", fator: 1 },
      { codigo: "105060008521", produtoId: "l1", unidadeCompra: "CX", fator: 12 },
    ]);

    const litro = resolverLinhaCompraPura({ nome: "LEITE INTEGRAL 1L", unidadeMedida: "LT", codigo: "105060008520" }, idx);
    expect(litro.via).toBe("CODIGO");
    expect(litro.produto?.id).toBe("l1");
    expect(litro.fatorConversao).toBe(1);

    const caixa = resolverLinhaCompraPura({ nome: "LEITE ... 12X1L (COMPRA)", unidadeMedida: "CX", codigo: "105060008521" }, idx);
    expect(caixa.via).toBe("CODIGO");
    expect(caixa.produto?.id).toBe("l1");
    expect(caixa.fatorConversao).toBe(12);
    // R$ 71,88 a caixa = R$ 5,99 o litro, comparável com o preço do litro
    // avulso — que é o ponto inteiro do fator.
    expect(71.88 / caixa.fatorConversao).toBeCloseTo(5.99, 6);
  });

  it("o MESMO código em duas unidades continua casando nas duas", () => {
    // Regressão do erro que quase entrou no script de migração: a primeira
    // versão trocava a unidade da linha migrada em vez de acrescentar outra, e
    // o ovo avulso — que casa hoje — pararia de casar.
    const idx = montarIndiceProdutos([OVOS], [], [
      { codigo: "110030000604", produtoId: "o1", unidadeCompra: "UND", fator: 1 },
      { codigo: "110030000604", produtoId: "o1", unidadeCompra: "CX", fator: 360 },
    ]);
    expect(resolverLinhaCompraPura({ nome: "x", unidadeMedida: "UND", codigo: "110030000604" }, idx).fatorConversao).toBe(1);
    expect(resolverLinhaCompraPura({ nome: "x", unidadeMedida: "CX", codigo: "110030000604" }, idx).fatorConversao).toBe(360);
  });

  it("unidade não declarada segue recusada, mesmo com o código conhecido", () => {
    // Preço de embalagem não vira preço de unidade porque alguém esqueceu de
    // cadastrar o fator. É a trava de sempre.
    const idx = montarIndiceProdutos([OVOS], [], [
      { codigo: "110030000604", produtoId: "o1", unidadeCompra: "UND", fator: 1 },
    ]);
    const r = resolverLinhaCompraPura({ nome: "x", unidadeMedida: "CX", codigo: "110030000604" }, idx);
    expect(r.via).toBeNull();
    expect(r.motivo).toBe("UNIDADE_DIVERGENTE");
    // O produto vem junto pra que o relatório diga de qual item se trata.
    expect(r.produto?.id).toBe("o1");
  });

  it("sinônimo de unidade vale na tabela nova também", () => {
    // Cadastrado em UND, a nota manda GF. É a mesma contagem.
    const idx = montarIndiceProdutos(
      [{ id: "v1", nome: "GRAN LEGADO", unidadeMedida: "UND", codigoTeknisa: null }],
      [],
      [{ codigo: "900001000349", produtoId: "v1", unidadeCompra: "UND", fator: 1 }]
    );
    expect(resolverLinhaCompraPura({ nome: "x", unidadeMedida: "GF", codigo: "900001000349" }, idx).via).toBe("CODIGO");
  });

  it("código em dois produtos é recusado, não desempatado", () => {
    // A chave única é (origem, código, unidade), então o banco não impede
    // isto. Escolher um gravaria preço num produto e deixaria o outro sem, em
    // silêncio — que é o erro que este arquivo inteiro existe pra evitar.
    const idx = montarIndiceProdutos(
      [LEITE, { id: "l2", nome: "Leite desnatado", unidadeMedida: "LT", codigoTeknisa: null }],
      [],
      [
        { codigo: "105060008520", produtoId: "l1", unidadeCompra: "LT", fator: 1 },
        { codigo: "105060008520", produtoId: "l2", unidadeCompra: "CX", fator: 12 },
      ]
    );
    const r = resolverLinhaCompraPura({ nome: "x", unidadeMedida: "LT", codigo: "105060008520" }, idx);
    expect(r.via).toBeNull();
    expect(r.motivo).toBe("CODIGO_AMBIGUO");
    expect(r.produto).toBeNull();
  });

  it("origens diferentes não se misturam", () => {
    // Beira Lago e CPD compram pelo XMenu, cujo espaço de código é outro: nada
    // garante que "1042" de lá não seja "1042" do Teknisa. Sem a origem na
    // chave, uma casa gravaria preço no produto da outra.
    const idx = montarIndiceProdutos(
      [
        { id: "t1", nome: "Farinha de trigo", unidadeMedida: "KG", codigoTeknisa: null },
        { id: "x1", nome: "Cerveja long neck", unidadeMedida: "UND", codigoTeknisa: null },
      ],
      [],
      [
        { origem: "TEKNISA", codigo: "1042", produtoId: "t1", unidadeCompra: "KG", fator: 1 },
        { origem: "XMENU", codigo: "1042", produtoId: "x1", unidadeCompra: "UND", fator: 1 },
      ]
    );
    expect(resolverLinhaCompraPura({ nome: "x", unidadeMedida: "KG", codigo: "1042" }, idx).produto?.id).toBe("t1");
    expect(resolverLinhaCompraPura({ nome: "x", unidadeMedida: "UND", codigo: "1042", origem: "XMENU" }, idx).produto?.id).toBe("x1");
    // Sem origem declarada, vale o Teknisa — as três casas de hoje.
    expect(resolverLinhaCompraPura({ nome: "x", unidadeMedida: "UND", codigo: "1042" }, idx).motivo).toBe("UNIDADE_DIVERGENTE");
  });

  it("a tabela nova tem precedência sobre codigoTeknisa", () => {
    // Durante a transição os dois existem. Se discordarem, manda a tabela
    // nova: é ela que foi revisada por gente no pareamento.
    const idx = montarIndiceProdutos(
      [LEITE, { id: "l3", nome: "Leite outro", unidadeMedida: "LT", codigoTeknisa: null }],
      [],
      [{ codigo: "105060008520", produtoId: "l3", unidadeCompra: "LT", fator: 1 }]
    );
    expect(resolverLinhaCompraPura({ nome: "x", unidadeMedida: "LT", codigo: "105060008520" }, idx).produto?.id).toBe("l3");
  });

  it("fator zero na tabela nova é ignorado, não obedecido", () => {
    const idx = montarIndiceProdutos([LEITE], [], [
      { codigo: "105060008521", produtoId: "l1", unidadeCompra: "CX", fator: 0 },
    ]);
    const r = resolverLinhaCompraPura({ nome: "x", unidadeMedida: "CX", codigo: "105060008521" }, idx);
    // Linha ignorada: cai no caminho de sempre, e lá o código é desconhecido.
    expect(r.via).toBeNull();
    expect(r.motivo).toBe("NAO_ENCONTRADO");
  });

  it("código de produto fora do catálogo carregado é ignorado", () => {
    const idx = montarIndiceProdutos([LEITE], [], [
      { codigo: "999999999999", produtoId: "fantasma", unidadeCompra: "LT", fator: 1 },
    ]);
    expect(resolverLinhaCompraPura({ nome: "x", unidadeMedida: "LT", codigo: "999999999999" }, idx).motivo).toBe("NAO_ENCONTRADO");
  });
});

describe("conversão no casamento por NOME (o caminho do XMenu, que não manda código)", () => {
  // O XMenu do Beira Lago não manda código nenhum — ver docs/n8n/contrato-integracao.md.
  // Até 20/10/2026 a conversão só era consultada no caminho do CÓDIGO, então
  // cadastrar uma ConversaoUnidadeCompra pra essas linhas não fazia efeito
  // nenhum: elas voltavam como "não reconhecidas" para sempre, caladas.
  const catalogo: ProdutoResumo[] = [
    { id: "ap", nome: "APERITIVO APEROL 750ML", unidadeMedida: "UND", codigoTeknisa: null },
    { id: "ca", nome: "CASTANHA DE CAJU TORRADA SEM SAL", unidadeMedida: "UND", codigoTeknisa: null },
    { id: "ac", nome: "ACELGA", unidadeMedida: "LT", codigoTeknisa: null },
  ];

  it("casa por nome em outra unidade quando a conversão existe", () => {
    const idx = montarIndiceProdutos(catalogo, [
      { produtoId: "ap", unidadeCompra: "LT", fator: 1.3333 }, // 1 litro = 1,3333 garrafas de 750ml
      { produtoId: "ca", unidadeCompra: "KG", fator: 1 },      // pacote de 1 kg
    ]);

    const aperol = resolverLinhaCompraPura({ nome: "APERITIVO APEROL 750ML", unidadeMedida: "LT" }, idx);
    expect(aperol.via).toBe("NOME");
    expect(aperol.produto?.id).toBe("ap");
    expect(aperol.fatorConversao).toBe(1.3333);
    // 4,5 LT viram 6 garrafas, e R$ 79,83 o litro vira R$ 59,87 a garrafa.
    expect(4.5 * aperol.fatorConversao).toBeCloseTo(6, 3);
    expect(79.83 / aperol.fatorConversao).toBeCloseTo(59.87, 2);

    const castanha = resolverLinhaCompraPura(
      { nome: "CASTANHA DE CAJU TORRADA SEM SAL", unidadeMedida: "KG" },
      idx
    );
    expect(castanha.via).toBe("NOME");
    expect(castanha.fatorConversao).toBe(1);
  });

  it("SEM conversão declarada, nome em outra unidade continua não casando", () => {
    // É a regra que impede preço de caixa virar preço de quilo. A acelga está
    // cadastrada em LT e a compra vem em KG, sem ninguém ter dito quanto vale
    // um pelo outro — porque não vale: é erro de cadastro, não embalagem.
    const idx = montarIndiceProdutos(catalogo, []);
    const r = resolverLinhaCompraPura({ nome: "ACELGA", unidadeMedida: "KG" }, idx);
    expect(r.produto).toBeNull();
    expect(r.motivo).toBe("NAO_ENCONTRADO");
  });

  it("nome igual em dois produtos, os dois com conversão: recusa em vez de escolher", () => {
    const dois: ProdutoResumo[] = [
      { id: "a", nome: "AZEITE", unidadeMedida: "LT", codigoTeknisa: null },
      { id: "b", nome: "AZEITE", unidadeMedida: "UND", codigoTeknisa: null },
    ];
    const idx = montarIndiceProdutos(dois, [
      { produtoId: "a", unidadeCompra: "CX", fator: 12 },
      { produtoId: "b", unidadeCompra: "CX", fator: 6 },
    ]);
    const r = resolverLinhaCompraPura({ nome: "AZEITE", unidadeMedida: "CX" }, idx);
    expect(r.produto).toBeNull();
    expect(r.motivo).toBe("CONVERSAO_AMBIGUA");
  });

  it("o caminho exato continua ganhando do caminho da conversão", () => {
    // Produto na unidade certa existe: a conversão não deve ser nem olhada,
    // e o fator tem que ser 1.
    const idx = montarIndiceProdutos(
      [...catalogo, { id: "ap-lt", nome: "APERITIVO APEROL 750ML", unidadeMedida: "LT", codigoTeknisa: null }],
      [{ produtoId: "ap", unidadeCompra: "LT", fator: 1.3333 }]
    );
    const r = resolverLinhaCompraPura({ nome: "APERITIVO APEROL 750ML", unidadeMedida: "LT" }, idx);
    expect(r.produto?.id).toBe("ap-lt");
    expect(r.fatorConversao).toBe(1);
  });
});

describe("unidade crua no cadastro do produto", () => {
  // Apareceu no Wine Garden: 15 linhas voltaram UNIDADE_DIVERGENTE com a MESMA
  // unidade escrita dos dois lados — "GA x GA", "BOB x BOB". A tabela de
  // sinônimos mapeia GA->CX e BOB->UND, e o casamento normalizava só o lado da
  // NOTA. O produto gravado com a grafia crua ficava indexado sob ela e a busca
  // perguntava pela canônica: nunca se encontravam.
  const produto = (nome: string, unidadeMedida: string, codigoTeknisa: string | null = null) => ({
    id: nome,
    nome,
    unidadeMedida,
    codigoTeknisa,
  });

  it("casa por NOME quando o produto está em GA e a nota em GA", () => {
    const indice = montarIndiceProdutos([produto("DESINFETANTE AZULIM 5L", "GA")]);
    const r = resolverLinhaCompraPura(
      { nome: "DESINFETANTE AZULIM 5L", unidadeMedida: "GA", codigo: null },
      indice
    );
    expect(r.produto?.id).toBe("DESINFETANTE AZULIM 5L");
    expect(r.motivo).toBe(null);
  });

  it("casa por CÓDIGO quando o produto está em BOB e a nota em BOB", () => {
    const indice = montarIndiceProdutos([produto("PLASTICO FILME PVC", "BOB", "120000006104")]);
    const r = resolverLinhaCompraPura(
      { nome: "qualquer outro nome", unidadeMedida: "BOB", codigo: "120000006104" },
      indice
    );
    expect(r.produto?.id).toBe("PLASTICO FILME PVC");
    expect(r.via).toBe("CODIGO");
  });

  it("continua RECUSANDO quando a unidade diverge de verdade", () => {
    // O GLP veio em KG/M³ contra um produto em KG: isso é divergência real, e
    // preço de metro cúbico não pode virar preço de quilo.
    const indice = montarIndiceProdutos([produto("GLP EM CILINDRO", "KG", "125000000000")]);
    const r = resolverLinhaCompraPura(
      { nome: "GLP EM CILINDRO", unidadeMedida: "KG/M³", codigo: "125000000000" },
      indice
    );
    expect(r.motivo).toBe("UNIDADE_DIVERGENTE");
  });

  it("não muda nada para catálogo já canônico", () => {
    const indice = montarIndiceProdutos([produto("ARROZ", "CX", "1")]);
    expect(
      resolverLinhaCompraPura({ nome: "ARROZ", unidadeMedida: "CX", codigo: "1" }, indice).produto?.id
    ).toBe("ARROZ");
    expect(
      resolverLinhaCompraPura({ nome: "ARROZ", unidadeMedida: "KG", codigo: "1" }, indice).motivo
    ).toBe("UNIDADE_DIVERGENTE");
  });
});
