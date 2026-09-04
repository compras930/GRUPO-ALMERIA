// Resolução das linhas de ingrediente de uma ficha técnica / sub-receita.
//
// Regra central: um ingrediente é identificado SEMPRE por id (produtoId ou
// subReceitaId), NUNCA por nome. Resolver por nome era a causa raiz de um bug
// de gravação em produção: o catálogo de Produto tem duplicidade por variação
// de maiúscula/minúscula (ex.: "Burrata" e "BURRATA", os dois em KG), então um
// lookup por nome era ambíguo — podia casar com a linha errada, ou criar uma
// terceira variante, sem ninguém perceber.
//
// Esta função é pura/síncrona de propósito (mesmo princípio de
// explodirReceitaPura em ./receita.ts): recebe os produtos/receitas já
// carregados em Map e não toca no banco, pra poder ser testada sem Postgres.
// A casca async (as Server Actions salvarFicha/salvarSubReceita) só carrega os
// dados, chama isto, e grava o resultado.
//
// Nenhuma linha problemática é descartada silenciosamente: cada linha que não
// resolve empilha uma mensagem em `erros` e a gravação inteira é abortada, com
// TODAS as mensagens juntas — não só a da primeira linha ruim (era outra parte
// do bug: quem salvava não descobria o que tinha dado errado nas demais).

export type LinhaIngredienteBruta =
  | { tipo: "INSUMO"; produtoId: string; unidadeMedida: string; quantidade: number }
  | { tipo: "SUBRECEITA"; subReceitaId: string; unidadeMedida: string; quantidade: number };

export type ProdutoResumo = { id: string; nome: string; unidadeMedida: string };
export type ReceitaResumo = { id: string; nome: string; unidadeId: string; rendimentoUnidade: string | null };

/** Exatamente o formato de uma linha de IngredienteReceita, pronto pra gravar. */
export type DadoIngredienteResolvido = {
  produtoId: string | null;
  subReceitaId: string | null;
  quantidade: number;
  unidadeMedida: string;
};

export type ResultadoResolucao =
  | { ok: true; ingredientes: DadoIngredienteResolvido[] }
  | { ok: false; erros: string[] };

export type ContextoResolucao = {
  produtosPorId: Map<string, ProdutoResumo>;
  receitasPorId: Map<string, ReceitaResumo>;
  /** Receita sendo editada, pra barrar auto-referência. null quando ela ainda não existe. */
  receitaAtualId: string | null;
  /** Unidade (casa) da receita sendo editada — sub-receita de outra unidade é erro. */
  unidadeId: string;
};

export function resolverIngredientesPura(
  linhas: LinhaIngredienteBruta[],
  contexto: ContextoResolucao
): ResultadoResolucao {
  const erros: string[] = [];
  const ingredientes: DadoIngredienteResolvido[] = [];

  linhas.forEach((linha, idx) => {
    const n = idx + 1;

    if (linha.tipo === "SUBRECEITA") {
      const sub = contexto.receitasPorId.get(linha.subReceitaId);
      if (!sub) {
        erros.push(`Linha ${n}: sub-receita não encontrada (id ${linha.subReceitaId}) — ela pode ter sido apagada depois que essa tela abriu. Recarregue a página e escolha de novo.`);
        return;
      }
      // Com lookup por nome (unidadeId_nome) isso vinha de graça; por id precisa
      // ser explícito, senão um id de outra casa passaria.
      if (sub.unidadeId !== contexto.unidadeId) {
        erros.push(`Linha ${n}: a sub-receita "${sub.nome}" pertence a outra unidade — não pode ser usada nesta ficha.`);
        return;
      }
      if (contexto.receitaAtualId && sub.id === contexto.receitaAtualId) {
        erros.push(`Linha ${n}: uma receita não pode usar a si mesma ("${sub.nome}") como sub-receita.`);
        return;
      }
      // Aqui NÃO se valida a unidade da linha contra o rendimentoUnidade da
      // sub-receita, de propósito — diferente do caso INSUMO abaixo.
      //
      // Motivo: no dado real, 26 linhas (de 1311) divergem, e a divergência é
      // de rótulo, não de conta. São sub-receitas cujo rendimento veio derivado
      // da importação do dashboard antigo (ex.: "CAFÉ COADO" com rendimentoQtd
      // 1482.88 "ML", "FRANGO DESFIADO" com 11559.93 "G") e que as fichas
      // consomem escrevendo outro rótulo ("UNIDADE", "UN", "LT"). Como
      // explodirReceitaPura só divide quantidade por rendimentoQtd, sem olhar
      // unidade nenhuma, o custo dessas fichas não depende desse rótulo.
      //
      // Bloquear aqui não protegeria nada e impediria de salvar 26 fichas que
      // hoje funcionam: uma linha NOVA já nasce com a unidade certa (o seletor
      // preenche a partir do rendimentoUnidade da sub-receita escolhida), então
      // a checagem só dispararia em dado legado — travando quem só queria
      // corrigir outra linha da mesma ficha. A limpeza desses 26 rótulos é
      // parte da frente de saneamento das fichas, onde dá pra revisar todos de
      // uma vez, e não uma cobrança a cada salvamento.
      ingredientes.push({
        produtoId: null,
        subReceitaId: sub.id,
        quantidade: linha.quantidade,
        unidadeMedida: linha.unidadeMedida,
      });
      return;
    }

    const produto = contexto.produtosPorId.get(linha.produtoId);
    if (!produto) {
      erros.push(`Linha ${n}: produto não encontrado (id ${linha.produtoId}) — ele pode ter sido apagado depois que essa tela abriu. Recarregue a página e escolha de novo.`);
      return;
    }
    // O custo é calculado como quantidade x preço-por-unidade-canônica-do-produto
    // (explodirReceitaPura não converte unidade nenhuma), então uma linha gravada
    // em unidade diferente da do produto produz custo errado por ordem de
    // grandeza. A UI já trava esse campo a partir do produto escolhido; esta
    // checagem é a defesa em profundidade pro payload chegar adulterado/bugado.
    if (linha.unidadeMedida !== produto.unidadeMedida) {
      erros.push(`Linha ${n}: a unidade "${linha.unidadeMedida}" não bate com a unidade do produto "${produto.nome}", que é cadastrado em ${produto.unidadeMedida}.`);
      return;
    }
    ingredientes.push({
      produtoId: produto.id,
      subReceitaId: null,
      quantidade: linha.quantidade,
      unidadeMedida: linha.unidadeMedida,
    });
  });

  return erros.length ? { ok: false, erros } : { ok: true, ingredientes };
}
