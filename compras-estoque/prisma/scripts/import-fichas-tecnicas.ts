// Importação única dos dados hoje presos em dashboard-fichas-tecnicas.html
// (DATA/FICHA_LOOKUP/ALIAS_LOOKUP/PREPARO_LOOKUP/RENDIMENTO_LOOKUP) pro
// banco do compras-estoque: Produto (insumos), Receita+IngredienteReceita
// (fichas técnicas, incluindo sub-receitas), ItemVenda (pratos/bebidas/
// vinhos por unidade), e PrecoAtualProduto/HistoricoPrecoProduto (preço
// atual de cada insumo, a partir do custo_unit já cadastrado no dashboard).
//
// Roda em modo --dry-run por padrão: só imprime um relatório de contagens
// e inconsistências, sem escrever nada no banco. Só escreve de verdade com
// --commit explícito (dentro de uma única transação). Esse relatório é o
// gate de qualidade que substitui uma suíte de testes automatizados aqui.
//
// Uso:
//   npx tsx prisma/scripts/import-fichas-tecnicas.ts [caminho-do-html] [--commit]
// Sem caminho, usa ../../dashboard-fichas-tecnicas.html (raiz do repo).
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { normalizarNome } from "../../src/lib/nome-normalizado";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------
// Extração das 5 consts do HTML (sem eval/vm — parsing determinístico de
// "const NOME = {JSON};" localizando o balanceamento de chaves).
// ---------------------------------------------------------------------
function extrairConst(html: string, nome: string): any {
  const marcador = `const ${nome} = `;
  const inicio = html.indexOf(marcador);
  if (inicio === -1) throw new Error(`Não achei "const ${nome} =" no HTML.`);
  const inicioObjeto = inicio + marcador.length;
  if (html[inicioObjeto] !== "{") throw new Error(`"${nome}" não começa com "{" logo após o marcador.`);
  let profundidade = 0;
  let dentroString: '"' | "'" | null = null;
  let escapando = false;
  let i = inicioObjeto;
  for (; i < html.length; i++) {
    const c = html[i];
    if (dentroString) {
      if (escapando) { escapando = false; continue; }
      if (c === "\\") { escapando = true; continue; }
      if (c === dentroString) dentroString = null;
      continue;
    }
    if (c === '"' || c === "'") { dentroString = c as '"' | "'"; continue; }
    if (c === "{") profundidade++;
    else if (c === "}") {
      profundidade--;
      if (profundidade === 0) { i++; break; }
    }
  }
  const bruto = html.slice(inicioObjeto, i);
  return JSON.parse(bruto);
}

type IngredienteBruto = {
  ingrediente: string;
  tipo?: string; // NÃO é confiável — resolvido de verdade via FICHA_LOOKUP/ALIAS_LOOKUP
  unidade: string;
  quantidade: number;
  custo_unit: number;
  custo_total: number;
};
type ItemBruto = {
  categoria: string;
  prato: string;
  ficha: string | null;
  custo: number | null;
  venda: number | null;
  cmv: number | null;
  ingredientes: IngredienteBruto[] | null;
};
type UnidadeData = {
  meta?: number;
  metaBebidas?: number;
  metaVinhos?: number;
  dishes: ItemBruto[];
  bebidas: ItemBruto[];
  wines: ItemBruto[];
};

function carregarDados(caminhoHtml: string) {
  const html = fs.readFileSync(caminhoHtml, "utf8");
  const DATA: Record<string, UnidadeData> = extrairConst(html, "DATA");
  const FICHA_LOOKUP: Record<string, Record<string, IngredienteBruto[]>> = extrairConst(html, "FICHA_LOOKUP");
  const ALIAS_LOOKUP: Record<string, Record<string, string>> = extrairConst(html, "ALIAS_LOOKUP");
  const PREPARO_LOOKUP: Record<string, Record<string, string>> = extrairConst(html, "PREPARO_LOOKUP");
  const RENDIMENTO_LOOKUP: Record<string, Record<string, { quantidade: number; unidade: string }>> = extrairConst(
    html,
    "RENDIMENTO_LOOKUP"
  );
  return { DATA, FICHA_LOOKUP, ALIAS_LOOKUP, PREPARO_LOOKUP, RENDIMENTO_LOOKUP };
}

// ---------------------------------------------------------------------
// Resolução canônica de ingrediente.
//
// Tentativa 1 desta importação: resolver qualquer nome que bata com uma
// chave de FICHA_LOOKUP (via nome direto ou ALIAS_LOOKUP), ignorando o
// campo `tipo` — baseado no achado de que ~31 ingredientes marcados
// "Subproduto" em Beira Lago só resolvem via ALIAS_LOOKUP, não por nome
// direto. Essa tentativa gerou, no dry-run real, mais de 400 "ciclos" de
// sub-receita nas 5 unidades. Investigando a fundo: o padrão dominante é
// ALIAS_LOOKUP mapeando um INSUMO cru pro nome do PRATO/SUB-RECEITA feito
// com ele (ex.: `ALIAS_LOOKUP["Beira Lago"]["FILE MIGNON"] ===
// "PICADINHO DE FILE MIGNON"` — e o ingrediente "FILE MIGNON" dentro da
// própria ficha "PICADINHO DE FILE MIGNON" está corretamente marcado
// tipo:"Insumo" no HTML). Ou seja, nesses casos o campo `tipo` original
// estava certo, e ALIAS_LOOKUP é que tem entradas erradas (mapeamento
// insumo->prato, não variação-de-nome-do-mesmo-prato).
//
// Regra final, mais conservadora: só tenta resolver via FICHA_LOOKUP/
// ALIAS_LOOKUP quando o `tipo` do ingrediente já diz "Subproduto" no HTML.
// Um ingrediente marcado "Insumo" nunca é desviado pra sub-receita só por
// coincidência de nome — elimina o problema acima sem reintroduzir os ~31
// subprodutos legitimamente resolvidos só por alias.
// ---------------------------------------------------------------------
function resolverReceita(
  fichaLookupUnidade: Record<string, IngredienteBruto[]> | undefined,
  aliasLookupUnidade: Record<string, string> | undefined,
  nome: string,
  tipoOriginal: string | undefined
): string | null {
  if (tipoOriginal !== "Subproduto") return null;
  if (!fichaLookupUnidade) return null;
  if (fichaLookupUnidade[nome]) return nome;
  const canonico = aliasLookupUnidade?.[nome];
  if (canonico && fichaLookupUnidade[canonico]) return canonico;
  return null;
}

type RelatorioUnidade = {
  unidade: string;
  produtosNovos: number;
  receitas: number;
  ingredientesInsumo: number;
  ingredientesSubReceita: number;
  itensVenda: number;
  itensVendaSemFicha: number;
  itensVendaComFichaNaoEncontrada: string[];
  subReceitaNaoResolvidaViaAlias: string[]; // tipo dizia "Subproduto" mas nem FICHA_LOOKUP nem ALIAS_LOOKUP resolveram -> tratado como Insumo mesmo assim
  produtosComUnidadeMedidaDivergente: string[]; // mesmo nome, unidade de medida diferente em ocorrências distintas
  rendimentosExplicitos: number;
  rendimentosDerivados: number;
};

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes("--commit");
  const caminhoArg = args.find((a) => !a.startsWith("--"));
  const caminhoHtml = path.resolve(
    caminhoArg ?? path.join(__dirname, "..", "..", "..", "dashboard-fichas-tecnicas.html")
  );
  console.log(`Lendo ${caminhoHtml}${commit ? " (--commit: vai escrever no banco)" : " (dry-run: só relatório, nada é escrito)"}`);

  const { DATA, FICHA_LOOKUP, ALIAS_LOOKUP, PREPARO_LOOKUP, RENDIMENTO_LOOKUP } = carregarDados(caminhoHtml);

  const unidades = await prisma.unidade.findMany();
  const unidadeIdPorNome = new Map(unidades.map((u) => [u.nome, u.id]));

  // nomeNormalizado+unidadeMedida -> {nome original a persistir, custosVistos: Map<custo, contagem>}
  type ProdutoAgregado = { nomeOriginal: string; custosVistos: Map<number, number>; unidadesMedidaVistas: Set<string> };
  const produtosPorChave = new Map<string, ProdutoAgregado>();

  function registrarProduto(nomeBruto: string, unidadeMedidaBruta: string, custoUnit: number) {
    const nome = normalizarNome(nomeBruto);
    const unidadeMedida = normalizarNome(unidadeMedidaBruta || "UN").toUpperCase();
    const chave = `${nome.toLowerCase()}|||${unidadeMedida}`;
    let agregado = produtosPorChave.get(chave);
    if (!agregado) {
      agregado = { nomeOriginal: nome, custosVistos: new Map(), unidadesMedidaVistas: new Set() };
      produtosPorChave.set(chave, agregado);
    }
    agregado.unidadesMedidaVistas.add(unidadeMedida);
    agregado.custosVistos.set(custoUnit, (agregado.custosVistos.get(custoUnit) ?? 0) + 1);
  }

  // ficha (unidade,nome) -> lista de {produtoChave|null, subReceitaChave|null, quantidade, unidadeMedida}
  type IngredienteResolvido = {
    produtoChave: string | null;
    subReceitaNome: string | null; // nome canônico da receita referenciada, resolvido
    quantidade: number;
    unidadeMedida: string;
  };
  const receitasPorUnidade = new Map<string, Map<string, IngredienteResolvido[]>>();

  // Rendimento derivado (fallback pra quando RENDIMENTO_LOOKUP não tem entrada pra
  // uma ficha — caso real de 104 Sul e Noroeste, que não têm NENHUMA entrada em
  // RENDIMENTO_LOOKUP). Achado-chave: em toda ficha auditada, o custo_unit já
  // gravado pra uma sub-receita (em qualquer ficha que a usa) é sempre igual a
  // custo_total-da-própria-ficha / rendimentoQtd (confirmado batendo exatamente
  // contra RENDIMENTO_LOOKUP onde ele existe, ex. Beira Lago "MANTEIGA NOISETE":
  // 35.99 / 0.5 = 71.98 = custo_unit observado no Couvert). Sem essa derivação,
  // explodirReceitaPura cai no fallback "sem rendimento = qtdSolicitada já é em
  // lotes inteiros", que é errado quando a quantidade usada é em g/kg/ml (não em
  // lotes) — foi exatamente esse o bug que inflou o CMV de itens como "Tábua P"
  // em 104 Sul (75g tratados como 75 lotes inteiros).
  const rendimentoDerivadoPorUnidade = new Map<string, Map<string, { quantidade: number; unidade: string }>>();

  const relatorios: RelatorioUnidade[] = [];
  const nomesProdutosVistosAntes = new Set(produtosPorChave.keys());

  for (const unidadeNome of Object.keys(DATA)) {
    if (!unidadeIdPorNome.has(unidadeNome)) {
      console.warn(`AVISO: unidade "${unidadeNome}" existe no HTML mas não no banco (rode o seed antes) — pulando.`);
      continue;
    }
    const fichaLookupUnidade = FICHA_LOOKUP[unidadeNome] ?? {};
    const aliasLookupUnidade = ALIAS_LOOKUP[unidadeNome] ?? {};
    const rendimentoLookupUnidade = RENDIMENTO_LOOKUP[unidadeNome] ?? {};
    const subReceitaNaoResolvida = new Set<string>();

    // custo_unit observado (com sua unidade de medida) toda vez que uma ficha é
    // referenciada como sub-receita em outra — usado pra derivar rendimento abaixo.
    const custoUnitObservadoPorSubReceita = new Map<string, { custoUnit: number; unidade: string }[]>();

    const ingredientesPorFicha = new Map<string, IngredienteResolvido[]>();
    for (const [fichaNome, ingredientes] of Object.entries(fichaLookupUnidade)) {
      const lista: IngredienteResolvido[] = [];
      for (const ing of ingredientes) {
        const nomeIng = normalizarNome(ing.ingrediente);
        // Uma receita não pode consumir a si mesma como sub-receita — quando o nome do
        // ingrediente é IGUAL ao nome da própria ficha (achado real nos dados: ex. a
        // ficha "IOGURTE NATURAL" lista uma linha de ingrediente chamada "IOGURTE
        // NATURAL"), trata sempre como Insumo, nunca resolve pra sub-receita. Sem essa
        // guarda, isso gera um ciclo de profundidade 1 que não existe de verdade.
        const receitaResolvida =
          nomeIng === fichaNome ? null : resolverReceita(fichaLookupUnidade, aliasLookupUnidade, nomeIng, ing.tipo);
        if (receitaResolvida) {
          const unidadeMedida = normalizarNome(ing.unidade || "UN").toUpperCase();
          lista.push({ produtoChave: null, subReceitaNome: receitaResolvida, quantidade: ing.quantidade ?? 0, unidadeMedida });
          if (typeof ing.custo_unit === "number" && ing.custo_unit > 0) {
            const arr = custoUnitObservadoPorSubReceita.get(receitaResolvida) ?? [];
            arr.push({ custoUnit: ing.custo_unit, unidade: unidadeMedida });
            custoUnitObservadoPorSubReceita.set(receitaResolvida, arr);
          }
        } else {
          if (ing.tipo === "Subproduto") subReceitaNaoResolvida.add(nomeIng);
          registrarProduto(nomeIng, ing.unidade, ing.custo_unit ?? 0);
          const unidadeMedida = normalizarNome(ing.unidade || "UN").toUpperCase();
          const chave = `${nomeIng.toLowerCase()}|||${unidadeMedida}`;
          lista.push({ produtoChave: chave, subReceitaNome: null, quantidade: ing.quantidade ?? 0, unidadeMedida });
        }
      }
      ingredientesPorFicha.set(fichaNome, lista);
    }
    receitasPorUnidade.set(unidadeNome, ingredientesPorFicha);

    // Deriva rendimentoQtd pra fichas sem entrada em RENDIMENTO_LOOKUP, a partir do
    // custo_unit já observado onde a ficha é usada como sub-receita (ver comentário
    // acima de rendimentoDerivadoPorUnidade). Só deriva quando há pelo menos uma
    // observação e o custo_total da própria ficha é positivo; usa a mediana das
    // observações pra ser robusto a eventual ruído de arredondamento.
    const rendimentoDerivado = new Map<string, { quantidade: number; unidade: string }>();
    for (const [fichaNome, ingredientesBrutos] of Object.entries(fichaLookupUnidade)) {
      if (rendimentoLookupUnidade[fichaNome]) continue; // já tem rendimento explícito, não precisa derivar
      const custoTotalProprio = ingredientesBrutos.reduce((soma, i) => soma + (i.custo_total ?? 0), 0);
      const observados = custoUnitObservadoPorSubReceita.get(fichaNome);
      if (custoTotalProprio <= 0 || !observados?.length) continue;
      const ordenados = [...observados].sort((a, b) => a.custoUnit - b.custoUnit);
      const mediana = ordenados[Math.floor(ordenados.length / 2)];
      rendimentoDerivado.set(fichaNome, { quantidade: custoTotalProprio / mediana.custoUnit, unidade: mediana.unidade });
    }
    rendimentoDerivadoPorUnidade.set(unidadeNome, rendimentoDerivado);

    // Itens de venda (dishes/bebidas/wines) — conta quantos batem com uma ficha
    let itensVenda = 0;
    let itensVendaSemFicha = 0;
    const itensVendaComFichaNaoEncontrada: string[] = [];
    for (const [, arr] of [
      ["dishes", DATA[unidadeNome].dishes] as const,
      ["bebidas", DATA[unidadeNome].bebidas] as const,
      ["wines", DATA[unidadeNome].wines] as const,
    ]) {
      for (const item of arr) {
        itensVenda++;
        const chaveFicha = item.ficha ? normalizarNome(item.ficha) : null;
        if (!chaveFicha) { itensVendaSemFicha++; continue; }
        if (!fichaLookupUnidade[chaveFicha]) {
          itensVendaSemFicha++;
          itensVendaComFichaNaoEncontrada.push(`${item.prato} (ficha "${chaveFicha}")`);
        }
      }
    }

    const unidadesMedidaDivergentes: string[] = [];
    for (const [, agregado] of produtosPorChave) {
      if (agregado.unidadesMedidaVistas.size > 1) unidadesMedidaDivergentes.push(agregado.nomeOriginal);
    }

    relatorios.push({
      unidade: unidadeNome,
      produtosNovos: 0, // preenchido depois de processar todas as unidades (catálogo é global)
      receitas: Object.keys(fichaLookupUnidade).length,
      ingredientesInsumo: [...ingredientesPorFicha.values()].flat().filter((i) => i.produtoChave).length,
      ingredientesSubReceita: [...ingredientesPorFicha.values()].flat().filter((i) => i.subReceitaNome).length,
      itensVenda,
      itensVendaSemFicha,
      itensVendaComFichaNaoEncontrada,
      subReceitaNaoResolvidaViaAlias: [...subReceitaNaoResolvida],
      produtosComUnidadeMedidaDivergente: [], // preenchido no relatório final (é global, não por unidade)
      rendimentosExplicitos: Object.keys(rendimentoLookupUnidade).length,
      rendimentosDerivados: rendimentoDerivado.size,
    });
  }

  const produtosNovosTotal = produtosPorChave.size - nomesProdutosVistosAntes.size; // sempre igual a produtosPorChave.size aqui (não havia nenhum antes deste loop)
  const unidadesMedidaDivergentesGlobal = [...produtosPorChave.values()]
    .filter((p) => p.unidadesMedidaVistas.size > 1)
    .map((p) => p.nomeOriginal);

  // Detecção de ciclo entre receitas (dry-run report only — não bloqueia o import,
  // só avisa; um ciclo real quebraria explodirReceita em tempo de uso).
  function detectarCiclos(unidadeNome: string, ingredientesPorFicha: Map<string, IngredienteResolvido[]>): string[] {
    const ciclos: string[] = [];
    function dfs(nome: string, caminho: string[], visitados: Set<string>) {
      if (visitados.has(nome)) { ciclos.push([...caminho, nome].join(" -> ")); return; }
      const proximos = new Set(visitados);
      proximos.add(nome);
      for (const ing of ingredientesPorFicha.get(nome) ?? []) {
        if (ing.subReceitaNome) dfs(ing.subReceitaNome, [...caminho, nome], proximos);
      }
    }
    for (const nome of ingredientesPorFicha.keys()) dfs(nome, [], new Set());
    return [...new Set(ciclos)];
  }

  console.log("\n========== RELATÓRIO ==========");
  console.log(`Produtos (insumos) únicos encontrados no total: ${produtosPorChave.size}`);
  if (unidadesMedidaDivergentesGlobal.length) {
    console.log(`\n⚠ ${unidadesMedidaDivergentesGlobal.length} produto(s) com unidade de medida DIVERGENTE entre ocorrências (viram Produto separados, revisar manualmente):`);
    unidadesMedidaDivergentesGlobal.forEach((n) => console.log(`   - ${n}`));
  }
  for (const r of relatorios) {
    console.log(`\n--- ${r.unidade} ---`);
    console.log(`  Receitas (fichas): ${r.receitas}`);
    console.log(`  Ingredientes: ${r.ingredientesInsumo} insumo(s) + ${r.ingredientesSubReceita} sub-receita(s)`);
    console.log(`  Itens de venda: ${r.itensVenda} (${r.itensVenda - r.itensVendaSemFicha} com ficha, ${r.itensVendaSemFicha} sem)`);
    console.log(`  Rendimento: ${r.rendimentosExplicitos} explícito(s) (RENDIMENTO_LOOKUP) + ${r.rendimentosDerivados} derivado(s) (a partir do custo_unit observado)`);
    if (r.itensVendaComFichaNaoEncontrada.length) {
      console.log(`  ⚠ ${r.itensVendaComFichaNaoEncontrada.length} item(ns) de venda cita(m) uma ficha que não existe em FICHA_LOOKUP:`);
      r.itensVendaComFichaNaoEncontrada.forEach((s) => console.log(`     - ${s}`));
    }
    if (r.subReceitaNaoResolvidaViaAlias.length) {
      console.log(`  ⚠ ${r.subReceitaNaoResolvidaViaAlias.length} ingrediente(s) marcados "Subproduto" no HTML mas SEM ficha correspondente (tratados como Insumo mesmo assim):`);
      r.subReceitaNaoResolvidaViaAlias.forEach((s) => console.log(`     - ${s}`));
    }
    const ciclos = detectarCiclos(r.unidade, receitasPorUnidade.get(r.unidade)!);
    if (ciclos.length) {
      console.log(`  ⚠ ${ciclos.length} ciclo(s) de sub-receita detectado(s) (import segue, mas explodirReceita vai travar nesses até corrigir):`);
      ciclos.forEach((c) => console.log(`     - ${c}`));
    }
  }
  console.log("\n================================\n");

  if (!commit) {
    console.log("Dry-run concluído — nada foi escrito no banco. Revise o relatório acima e rode de novo com --commit quando estiver tudo certo.");
    await prisma.$disconnect();
    return;
  }

  console.log("Escrevendo no banco...");
  await prisma.$transaction(
    async (tx) => {
      // Passe 1 — Produto (catálogo global, upsert por nome+unidadeMedida)
      const produtoIdPorChave = new Map<string, string>();
      for (const [chave, agregado] of produtosPorChave) {
        const unidadeMedida = chave.split("|||")[1];
        // preço mais frequentemente observado (mesmo critério do dashboard: "uso mais comum")
        let custoMaisFrequente = 0, maiorContagem = -1;
        for (const [custo, n] of agregado.custosVistos) {
          if (n > maiorContagem) { maiorContagem = n; custoMaisFrequente = custo; }
        }
        const produto = await tx.produto.upsert({
          where: { nome_unidadeMedida: { nome: agregado.nomeOriginal, unidadeMedida } },
          update: {},
          create: { nome: agregado.nomeOriginal, unidadeMedida },
        });
        produtoIdPorChave.set(chave, produto.id);
        // usa como preço inicial o valor mais frequente encontrado nas fichas
        ;(agregado as any)._custoInicial = custoMaisFrequente;
      }

      for (const unidadeNome of receitasPorUnidade.keys()) {
        const unidadeId = unidadeIdPorNome.get(unidadeNome)!;
        const ingredientesPorFicha = receitasPorUnidade.get(unidadeNome)!;
        const fichaLookupUnidade = FICHA_LOOKUP[unidadeNome] ?? {};
        const preparoLookupUnidade = PREPARO_LOOKUP[unidadeNome] ?? {};
        const rendimentoLookupUnidade = RENDIMENTO_LOOKUP[unidadeNome] ?? {};

        // Passe 2 — shells de Receita (antes dos ingredientes, pra permitir subReceitaId em qualquer ordem)
        const receitaIdPorNome = new Map<string, string>();
        const rendimentoDerivadoUnidade = rendimentoDerivadoPorUnidade.get(unidadeNome) ?? new Map();
        for (const fichaNome of Object.keys(fichaLookupUnidade)) {
          const rendimento = rendimentoLookupUnidade[fichaNome] ?? rendimentoDerivadoUnidade.get(fichaNome);
          const receita = await tx.receita.upsert({
            where: { unidadeId_nome: { unidadeId, nome: fichaNome } },
            update: {
              modoPreparo: preparoLookupUnidade[fichaNome] ?? null,
              rendimentoQtd: rendimento?.quantidade ?? null,
              rendimentoUnidade: rendimento?.unidade ?? null,
            },
            create: {
              unidadeId,
              nome: fichaNome,
              modoPreparo: preparoLookupUnidade[fichaNome] ?? null,
              rendimentoQtd: rendimento?.quantidade ?? null,
              rendimentoUnidade: rendimento?.unidade ?? null,
            },
          });
          receitaIdPorNome.set(fichaNome, receita.id);
        }

        // Passe 3 — IngredienteReceita
        for (const [fichaNome, ingredientes] of ingredientesPorFicha) {
          const receitaId = receitaIdPorNome.get(fichaNome);
          if (!receitaId) {
            // Mesmo princípio dos ingredientes abaixo: o passe 2 cria uma Receita
            // pra cada chave de FICHA_LOOKUP, então não deveria faltar — mas se
            // faltasse, o `!` que estava aqui passava `undefined` como receitaId
            // pro deleteMany, que apagaria ingrediente de receita nenhuma e
            // seguiria como se tivesse dado certo.
            throw new Error(`Receita "${fichaNome}" (${unidadeNome}) não foi criada no passe 2 — abortando import.`);
          }
          // idempotência simples: apaga e recria os ingredientes desta receita neste import
          await tx.ingredienteReceita.deleteMany({ where: { receitaId } });
          for (const ing of ingredientes) {
            // Exige id resolvido, nunca grava linha "solta". Por construção isso
            // não deveria falhar (todo produtoChave passou por registrarProduto,
            // toda subReceitaNome veio de uma chave de FICHA_LOOKUP), mas o `!`
            // que estava aqui transformava uma quebra dessa suposição num
            // TypeError genérico em vez de dizer qual ficha/ingrediente quebrou
            // — e uma linha sem produtoId nem subReceitaId é ignorada em
            // silêncio por explodirReceitaPura, ou seja, custo faltando sem
            // nenhum aviso.
            const produtoId = ing.produtoChave ? produtoIdPorChave.get(ing.produtoChave) : undefined;
            const subReceitaId = ing.subReceitaNome ? receitaIdPorNome.get(ing.subReceitaNome) : undefined;
            if (ing.produtoChave && !produtoId) {
              throw new Error(
                `Produto não resolvido pra chave "${ing.produtoChave}" na ficha "${fichaNome}" (${unidadeNome}) — abortando import.`
              );
            }
            if (ing.subReceitaNome && !subReceitaId) {
              throw new Error(
                `Sub-receita "${ing.subReceitaNome}" não resolvida na ficha "${fichaNome}" (${unidadeNome}) — abortando import.`
              );
            }
            if (!produtoId && !subReceitaId) {
              throw new Error(
                `Ingrediente sem produtoId nem subReceitaId na ficha "${fichaNome}" (${unidadeNome}) — abortando import.`
              );
            }
            await tx.ingredienteReceita.create({
              data: {
                receitaId,
                produtoId: produtoId ?? null,
                subReceitaId: subReceitaId ?? null,
                quantidade: ing.quantidade,
                unidadeMedida: ing.unidadeMedida,
              },
            });
          }
        }

        // Passe 4 — ItemVenda
        const tipoPorArray = { dishes: "PRATO", bebidas: "BEBIDA", wines: "VINHO" } as const;
        for (const chave of ["dishes", "bebidas", "wines"] as const) {
          for (const item of DATA[unidadeNome][chave]) {
            const nomeFicha = item.ficha ? normalizarNome(item.ficha) : null;
            const receitaId = nomeFicha ? receitaIdPorNome.get(nomeFicha) ?? null : null;
            const categoria = item.categoria ?? null;
            await tx.itemVenda.upsert({
              where: {
                unidadeId_tipo_categoria_nome: {
                  unidadeId,
                  tipo: tipoPorArray[chave],
                  categoria,
                  nome: normalizarNome(item.prato),
                },
              },
              update: {
                categoria,
                precoVenda: item.venda ?? 0,
                receitaId,
                custoImportado: item.custo,
                cmvImportado: item.cmv,
              },
              create: {
                unidadeId,
                tipo: tipoPorArray[chave],
                nome: normalizarNome(item.prato),
                categoria,
                precoVenda: item.venda ?? 0,
                receitaId,
                custoImportado: item.custo,
                cmvImportado: item.cmv,
              },
            });
          }
        }

        // Metas de CMV da unidade
        const dataUnidade = DATA[unidadeNome];
        await tx.unidade.update({
          where: { id: unidadeId },
          data: {
            metaCmvPratos: dataUnidade.meta ?? null,
            metaCmvBebidas: dataUnidade.metaBebidas ?? null,
            metaCmvVinhos: dataUnidade.metaVinhos ?? null,
          },
        });

        // Preço inicial de cada insumo usado nesta unidade (a partir do custo_unit mais frequente)
        const agora = new Date();
        for (const ingredientes of ingredientesPorFicha.values()) {
          for (const ing of ingredientes) {
            if (!ing.produtoChave) continue;
            const produtoId = produtoIdPorChave.get(ing.produtoChave)!;
            const agregado = produtosPorChave.get(ing.produtoChave)!;
            const custoInicial = (agregado as any)._custoInicial as number;
            const existente = await tx.precoAtualProduto.findUnique({
              where: { unidadeId_produtoId: { unidadeId, produtoId } },
            });
            if (existente) continue; // já preenchido (por outra ficha desta mesma unidade) — não sobrescreve
            await tx.precoAtualProduto.create({
              data: { unidadeId, produtoId, preco: custoInicial, dataCompra: agora },
            });
            await tx.historicoPrecoProduto.create({
              data: {
                unidadeId,
                produtoId,
                preco: custoInicial,
                origem: "IMPORTACAO_INICIAL",
                origemId: "import-fichas-tecnicas",
                dataCompra: agora,
              },
            });
          }
        }
      }
    },
    { timeout: 120_000 }
  );

  console.log("Importação concluída.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
