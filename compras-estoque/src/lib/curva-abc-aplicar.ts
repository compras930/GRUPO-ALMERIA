// Trocar a classificação ABC gravada pela recalculada — e dizer o que muda
// ANTES de mudar.
//
// POR QUE EXISTE. A curva do painel é recalculada na hora, sobre o mês que
// está na tela. A da FOLHA DE CONTAGEM é outra coisa: fica gravada em
// ParametroEstoqueProduto e decide o que a cozinha conta toda semana. A do
// Beira Lago foi definida uma vez, em 20/10, sobre 01/08–17/10, e desde então
// não se mexeu — então ela não conhece nada que entrou no cardápio depois.
// Insumo caro novo simplesmente não é contado, e ninguém é avisado.
//
// A JANELA É DE 3 MESES, e a escolha tem razão:
//
//   - um mês só dança: um evento grande joga vinho para dentro da curva A e
//     tira proteína, e a folha muda de cara toda semana. Lista que dança é
//     lista em que a cozinha não confia, e desconfiança vira contagem
//     apressada.
//   - o acumulado desde sempre fica surdo: daqui a um ano, agosto ainda
//     estaria pesando no que se conta amanhã.
//
// MOSTRA ANTES DE APLICAR. Trocar a folha de contagem muda o trabalho de
// outra pessoa. Quem decide tem que ver o que entra e o que sai — e
// principalmente o que SAI, porque item que deixa a curva some da folha sem
// fazer barulho.
//
// Núcleo puro: sem Prisma, sem I/O.

import { GRUPO_TODA_SEMANA } from "@/lib/contagem-rotacao";

export type ClasseAbc = "A" | "B" | "C";

/** O que está gravado hoje para um produto nesta casa. */
export type ClassificacaoAtual = {
  produtoId: string;
  classeAbc: string | null;
  grupoContagem: number | null;
};

/** O que a recalculada diz, para quem teve compra na janela. */
export type ClassificacaoNova = { produtoId: string; classe: ClasseAbc; valor: number };

export type LinhaDoPlano = {
  produtoId: string;
  de: string | null;
  para: ClasseAbc | null;
  grupoContagem: number | null;
  valor: number;
};

export type PlanoAbc = {
  /** Tudo que muda de classe. Vazio = a curva já está em dia. */
  mudancas: LinhaDoPlano[];
  /** Entra na curva A — passa a ser contado. */
  entramNaA: LinhaDoPlano[];
  /** Sai da curva A — deixa de ser contado toda semana. */
  saemDaA: LinhaDoPlano[];
  /** Classificado hoje, sem NENHUMA compra na janela. Vira C. */
  semCompraNaJanela: LinhaDoPlano[];
  /**
   * Classificado hoje, mas NÃO é estoque de despensa (ativo imobilizado, taxa,
   * serviço). Sai da folha — ver src/lib/escopo-contagem.ts.
   *
   * Lista própria porque o motivo é outro: "a casa parou de comprar" e "isto
   * nunca deveria estar aqui" pedem reações diferentes de quem lê.
   */
  foraDoEscopo: LinhaDoPlano[];
  /** Quantos ficam em cada classe depois de aplicar. */
  resumo: { A: number; B: number; C: number };
};

/**
 * Em que bloco da rotina cada item cai — ver src/lib/contagem-rotacao.ts.
 *
 * Curva A inteira TODA SEMANA, em todas as casas: grupo 0. Curva B em duas
 * metades, grupos 1 e 2, que se alternam a cada semana.
 *
 * Alterna pela POSIÇÃO na ordem de valor, não aleatoriamente: assim as duas
 * metades da B ficam com metade do dinheiro cada, em vez de uma levar os dez
 * itens mais caros e a outra o resto.
 */
function grupoDe(classe: ClasseAbc, posicaoNaClasse: number): number | null {
  if (classe === "A") return GRUPO_TODA_SEMANA;
  if (classe === "B") return (posicaoNaClasse % 2) + 1;
  return null; // curva C fica fora do rodízio, de propósito
}

export function planejarCurvaAbcPura(
  novas: ClassificacaoNova[],
  atuais: ClassificacaoAtual[],
  /** Produtos comprados que não são estoque de despensa. */
  foraDoEscopoIds: ReadonlySet<string> = new Set()
): PlanoAbc {
  const atualPorProduto = new Map(atuais.map((a) => [a.produtoId, a]));
  const novaPorProduto = new Map(novas.map((n) => [n.produtoId, n]));

  // Ordem por valor para a distribuição de grupos ser estável entre rodadas.
  const ordenadas = [...novas].sort((a, b) => b.valor - a.valor || a.produtoId.localeCompare(b.produtoId));
  const posicao: Record<ClasseAbc, number> = { A: 0, B: 0, C: 0 };

  const mudancas: LinhaDoPlano[] = [];
  const entramNaA: LinhaDoPlano[] = [];
  const saemDaA: LinhaDoPlano[] = [];
  const resumo = { A: 0, B: 0, C: 0 };

  for (const n of ordenadas) {
    const atual = atualPorProduto.get(n.produtoId);
    const grupo = grupoDe(n.classe, posicao[n.classe]++);
    resumo[n.classe]++;
    const linha: LinhaDoPlano = {
      produtoId: n.produtoId,
      de: atual?.classeAbc ?? null,
      para: n.classe,
      grupoContagem: grupo,
      valor: n.valor,
    };
    // MUDANÇA DE GRUPO TAMBÉM É MUDANÇA.
    //
    // Antes a comparação olhava só a classe, e por isso a troca de rotação de
    // 09/11 não teria efeito nenhum: a curva A continuava A, a B continuava B,
    // nada entrava em `mudancas`, e os grupos gravados (A em 1 e 2, B em 1 a 4)
    // ficariam intactos — a tela diria "a curva gravada já é a da janela" e a
    // folha continuaria com o rodízio velho.
    if ((atual?.classeAbc ?? null) === n.classe && (atual?.grupoContagem ?? null) === grupo) continue;
    mudancas.push(linha);
    // As duas listas falam de CLASSE, não de grupo: item que já era A e só
    // mudou de bloco de contagem não "entra" nem "sai" da curva A, e listá-lo
    // nas duas assustaria quem decide sem motivo.
    if (n.classe === "A" && atual?.classeAbc !== "A") entramNaA.push(linha);
    if (atual?.classeAbc === "A" && n.classe !== "A") saemDaA.push(linha);
  }

  // Classificado hoje e sem compra nenhuma na janela: a casa parou de comprar.
  // Vira C — fora do rodízio — e aparece em lista própria, porque sumir da
  // folha de contagem sem alguém ver é o jeito silencioso de deixar de medir.
  const semCompraNaJanela: LinhaDoPlano[] = [];
  const foraDoEscopo: LinhaDoPlano[] = [];
  for (const a of atuais) {
    if (novaPorProduto.has(a.produtoId)) continue;
    if (!a.classeAbc) continue;
    const linha: LinhaDoPlano = {
      produtoId: a.produtoId,
      de: a.classeAbc,
      para: "C",
      grupoContagem: null,
      valor: 0,
    };
    if (foraDoEscopoIds.has(a.produtoId)) foraDoEscopo.push(linha);
    else semCompraNaJanela.push(linha);
    mudancas.push(linha);
    resumo.C++;
    if (a.classeAbc === "A") saemDaA.push(linha);
  }

  return { mudancas, entramNaA, saemDaA, semCompraNaJanela, foraDoEscopo, resumo };
}
