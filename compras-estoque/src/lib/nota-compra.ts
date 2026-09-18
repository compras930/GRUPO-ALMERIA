// Lógica da automação 1 (preço automático via n8n): recebe a planilha
// "última compra" do Teknisa, casa cada linha contra o catálogo de Produto
// pelo código do Teknisa e, na falta dele, por nome exato (nunca por
// aproximação, mesmo princípio já usado nas outras importações desta base —
// ver src/lib/resolucao-produto-compra.ts), atualiza PrecoAtualProduto/
// HistoricoPrecoProduto respeitando "só sobrescreve se a data for mais
// recente", e reporta quais ItemVenda foram impactados (em cascata, via
// sub-receita) comparando o custo antes/depois da atualização.
import { prisma } from "@/lib/prisma";
import { normalizarNome } from "@/lib/nome-normalizado";
import { idDaUnidadeFisica, casasDaUnidadeFisica } from "@/lib/unidade-fisica";
import {
  montarIndiceProdutos,
  resolverLinhaCompraPura,
  normalizarCodigo,
  normalizarUnidade,
  type MotivoNaoCasou,
} from "@/lib/resolucao-produto-compra";
import {
  carregarIndiceReceitas,
  carregarPrecoAtualPorProduto,
  receitasAfetadasPor,
  explodirReceitaPura,
  type IndiceReceitas,
} from "@/lib/receita";

export type ItemPrecoInput = {
  nome: string;
  unidadeMedida: string;
  preco: number;
  dataCompra: string;
  /** Código do produto no Teknisa. Opcional: origem antiga não manda. */
  codigo?: string | null;
  /** Quantidade comprada. Quando vem, a linha também dá entrada de estoque. */
  quantidade?: number | null;
  valorTotal?: number | null;
  /**
   * Chave da linha na origem (coluna `chave` da base do Drive). Quando vem, a
   * linha já carregada antes é reconhecida e pulada — é o que deixa recarregar
   * sem inflar o saldo. Sem ela, a carga continua funcionando, mas só pra
   * preço: sem identidade de linha não há como entrar estoque com segurança.
   */
  chave?: string | null;
};

export type ResultadoNotaCompra = {
  notaCompraId: string;
  totalRecebido: number;
  precosAtualizados: number;
  precosIgnoradosMaisAntigos: number;
  /** Quantas linhas casaram pelo código do Teknisa e quantas só pelo nome. */
  casadosPorCodigo: number;
  casadosPorNome: number;
  /** Linhas ignoradas por já terem sido carregadas antes (mesma `chave`). */
  linhasJaCarregadas: number;
  /** Produtos que ganharam saldo, e o total somado. */
  entradasDeEstoque: { produtos: number; quantidadeTotal: number };
  /**
   * Casou por nome, o produto não tem código gravado e a linha trouxe um.
   * É esta lista que faz o pareamento se alimentar sozinho, uma carga de cada
   * vez. Só vira escrita se quem chamou pedir (`aprenderCodigos`).
   */
  codigosSugeridos: { produtoId: string; nome: string; unidadeMedida: string; codigo: string }[];
  /** Quantos códigos foram efetivamente gravados (0 quando `aprenderCodigos` é falso). */
  codigosGravados: number;
  /** Sugestão que não virou gravação, e por quê. */
  codigosNaoGravados: { nome: string; codigo: string; motivo: string }[];
  /**
   * Linha que tinha como casar mas foi recusada por contradição — código
   * diferente do cadastrado, ou unidade diferente da do produto. Não vira
   * preço; precisa de gente.
   */
  recusadasPorCodigo: {
    motivo: MotivoNaoCasou;
    nomeNaPlanilha: string;
    unidadeNaPlanilha: string;
    codigoNaPlanilha: string | null;
    produtoNome: string;
    produtoUnidade: string;
    produtoCodigo: string | null;
  }[];
  /**
   * Preços recusados por salto absurdo contra o preço atual — quase sempre
   * unidade trocada na origem (preço da caixa contra um `un` que diz KG).
   * Não foram gravados; precisam de olho humano. Ver LIMITE_SALTO_PRECO.
   */
  precosSuspeitos: {
    nome: string;
    unidadeMedida: string;
    precoAtual: number;
    precoRecebido: number;
    razao: number;
  }[];
  naoReconhecidos: ItemPrecoInput[];
  itensImpactados: {
    itemVendaId: string;
    nome: string;
    tipo: string;
    custoAntes: number | null;
    custoDepois: number | null;
    cmvAntes: number | null;
    cmvDepois: number | null;
  }[];
};

/**
 * Quantas vezes o preço pode saltar, pra mais ou pra menos, antes de ser
 * recusado. 5x é folgado pra reajuste real de insumo (inclusive sazonal, tipo
 * tomate na entressafra) e apertado pra erro de unidade, que erra por 10x,
 * 12x ou 1000x.
 */
const LIMITE_SALTO_PRECO = 5;

/**
 * Custo de uma receita a partir de um mapa de preços já carregado (não bate
 * no banco) — mesma fórmula de custoReceita (src/lib/receita.ts), só que
 * recebendo o mapa como parâmetro pra poder rodar com precosAntes E
 * precosDepois sem ida nenhuma ao banco entre as duas.
 */
function custoComPrecos(receitaId: string, indice: IndiceReceitas, precos: Map<string, number>): number | null {
  const receita = indice.get(receitaId);
  const qtdBase = receita?.rendimentoQtd && receita.rendimentoQtd > 0 ? receita.rendimentoQtd : 1;
  try {
    const insumos = explodirReceitaPura(receitaId, qtdBase, indice);
    let custoLote = 0;
    for (const [produtoId, qtd] of insumos) custoLote += qtd * (precos.get(produtoId) ?? 0);
    return receita?.rendimentoQtd ? custoLote / receita.rendimentoQtd : custoLote;
  } catch {
    return null; // ciclo — não deveria acontecer aqui (item já apareceria com status CICLO na tela de CMV), mas não trava o relatório
  }
}

export async function processarNotaCompra(
  unidadeNome: string,
  arquivoNome: string | null,
  itens: ItemPrecoInput[],
  importadoPorId: string,
  /**
   * Grava o código do Teknisa no Produto quando a linha casou por nome+unidade
   * exatos e o produto ainda não tem código.
   *
   * Por que isto é um parâmetro e não o padrão: aprender identificador a partir
   * de texto é exatamente o atalho que resolucao-produto-compra.ts existe pra
   * evitar. Aqui ele é aceitável porque o casamento por nome+unidade é o mesmo
   * que já autoriza gravar PREÇO naquele produto — quem confia num pra mudar
   * dinheiro não tem motivo pra desconfiar do outro pra gravar um número. Mas
   * é uma escrita de cadastro, não de movimento, e quem chama tem que pedir.
   *
   * Nunca sobrescreve código existente, e nunca grava um código que já está em
   * outro produto: nesses dois casos a sugestão vai pra `codigosNaoGravados` e
   * alguém olha.
   */
  aprenderCodigos = false
): Promise<ResultadoNotaCompra> {
  const unidade = await prisma.unidade.findUnique({ where: { nome: unidadeNome } });
  if (!unidade) throw new Error(`Unidade "${unidadeNome}" não encontrada.`);

  // A nota é da DESPENSA, não da casa: se a nota vier lançada como "Matri",
  // ela pertence ao estoque do Noroeste, que é onde a mercadoria entra.
  const unidadeFisicaId = await idDaUnidadeFisica(unidade.id);
  // ...e o custo que ela mexe é o das fichas de TODAS as casas dessa despensa.
  const casas = await casasDaUnidadeFisica(unidadeFisicaId);

  const produtos = await prisma.produto.findMany({
    select: { id: true, nome: true, unidadeMedida: true, codigoTeknisa: true },
  });
  const indiceProdutos = montarIndiceProdutos(produtos);

  // Snapshot do índice/preços ANTES de qualquer escrita, pra poder comparar
  // custo antes/depois sem precisar de uma segunda ida ao banco no final.
  // carregarIndiceReceitas já cobre a cozinha inteira (as duas casas, quando
  // for o caso), então uma chamada basta.
  const [indice, precosAntes] = await Promise.all([
    carregarIndiceReceitas(unidadeFisicaId),
    carregarPrecoAtualPorProduto(unidadeFisicaId),
  ]);

  // Linha já carregada antes é pulada ANTES de qualquer escrita. Uma consulta
  // só, pelas chaves que vieram — o índice único em chaveOrigem faria o
  // trabalho de qualquer jeito, mas falhando a carga inteira em vez de pular a
  // linha repetida, que é o que a gente quer.
  const chavesRecebidas = itens.map((i) => normalizarCodigo(i.chave)).filter((c): c is string => !!c);
  const chavesJaGravadas = new Set(
    chavesRecebidas.length === 0
      ? []
      : (
          await prisma.itemNotaCompra.findMany({
            where: { chaveOrigem: { in: chavesRecebidas } },
            select: { chaveOrigem: true },
          })
        ).map((i) => i.chaveOrigem!)
  );
  const itensNovos = itens.filter((i) => {
    const c = normalizarCodigo(i.chave);
    return !c || !chavesJaGravadas.has(c);
  });
  const linhasJaCarregadas = itens.length - itensNovos.length;

  // Entrada de estoque é somada por PRODUTO, não gravada linha a linha: a mesma
  // compra aparece várias vezes no mês e um upsert por linha multiplicaria as
  // idas ao banco por dez sem mudar o resultado.
  const entradaPorProduto = new Map<string, number>();

  const naoReconhecidos: ItemPrecoInput[] = [];
  const produtosAlterados = new Set<string>();
  const precosDepois = new Map(precosAntes);
  let precosAtualizados = 0;
  let precosIgnoradosMaisAntigos = 0;
  let casadosPorCodigo = 0;
  let casadosPorNome = 0;
  const precosSuspeitos: ResultadoNotaCompra["precosSuspeitos"] = [];
  const recusadasPorCodigo: ResultadoNotaCompra["recusadasPorCodigo"] = [];
  // Chaveado por produtoId: a mesma compra aparece várias vezes no mês e a
  // sugestão é sempre a mesma — não vale repetir na resposta.
  const codigosSugeridos = new Map<string, ResultadoNotaCompra["codigosSugeridos"][number]>();
  const codigosNaoGravados: ResultadoNotaCompra["codigosNaoGravados"] = [];
  let codigosGravados = 0;

  const notaCompraId = await prisma.$transaction(async (tx) => {
    const notaCompra = await tx.notaCompra.create({
      data: { unidadeId: unidadeFisicaId, arquivoNome: arquivoNome ?? "n8n", importadoPorId },
    });

    for (const item of itensNovos) {
      const resolucao = resolverLinhaCompraPura(item, indiceProdutos);
      const dataCompra = new Date(item.dataCompra);
      const codigoBruto = normalizarCodigo(item.codigo);
      const unidadeBruta = normalizarUnidade(item.unidadeMedida);
      const chaveOrigem = normalizarCodigo(item.chave);
      const quantidade = typeof item.quantidade === "number" && item.quantidade > 0 ? item.quantidade : null;
      const valorTotal = typeof item.valorTotal === "number" ? item.valorTotal : null;

      // Toda linha que não virou preço é gravada em ItemNotaCompra sem
      // produtoId — inclusive as recusadas por contradição de código. A linha
      // nunca é descartada em silêncio, e com codigoBruto/unidadeBruta dá pra
      // montar depois a lista de pareamento sem voltar na planilha.
      if (!resolucao.produto || resolucao.via === null) {
        if (resolucao.produto && resolucao.motivo) {
          recusadasPorCodigo.push({
            motivo: resolucao.motivo,
            nomeNaPlanilha: normalizarNome(item.nome),
            unidadeNaPlanilha: unidadeBruta,
            codigoNaPlanilha: codigoBruto,
            produtoNome: resolucao.produto.nome,
            produtoUnidade: resolucao.produto.unidadeMedida,
            produtoCodigo: resolucao.produto.codigoTeknisa,
          });
        } else {
          naoReconhecidos.push(item);
        }
        await tx.itemNotaCompra.create({
          data: {
            notaCompraId: notaCompra.id,
            produtoId: null,
            nomeBruto: normalizarNome(item.nome),
            codigoBruto,
            unidadeBruta,
            quantidade,
            valorTotal,
            chaveOrigem,
            precoUnitNovo: item.preco,
            dataCompra,
          },
        });
        continue;
      }

      const produto = resolucao.produto;
      if (resolucao.via === "CODIGO") casadosPorCodigo++;
      else casadosPorNome++;
      if (resolucao.codigoSugerido && !codigosSugeridos.has(produto.id)) {
        codigosSugeridos.set(produto.id, {
          produtoId: produto.id,
          nome: produto.nome,
          unidadeMedida: produto.unidadeMedida,
          codigo: resolucao.codigoSugerido,
        });
      }

      const existente = await tx.precoAtualProduto.findUnique({
        where: { unidadeId_produtoId: { unidadeId: unidadeFisicaId, produtoId: produto.id } },
      });

      await tx.itemNotaCompra.create({
        data: {
          notaCompraId: notaCompra.id,
          produtoId: produto.id,
          nomeBruto: normalizarNome(item.nome),
          codigoBruto,
          unidadeBruta,
          quantidade,
          valorTotal,
          chaveOrigem,
          precoUnitNovo: item.preco,
          precoUnitAnterior: existente?.preco ?? null,
          dataCompra,
        },
      });

      // O salto de preço é avaliado ANTES da entrada de estoque, e não só
      // antes da gravação do preço: quando o preço salta 10x é porque a linha
      // está na unidade errada, e aí a QUANTIDADE também está. Dez fardos
      // entrando como dez quilos estraga o saldo do mesmo jeito que o preço.
      const razao = existente && existente.preco > 0 ? item.preco / existente.preco : 1;
      const precoSuspeito = razao >= LIMITE_SALTO_PRECO || razao <= 1 / LIMITE_SALTO_PRECO;

      // Entrada de estoque não depende da data: mercadoria que entrou, entrou.
      // A regra "só se for mais recente" é do PREÇO, não do saldo.
      if (quantidade && !precoSuspeito) {
        entradaPorProduto.set(produto.id, (entradaPorProduto.get(produto.id) ?? 0) + quantidade);
      }

      if (existente && existente.dataCompra >= dataCompra) {
        precosIgnoradosMaisAntigos++;
        continue;
      }

      // Salto absurdo de preço não é reajuste, é unidade trocada. O
      // `valorUnitario` do Teknisa às vezes traz o preço da CAIXA contra um
      // `un` que diz KG — visto no dado real de setembro/2026: BATATA SURECRISP
      // 7MM a R$ 18,55/kg numa casa e R$ 228,00/kg na outra, MANTEIGA S/SAL a
      // R$ 174,50/kg, LINGUIÇA CALABRESA a R$ 293,85/kg.
      //
      // Gravar isso multiplicaria o custo de toda ficha que usa o insumo, e o
      // erro seria invisível: o número tem a mesma cara de um preço. Preço de
      // insumo raramente muda 5x entre duas compras; quando muda, é erro de
      // cadastro ou de unidade, e vale mais a pena travar e reportar do que
      // gravar e alguém descobrir pelo CMV meses depois.
      //
      // Só vale contra preço POSITIVO já existente: produto novo não tem
      // referência, então entra e aparece na primeira conferência.
      if (precoSuspeito && existente) {
        precosSuspeitos.push({
          nome: produto.nome,
          unidadeMedida: item.unidadeMedida,
          precoAtual: existente.preco,
          precoRecebido: item.preco,
          razao: Number(razao.toFixed(1)),
        });
        continue;
      }

      await tx.precoAtualProduto.upsert({
        where: { unidadeId_produtoId: { unidadeId: unidadeFisicaId, produtoId: produto.id } },
        update: { preco: item.preco, dataCompra },
        create: { unidadeId: unidadeFisicaId, produtoId: produto.id, preco: item.preco, dataCompra },
      });
      await tx.historicoPrecoProduto.create({
        data: { unidadeId: unidadeFisicaId, produtoId: produto.id, preco: item.preco, origem: "NOTA_COMPRA", origemId: notaCompra.id, dataCompra },
      });

      precosAtualizados++;
      produtosAlterados.add(produto.id);
      precosDepois.set(produto.id, item.preco);
    }

    // Entrada de estoque: um upsert e um movimento por PRODUTO, com a soma do
    // que veio na carga. Gravar linha a linha multiplicaria as idas ao banco
    // sem mudar o saldo final, e é justamente dentro da transação que isso
    // custa caro.
    for (const [produtoId, quantidadeEntrada] of entradaPorProduto) {
      await tx.estoqueSaldo.upsert({
        where: { unidadeId_produtoId: { unidadeId: unidadeFisicaId, produtoId } },
        update: { quantidade: { increment: quantidadeEntrada } },
        create: { unidadeId: unidadeFisicaId, produtoId, quantidade: quantidadeEntrada },
      });
      await tx.movimentoEstoque.create({
        data: {
          unidadeId: unidadeFisicaId,
          produtoId,
          tipo: "ENTRADA_NOTA",
          quantidade: quantidadeEntrada,
          referencia: notaCompra.id,
          observacao: `Entrada pela nota do Teknisa (${arquivoNome ?? "n8n"})`,
        },
      });
    }

    return notaCompra.id;
  }, { timeout: 60_000 });

  // Aprender código roda FORA da transação da nota, e cada UPDATE sozinho.
  //
  // POR QUE, com sangue: na primeira tentativa isto estava dentro da
  // transação, e a carga morreu com "deadlock detected" (18/09/2026). Preço é
  // por casa — cada carga mexe nas SUAS linhas de PrecoAtualProduto, então duas
  // casas simultâneas nunca se encontram. Produto é do grupo inteiro: as duas
  // casas compram ALCATRA, SALMÃO, AZEITE. Com as duas cargas abertas ao mesmo
  // tempo (o n8n dispara um POST por casa em paralelo), cada transação segurava
  // um punhado dessas linhas e pedia as que a outra segurava — e o Postgres
  // mata uma das duas pra desatar o nó.
  //
  // Um UPDATE sozinho, sem transação em volta, segura uma linha de cada vez e
  // solta na hora: não há como formar ciclo de espera. A ordenação por id é
  // cinto de segurança em cima disso.
  //
  // O custo de não ser atômico com a nota é aceitável: código de produto é
  // cadastro, não movimento. Se metade gravar e a conexão cair, a carga
  // seguinte grava o resto — é idempotente por construção (só grava onde está
  // nulo).
  if (aprenderCodigos && codigosSugeridos.size > 0) {
    const sugestoes = [...codigosSugeridos.values()].sort((a, b) => a.produtoId.localeCompare(b.produtoId));

    // Uma consulta só pra saber quais códigos já pertencem a alguém.
    const jaUsados = new Map(
      (
        await prisma.produto.findMany({
          where: { codigoTeknisa: { in: sugestoes.map((s) => s.codigo) } },
          select: { nome: true, codigoTeknisa: true },
        })
      ).map((p) => [p.codigoTeknisa!, p.nome])
    );

    for (const s of sugestoes) {
      const dono = jaUsados.get(s.codigo);
      if (dono) {
        codigosNaoGravados.push({ nome: s.nome, codigo: s.codigo, motivo: `código já está no produto "${dono}"` });
        continue;
      }
      try {
        // `codigoTeknisa: null` no where: se outra carga gravou um código nesse
        // produto no meio do caminho, esta não sobrescreve.
        const r = await prisma.produto.updateMany({
          where: { id: s.produtoId, codigoTeknisa: null },
          data: { codigoTeknisa: s.codigo },
        });
        if (r.count === 1) codigosGravados++;
        else codigosNaoGravados.push({ nome: s.nome, codigo: s.codigo, motivo: "produto já tinha código" });
      } catch (e: any) {
        // P2002 = a outra casa gravou este mesmo código entre o findMany acima
        // e este update. Não é erro da carga: é a corrida perdida, e o código
        // já está onde precisa estar.
        if (e?.code === "P2002") {
          codigosNaoGravados.push({ nome: s.nome, codigo: s.codigo, motivo: "outra carga gravou este código antes" });
        } else {
          throw e;
        }
      }
    }
  }

  // Custo/CMV impactados: calcula com precosAntes e precosDepois (em memória,
  // sem nova ida ao banco) pra todo ItemVenda cuja receita usa, direta ou
  // indiretamente, algum dos produtos que mudaram de preço.
  const receitasAfetadas = receitasAfetadasPor(produtosAlterados, indice);
  const itensImpactados: ResultadoNotaCompra["itensImpactados"] = [];
  if (receitasAfetadas.size > 0) {
    const itensVenda = await prisma.itemVenda.findMany({
      where: { unidadeId: { in: casas }, receitaId: { in: [...receitasAfetadas] } },
    });
    for (const item of itensVenda) {
      const antes = custoComPrecos(item.receitaId!, indice, precosAntes);
      const depois = custoComPrecos(item.receitaId!, indice, precosDepois);
      itensImpactados.push({
        itemVendaId: item.id,
        nome: item.nome,
        tipo: item.tipo,
        custoAntes: antes,
        custoDepois: depois,
        cmvAntes: antes !== null && item.precoVenda ? antes / item.precoVenda : null,
        cmvDepois: depois !== null && item.precoVenda ? depois / item.precoVenda : null,
      });
    }
  }

  return {
    notaCompraId,
    totalRecebido: itens.length,
    precosAtualizados,
    precosIgnoradosMaisAntigos,
    casadosPorCodigo,
    casadosPorNome,
    linhasJaCarregadas,
    entradasDeEstoque: {
      produtos: entradaPorProduto.size,
      quantidadeTotal: Number([...entradaPorProduto.values()].reduce((a, b) => a + b, 0).toFixed(3)),
    },
    codigosSugeridos: [...codigosSugeridos.values()],
    codigosGravados,
    codigosNaoGravados,
    recusadasPorCodigo,
    precosSuspeitos,
    naoReconhecidos,
    itensImpactados,
  };
}
