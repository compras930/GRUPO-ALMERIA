// Monta a planilha de pareamento dos códigos do Teknisa que compraram no Wine
// Garden e não acharam produto.
//
//   npx tsx prisma/scripts/pareamento-vinhos/gerar-planilha.ts \
//       nao-casados.csv catalogo.csv [carta.csv] [saida.xlsx]
//
// Os CSV saem das três consultas ao lado. A carta é opcional.
//
// ELE PROPÕE, GENTE DECIDE. Nada aqui grava no banco; o produto é uma planilha
// para conferência. Casar por aproximação de texto sem revisão é exatamente
// como se grava preço no produto errado — em silêncio.
//
// TRÊS COISAS QUE ESTA VERSÃO FAZ E A DE 18/09 NÃO FAZIA, cada uma por causa
// de um erro que custou tempo:
//
// 1. Lê o catálogo INTEIRO, com código. A versão anterior lia só os produtos
//    sem código e usava essa lista para duas perguntas diferentes — "com o que
//    isto casa?" e "esse nome já existe?". A segunda precisa do catálogo todo,
//    e o INSERT morreu em Produto_nome_unidadeMedida_key com 3 colisões.
//
// 2. Avisa quando o produto sugerido JÁ declara outro código do Teknisa.
//    Ligar ali não funcionaria: a rota recusa com CONFLITO_DE_CODIGO. É melhor
//    descobrir na planilha do que na carga.
//
// 3. Separa "ligar a um produto que existe" de "criar produto novo" em colunas
//    diferentes, com o nome e a unidade já preenchidos. Num bar de vinho a
//    maioria é criação, e obrigar a digitar nome de vinho 400 vezes é convite
//    a erro de digitação.
import { readFileSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";

// --------------------------------------------------------------------------
// Unidade — o catálogo só aceita estas quatro (ver UNIDADES_MEDIDA)
// --------------------------------------------------------------------------
const UNIDADES_VALIDAS = new Set(["KG", "LT", "UND", "CX"]);

/** Espelha SINONIMO_UNIDADE de src/lib/resolucao-produto-compra.ts. */
const SINONIMO_UNIDADE: Record<string, string> = {
  UN: "UND", UNIDADE: "UND", UNI: "UND", UNID: "UND", PC: "UND",
  GF: "UND", FT: "UND", BBL: "UND", RL: "UND", BOB: "UND", PR: "UND",
  FD: "CX", LA: "CX", BD: "CX", BB: "CX", BG: "CX", GA: "CX", PT: "CX",
  L: "LT",
};
const un = (u: string) => {
  const x = String(u ?? "").trim().toUpperCase();
  return SINONIMO_UNIDADE[x] ?? x;
};

// --------------------------------------------------------------------------
// Normalização de nome
// --------------------------------------------------------------------------
function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Palavras que descrevem embalagem, origem ou o próprio arquivo — não o vinho.
//
// "WINE" é sufixo que o Teknisa carimba em toda a carta; "WG" é prefixo de
// Wine Garden. Nenhum dos dois distingue um vinho de outro, e mantê-los
// inflaria a semelhança de TODO par de vinhos contra TODO outro.
//
// O que NÃO entra aqui de propósito: DOC, DOCG, IGT, AOC, AOP, RESERVA, GRAN,
// TINTO, BRANCO, ROSE, BRUT. Parecem ruído e não são — é o que separa
// "Tabali Pedregoso Gran Reserva Chardonnay" de "Tabali Pedregoso Gran Reserva
// Pinot Noir", e "Beau Rocher Brut" de "Beau Rocher Brut Rosé".
const RUIDO = new Set([
  "WINE", "WG", "COMPRA",
  "KG", "LT", "L", "UN", "UND", "UNID", "UNIDADE", "GR", "G", "ML", "CX",
  "FD", "PC", "PT", "BD", "BG", "GA", "LA", "BB", "BBL", "GF", "FT", "RL", "BOB", "PR", "DS",
  "DE", "DA", "DO", "DAS", "DOS", "E", "C", "S", "P",
]);

function tokens(nome: string): string[] {
  return semAcento(String(nome ?? ""))
    .toUpperCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\bS\s*\//g, " SEM ")
    .replace(/\bC\s*\//g, " COM ")
    .replace(/[^A-Z0-9]+/g, " ")
    .split(" ")
    // Ano de safra (2019..2029) e volume (750, 330) não identificam o vinho:
    // a mesma etiqueta muda de safra todo ano e continua sendo o mesmo item.
    .filter((t) => t && !RUIDO.has(t) && !/^\d+(X\d+)?$/.test(t))
    .map((t) => (t.length >= 5 ? t.replace(/(?:[AO]S?|S)$/, "") : t));
}

const chave = (nome: string) => tokens(nome).join(" ");

function dice(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let comuns = 0;
  for (const t of a) if (b.has(t)) comuns++;
  return (2 * comuns) / (a.size + b.size);
}

function trigramas(s: string): Set<string> {
  const t = ` ${s} `;
  const out = new Set<string>();
  for (let i = 0; i + 3 <= t.length; i++) out.add(t.slice(i, i + 3));
  return out;
}

function similaridade(aTok: string[], bTok: string[], aStr: string, bStr: string): number {
  return Math.max(dice(new Set(aTok), new Set(bTok)), dice(trigramas(aStr), trigramas(bStr)) * 0.9);
}

// --------------------------------------------------------------------------
// CSV do Neon
// --------------------------------------------------------------------------
function lerCsv(caminho: string): Record<string, string>[] {
  // Linha de comentário (#) antes do cabeçalho vira cabeçalho se não for
  // tirada — aconteceu com o CSV de apelidos em 18/09, e o mapa saiu vazio
  // sem reclamar de nada.
  const linhas = readFileSync(caminho, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "" && !l.trimStart().startsWith("#"));
  const partir = (linha: string): string[] => {
    const out: string[] = [];
    let atual = "";
    let dentro = false;
    for (let i = 0; i < linha.length; i++) {
      const c = linha[i];
      if (c === '"') {
        if (dentro && linha[i + 1] === '"') { atual += '"'; i++; }
        else dentro = !dentro;
      } else if (c === "," && !dentro) { out.push(atual); atual = ""; }
      else atual += c;
    }
    out.push(atual);
    return out;
  };
  const cabecalho = partir(linhas[0]).map((h) => h.trim());
  return linhas.slice(1).map((l) => Object.fromEntries(partir(l).map((v, i) => [cabecalho[i], v])));
}

// --------------------------------------------------------------------------
// Vinho ou não
//
// Serve só para separar as abas: a aba de vinho é a que vale a pena fazer
// primeiro, porque é volume grande e decisão fácil. Errar a classificação não
// estraga nada — o item só aparece na aba errada.
// --------------------------------------------------------------------------
const PALAVRA_VINHO = /\bWINE\b|MALBEC|CABERNET|SAUVIGNON|CHARDONNAY|PINOT|MERLOT|SYRAH|SHIRAZ|TANNAT|CARMENERE|TEMPRANILLO|GARNACHA|SANGIOVESE|NEBBIOLO|RIESLING|TORRONTES|ALBARINO|ALVARINHO|VERDEJO|GRIGIO|PROSECCO|CHIANTI|RIOJA|DOURO|ALENTEJO|BORDEAUX|BOURGOGNE|CHABLIS|MONTALCINO|BRUT|ESPUMANTE|CHAMPAGNE|VINHO VERDE|ROSSO|BIANCO|TINTO\b|BRANCO WIN|ROSE WIN/i;

const ehVinho = (codigo: string, nome: string) =>
  /^9000010/.test(String(codigo ?? "").trim()) || PALAVRA_VINHO.test(String(nome ?? ""));

// --------------------------------------------------------------------------

type ProdutoCat = {
  id: string; nome: string; unidade: string; codigo: string; ativo: boolean;
  tokens: string[]; chave: string;
};

function main() {
  const args = process.argv.slice(2);
  const [arqCompras, arqCatalogo] = args;
  if (!arqCompras || !arqCatalogo) {
    console.error("uso: gerar-planilha.ts <nao-casados.csv> <catalogo.csv> [carta.csv] [saida.xlsx]");
    process.exit(1);
  }
  const resto = args.slice(2);
  const arqCarta = resto.find((a) => a.endsWith(".csv"));
  const saida = resto.find((a) => a.endsWith(".xlsx")) ?? "pareamento-vinhos-wine-garden.xlsx";

  const compras = lerCsv(arqCompras);
  const catalogo: ProdutoCat[] = lerCsv(arqCatalogo).map((p) => ({
    id: p.id,
    nome: p.nome,
    unidade: un(p.unidade),
    codigo: String(p.codigo ?? "").trim(),
    ativo: p.ativo === "t" || p.ativo === "true",
    tokens: tokens(p.nome),
    chave: chave(p.nome),
  }));

  const carta = arqCarta ? lerCsv(arqCarta) : [];
  const cartaIndexada = carta.map((v) => ({
    nome: v.nome,
    temReceita: !!String(v.receita_id ?? "").trim(),
    chave: chave(v.nome),
    tokens: tokens(v.nome),
  }));

  // Nome+unidade EXATOS: é essa a chave única do banco. Case conta —
  // "QUEIJO BRIE" e "Queijo brie" convivem no Postgres, e é por isso que os
  // duplicados existem. A checagem sem case é um aviso à parte.
  const exatos = new Set(catalogo.map((p) => `${p.nome}|||${p.unidade}`));
  const semCase = new Map<string, string>();
  for (const p of catalogo) semCase.set(`${p.nome.toUpperCase()}|||${p.unidade}`, p.nome);

  const porChave = new Map<string, ProdutoCat[]>();
  for (const p of catalogo) {
    const lista = porChave.get(p.chave) ?? [];
    lista.push(p);
    porChave.set(p.chave, lista);
  }

  const linhas = compras.map((c) => {
    const nomeTeknisa = c.nome_no_teknisa ?? "";
    const codigoTeknisa = String(c.codigo_teknisa ?? "").trim();
    const unidadeBruta = String(c.unidade ?? "").trim().toUpperCase();
    const unidade = un(unidadeBruta);
    const tk = tokens(nomeTeknisa);
    const ch = chave(nomeTeknisa);

    const iguais = porChave.get(ch) ?? [];
    let candidatos: { p: ProdutoCat; score: number }[];
    let faixa: string;

    // Piso de semelhança mais alto para vinho. Nome de vinho é feito de
    // palavras que se repetem em toda a carta — RESERVA, GRAN, BRUT, ROSE,
    // PINOT —, então 0,5 cola qualquer espumante rosé em qualquer outro. Com o
    // piso baixo, "VEZZI AMALTEIA BRUT ROSE", "WG BELVINO GRILLO ROSE BRUT" e
    // "WG BEAU ROCHER BRUT ROSE" caíam todos no mesmo "Cave Amadeu Rosé Brut",
    // que não é nenhum dos três. Sugestão fraca é pior que sugestão nenhuma:
    // convida a confirmar errado. Sem candidato, a linha cai em "produto novo",
    // que num bar de vinho é a resposta certa na maioria das vezes.
    const piso = ehVinho(codigoTeknisa, nomeTeknisa) ? 0.7 : 0.5;

    if (iguais.length >= 1) {
      candidatos = iguais.map((p) => ({ p, score: 1 }));
      faixa = iguais.length > 1 ? "C - mais de um produto com esse nome"
        : candidatos[0].p.unidade === unidade ? "A - nome idêntico"
        : "B - nome idêntico, unidade diferente";
    } else {
      candidatos = catalogo
        .map((p) => ({ p, score: similaridade(tk, p.tokens, ch, p.chave) }))
        .filter((x) => x.score >= piso)
        .sort((a, b) => b.score - a.score || Number(b.p.unidade === unidade) - Number(a.p.unidade === unidade))
        .slice(0, 3);
      faixa =
        candidatos.length === 0 ? "E - sem candidato (produto novo)"
        : candidatos[0].score >= 0.8 ? "C - parecido, confirmar"
        : "D - parecido de longe";
    }

    const melhor = candidatos[0];

    // Nome proposto para criação: o do Teknisa sem o sufixo que ele carimba.
    const nomeAoCriar = nomeTeknisa.replace(/\s+WINE\s*$/i, "").trim();

    // Aviso TRAVA a decisão automática; nota só informa. A diferença importa:
    // na primeira versão o aviso "já existe produto com esse nome" disparava
    // justamente nas linhas de faixa A — onde o nome existir é o motivo de a
    // linha ser fácil — e apagava o pré-preenchimento das mais simples.
    const avisos: string[] = [];
    const notas: string[] = [];

    // Existe produto com o mesmo nome normalizado: a decisão é LIGAR, e
    // qualquer aviso de colisão seria falso — a "colisão" é o próprio produto
    // que se quer ligar. Comparar texto cru aqui não serve: "COVELA AVESSO
    // VINHO VERDE DOC" e "Covela Avesso Vinho Verde DOC" são o mesmo vinho
    // escrito em caixas diferentes, e é justamente esse o caso da faixa A.
    const criarNaoEstaEmJogo = iguais.length >= 1;

    if (!UNIDADES_VALIDAS.has(unidade)) {
      avisos.push(`unidade "${unidadeBruta}" não existe no catálogo — decidir para qual das quatro vai`);
    }
    if (melhor && melhor.p.codigo) {
      if (melhor.p.codigo === codigoTeknisa) {
        // O produto JÁ tem este código e mesmo assim a linha não casou.
        // Casar por código só falha depois disso por unidade — e aí a
        // correção é fator de conversão, não pareamento. Se a unidade também
        // bate, a linha não deveria estar aqui: o mais provável é que os dois
        // CSV tenham sido exportados em momentos diferentes.
        avisos.push(
          melhor.p.unidade !== unidade
            ? `produto já tem ESTE código; não casou porque a unidade diverge (${unidade} na nota × ${melhor.p.unidade} no cadastro). Não é pareamento — é fator de conversão em ConversaoUnidadeCompra`
            : `produto já tem ESTE código e a unidade bate — esta linha não deveria estar aqui. Reexportar os dois CSV juntos antes de decidir`
        );
      } else {
        avisos.push(`sugestão já tem o código ${melhor.p.codigo} — ligar aqui seria recusado por CONFLITO_DE_CODIGO`);
      }
    }
    if (melhor && !melhor.p.ativo) avisos.push("sugestão está inativa");
    if (!criarNaoEstaEmJogo) {
      if (exatos.has(`${nomeAoCriar}|||${unidade}`)) {
        avisos.push("já existe produto com esse nome e unidade — criar quebraria a chave única");
      } else {
        const parecido = semCase.get(`${nomeAoCriar.toUpperCase()}|||${unidade}`);
        if (parecido) avisos.push(`existe "${parecido}" (só muda maiúscula/minúscula) — criar geraria duplicata`);
      }
    }
    // A carta casa por SEMELHANÇA, não por nome idêntico. O Teknisa escreve
    // "LOUREIRO VINHO VERDE DOC BRANCO WINE" onde a casa vende "Loureiro Vinho
    // Verde DOC" — uma palavra a mais derrubava o casamento exato, e a carta é
    // o sinal mais útil desta planilha: é ela que diz o nome real do vinho na
    // casa e se ele já sai com custo.
    const naCarta = cartaIndexada
      .map((v) => ({ v, score: v.chave === ch ? 1 : similaridade(tk, v.tokens, ch, v.chave) }))
      .filter((x) => x.score >= 0.7)
      .sort((a, b) => b.score - a.score)[0];
    if (naCarta) {
      const quase = naCarta.score < 1 ? ` (parecido, ${naCarta.score.toFixed(2)})` : "";
      notas.push(naCarta.v.temReceita
        ? `na carta como "${naCarta.v.nome}"${quase}, com ficha`
        : `na carta como "${naCarta.v.nome}"${quase}, SEM ficha — hoje vende sem custo`);
    }

    return {
      vinho: ehVinho(codigoTeknisa, nomeTeknisa),
      faixa,
      codigo_teknisa: codigoTeknisa,
      nome_no_teknisa: nomeTeknisa,
      un_teknisa: unidadeBruta,
      valor_comprado: Number(c.valor_comprado) || 0,
      linhas_de_nota: Number(c.linhas) || 0,
      preco_unitario: Number(c.preco_unitario) || 0,
      ultima_compra: c.ultima_compra ?? "",
      sugestao: melhor?.p.nome ?? "",
      un_sugestao: melhor?.p.unidade ?? "",
      semelhanca: melhor ? Number(melhor.score.toFixed(2)) : "",
      outras_opcoes: candidatos.slice(1).map((x) => `${x.p.nome} (${x.p.unidade})`).join(" | "),
      aviso: avisos.join(" · "),
      nota: notas.join(" · "),
      // --- as colunas a preencher ---
      // Faixa A sem aviso que trave é diferença de acento ou caixa: já vem
      // marcada para ser LIDA, não digitada. O resto nasce em branco.
      decisao: faixa.startsWith("A") && avisos.length === 0 ? "ligar" : "",
      // Preenchido junto com a decisão: quem confirma "ligar" não deveria
      // precisar copiar o nome da coluna ao lado à mão.
      produto_para_ligar: faixa.startsWith("A") && avisos.length === 0 ? (melhor?.p.nome ?? "") : "",
      nome_ao_criar: nomeAoCriar,
      unidade_ao_criar: UNIDADES_VALIDAS.has(unidade) ? unidade : "",
    };
  });

  const ordenar = (a: typeof linhas[0], b: typeof linhas[0]) =>
    b.valor_comprado - a.valor_comprado || a.nome_no_teknisa.localeCompare(b.nome_no_teknisa);

  const vinhos = linhas.filter((l) => l.vinho).sort(ordenar);
  const outros = linhas.filter((l) => !l.vinho).sort(ordenar);

  // ------------------------------------------------------------------------
  // Aba 3 — a carta: de quanto de PRODUTO cada VENDA consome.
  //
  // Parear a compra resolve preço e estoque. Não resolve o CMV: o vinho só
  // passa a custar alguma coisa quando o ItemVenda tem Receita apontando pro
  // Produto. Num bar de vinho a receita é mecânica — uma garrafa vendida
  // consome uma garrafa comprada — MENOS quando a venda é taça ou dose.
  //
  // E é taça com frequência: a carta tem o mesmo vinho duas vezes com preços
  // muito diferentes (Chablis Maurice Lecestre a R$ 105 e a R$ 479, Château
  // Simard a R$ 124 e a R$ 564). Gerar "1 garrafa" para os dois faria a taça
  // custar uma garrafa inteira — CMV grotesco, com cara de número calculado.
  //
  // Quantas taças saem de uma garrafa é decisão da casa. Este script marca 1
  // onde a leitura é segura e deixa EM BRANCO onde não é.
  // ------------------------------------------------------------------------
  const porNomeNaCarta = new Map<string, typeof cartaIndexada>();
  for (const v of cartaIndexada) {
    const lista = porNomeNaCarta.get(v.chave) ?? [];
    lista.push(v);
    porNomeNaCarta.set(v.chave, lista);
  }

  const precoDe = new Map(carta.map((v) => [v.id, Number(v.preco_venda) || 0]));
  const idDe = new Map(cartaIndexada.map((v, i) => [v, carta[i].id]));

  const linhasCarta = carta.map((v, i) => {
    const idx = cartaIndexada[i];
    const irmaos = (porNomeNaCarta.get(idx.chave) ?? []).filter((x) => x !== idx);
    const meuPreco = Number(v.preco_venda) || 0;
    const precosIrmaos = irmaos.map((x) => precoDe.get(idDe.get(x)!) ?? 0);
    const souOMaisCaro = precosIrmaos.every((p) => meuPreco >= p);
    const ehDose = /\(\s*\d+\s*ml\s*\)/i.test(v.nome);

    // A compra que corresponde a este vinho — é dela que sai o Produto.
    const daCompra = linhas
      .map((l) => ({ l, score: similaridade(idx.tokens, tokens(l.nome_no_teknisa), idx.chave, chave(l.nome_no_teknisa)) }))
      .filter((x) => x.score >= 0.7)
      .sort((a, b) => b.score - a.score)[0];

    // A PROVA REAL É O PREÇO CONTRA O CUSTO. A leitura por irmão na carta não
    // basta: "Tabalí Pedregoso Gran Reserva Chardonnay" aparece uma vez só, a
    // R$ 46, e a garrafa custa R$ 94,37 — é taça, e a garrafa simplesmente não
    // está na carta. Marcar 1 ali faria a taça custar o dobro do que ela vende.
    //
    // Restaurante não vende vinho abaixo do custo. Venda menor que 1,3× o
    // custo da garrafa não é garrafa.
    const custo = Number(daCompra?.l.preco_unitario) || 0;
    const pagaAGarrafa = custo > 0 && meuPreco >= custo * 1.3;

    const provavel = ehDose ? "dose"
      : custo > 0 && !pagaAGarrafa ? "taça ou dose (venda abaixo do custo da garrafa)"
      : irmaos.length === 0 ? "único"
      : souOMaisCaro ? "garrafa"
      : "taça ou dose";

    // Quando a garrafa do mesmo vinho está na carta, a razão entre os dois
    // preços é a melhor pista da fração — e ela se repete: Chablis 105/479,
    // Truffle Hunter 37/169, Klet Brda 70/319, Dubordieu 83/376, Garzon 66/299
    // dão todos 0,22. A casa tem uma regra, e ela é visível no próprio dado.
    const maisCaroDoGrupo = Math.max(meuPreco, ...precosIrmaos);
    // Só vale como pista de taça quando a razão é de taça. "Ribeiro Santo
    // Reserva" aparece a R$ 66 e a R$ 56, ambos abaixo do custo da garrafa:
    // razão 0,85, que sugeriria "1 taça por garrafa" — bobagem. Ali os dois
    // são taça e a garrafa não está na carta; melhor não sugerir nada.
    const bruta = !souOMaisCaro && maisCaroDoGrupo > 0 ? meuPreco / maisCaroDoGrupo : 0;
    const razao = bruta > 0 && bruta <= 0.5 ? bruta : 0;

    return {
      nome_na_carta: v.nome,
      preco_venda: meuPreco,
      ja_tem_ficha: idx.temReceita ? "sim" : "",
      provavel,
      precos_do_mesmo_vinho: precosIrmaos.length ? precosIrmaos.map((p) => `R$ ${p}`).join(" | ") : "",
      codigo_teknisa: daCompra?.l.codigo_teknisa ?? "",
      produto_correspondente: daCompra ? (daCompra.l.sugestao || daCompra.l.nome_ao_criar) : "",
      custo_da_garrafa: custo || "",
      margem: custo > 0 ? Number((meuPreco / custo).toFixed(2)) : "",
      valor_comprado: daCompra?.l.valor_comprado ?? "",
      // Só marca 1 quando o preço de venda sustenta uma garrafa inteira. Todo
      // o resto fica em branco de propósito — inclusive a garrafa de um par,
      // porque se a taça precisa de decisão, as duas linhas do par devem ser
      // olhadas juntas.
      garrafas_por_venda: !idx.temReceita && daCompra && pagaAGarrafa && !ehDose && souOMaisCaro ? 1 : "",
      observacao: idx.temReceita ? "já tem ficha — não mexer"
        : !daCompra ? "não achei a compra correspondente — sem Produto, não dá pra custear"
        : ehDose ? `dose: que fração da garrafa? (50 ml de 750 ml = 0,067). Custo da garrafa R$ ${custo}`
        : !pagaAGarrafa ? `vende a R$ ${meuPreco} e a garrafa custa R$ ${custo} — não é garrafa inteira.${razao ? ` A garrafa na carta sai a R$ ${maisCaroDoGrupo}, razão ${razao.toFixed(2)} (≈ ${Math.round(1 / razao)} taças).` : ""} Quantas taças por garrafa?`
        : !souOMaisCaro && razao ? `o mesmo vinho aparece a R$ ${maisCaroDoGrupo}: razão ${razao.toFixed(2)} (≈ ${Math.round(1 / razao)} taças). Confirmar`
        : "",
    };
  });

  linhasCarta.sort((a, b) =>
    Number(!!a.ja_tem_ficha) - Number(!!b.ja_tem_ficha) ||
    (Number(b.valor_comprado) || 0) - (Number(a.valor_comprado) || 0) ||
    a.nome_na_carta.localeCompare(b.nome_na_carta)
  );

  const semFicha = linhasCarta.filter((l) => !l.ja_tem_ficha);
  const aDecidir = semFicha.filter((l) => l.garrafas_por_venda === "" && l.codigo_teknisa);
  console.log(`\nCARTA: ${linhasCarta.length} vinhos, ${linhasCarta.length - semFicha.length} já com ficha`);
  console.log(`  ${String(semFicha.filter((l) => l.garrafas_por_venda === 1).length).padStart(4)}  já marcados com 1 garrafa`);
  console.log(`  ${String(aDecidir.length).padStart(4)}  precisam da quantidade (taça, dose ou par)`);
  console.log(`  ${String(semFicha.filter((l) => !l.codigo_teknisa).length).padStart(4)}  sem compra correspondente — não dá pra custear`);

  const real = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const resumo = (nome: string, ls: typeof linhas) => {
    const total = ls.reduce((s, l) => s + l.valor_comprado, 0);
    console.log(`\n${nome}: ${ls.length} códigos, ${real(total)}`);
    const porFaixa = new Map<string, { n: number; v: number }>();
    for (const l of ls) {
      const x = porFaixa.get(l.faixa) ?? { n: 0, v: 0 };
      x.n++; x.v += l.valor_comprado;
      porFaixa.set(l.faixa, x);
    }
    for (const [f, x] of [...porFaixa.entries()].sort()) {
      console.log(`  ${String(x.n).padStart(4)}  ${f.padEnd(38)} ${real(x.v)}`);
    }
    const comAviso = ls.filter((l) => l.aviso).length;
    if (comAviso) console.log(`  ${String(comAviso).padStart(4)}  com aviso — ler antes de decidir`);
  };

  resumo("VINHOS", vinhos);
  resumo("OUTROS", outros);

  // Uma largura por coluna, na ordem em que o objeto acima as declara.
  const colunas = [
    34, // faixa
    15, // codigo_teknisa
    52, // nome_no_teknisa
    11, // un_teknisa
    15, // valor_comprado
    9,  // linhas_de_nota
    14, // preco_unitario
    14, // ultima_compra
    45, // sugestao
    12, // un_sugestao
    11, // semelhanca
    55, // outras_opcoes
    75, // aviso
    55, // nota
    10, // decisao
    45, // produto_para_ligar
    52, // nome_ao_criar
    16, // unidade_ao_criar
  ];
  const wb = XLSX.utils.book_new();
  for (const [aba, dados] of [["vinhos", vinhos], ["outros", outros]] as const) {
    const semFlag = dados.map(({ vinho, ...r }) => r);
    const ws = XLSX.utils.json_to_sheet(semFlag);
    ws["!cols"] = colunas.map((wch) => ({ wch }));
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };
    if (dados.length > 0) {
      ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: dados.length, c: colunas.length - 2 } }) };
    }
    XLSX.utils.book_append_sheet(wb, ws, aba);
  }

  if (linhasCarta.length > 0) {
    const ws = XLSX.utils.json_to_sheet(linhasCarta);
    ws["!cols"] = [52, 13, 12, 46, 26, 15, 45, 16, 10, 15, 18, 95].map((wch) => ({ wch }));
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: linhasCarta.length, c: 11 } }) };
    XLSX.utils.book_append_sheet(wb, ws, "carta-vinhos");
  }

  writeFileSync(saida, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  console.log(`\n${saida}`);
}

main();
