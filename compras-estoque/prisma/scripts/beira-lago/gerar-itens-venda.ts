// Gera o SQL que cadastra os itens de venda do Beira Lago que faltam, a partir
// do export de vendas do XMenu.
//
//   npx tsx prisma/scripts/beira-lago/gerar-itens-venda.ts <csv> <codigos-ja-cadastrados.txt> [saida.sql]
//
// O script NÃO toca no banco. Escreve um .sql pra ser lido antes de rodar.
//
// O CÓDIGO É O IDENTIFICADOR, e é por isso que ele vai junto. Sem código, o
// casamento cai no nome — e nome é a parte que a casa muda sozinha: foi
// exatamente por isso que 34 vinhos já cadastrados não casaram na primeira
// carga ("Kaiken Estate Malbec" contra "KAIKEN ESTATE MALBEC - ARGENTINA").
// Cadastrando com `codigoPdv`, o item casa mesmo que alguém reescreva o
// cardápio inteiro amanhã.
//
// O PREÇO É O MODAL POR RECEITA, não o último nem a média. O último pode ser
// uma cortesia (há linhas a R$ 0,01 no meio da semana) e a média mistura
// cortesia com preço cheio. "O preço sob o qual mais dinheiro foi vendido" é
// o preço praticado, e sobrevive a uma linha solta de R$ 0,01 — que é
// justamente o caso do MARQUES DE BORBA, com 0,01 e 400,00 no mesmo período.
//
// EVENTOS vêm colapsados em 4 itens fixos pelo próprio painel, com
// `quantidade = valor em reais` e `preço = 1`. É o único jeito de somar
// receita de evento sem inventar um item por festa: cada evento tem preço
// próprio, e o nome traz a data. Os 4 entram com precoVenda 1,00 justamente
// pra que quantidade × preço reproduza o valor vendido.
import { readFileSync, writeFileSync } from "node:fs";
// O mesmo canonizador que o app usa, e não uma cópia da regra: foi uma cópia
// de regra (a normalização de unidade) que deixou 75 linhas de PCT sem casar.
import { categoriaCanonicaPura } from "../../../src/lib/categoria-venda";

const normalizarNome = (s: string) => s.trim().replace(/\s+/g, " ");
const sql = (s: string) => `'${s.replace(/'/g, "''")}'`;

function lerCsv(texto: string): Record<string, string>[] {
  const linhas: string[][] = []; let campo = ""; let atual: string[] = []; let asp = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (asp) { if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else asp = false; } else campo += c; }
    else if (c === '"') asp = true;
    else if (c === ",") { atual.push(campo); campo = ""; }
    else if (c === "\n") { atual.push(campo); linhas.push(atual); atual = []; campo = ""; }
    else if (c !== "\r") campo += c;
  }
  if (campo || atual.length) { atual.push(campo); linhas.push(atual); }
  const [cab, ...r] = linhas;
  return r.filter((l) => l.some((c) => c !== "")).map((l) => Object.fromEntries(cab.map((h, i) => [h.trim(), l[i] ?? ""])));
}

/**
 * grupo do XMenu -> tipo do app. Só existem três (PRATO, BEBIDA, VINHO), e a
 * escolha muda onde o item aparece na tela de Fichas técnicas.
 *
 * EVENTOS e OUTROS caem em PRATO porque é o balde de "o que não é bebida nem
 * vinho" — não é bonito, mas inventar um quarto tipo mexeria em telas,
 * filtros e no CMV por tipo pra arrumar um rótulo.
 */
function tipoDoGrupo(grupo: string, subgrupo: string): "PRATO" | "BEBIDA" | "VINHO" {
  const g = grupo.toUpperCase();
  if (g === "VINHOS") return "VINHO";
  if (g === "BEBIDAS" || g === "DRINKS" || g === "DOSES") return "BEBIDA";
  if (g === "EVENTOS") return subgrupo.toUpperCase() === "VINHOS" ? "VINHO" : "PRATO";
  return "PRATO";
}

const [, , caminhoCsv, caminhoJaTem, saida = "prisma/scripts/beira-lago/10-itens-venda.sql"] = process.argv;
if (!caminhoCsv || !caminhoJaTem) {
  console.error("uso: npx tsx prisma/scripts/beira-lago/gerar-itens-venda.ts <csv> <codigos-ja-cadastrados.txt> [saida.sql]");
  process.exit(1);
}

const jaCadastrados = new Set(readFileSync(caminhoJaTem, "utf-8").split(/\s+/).filter(Boolean));
const linhas = lerCsv(readFileSync(caminhoCsv, "utf-8"));

type Agregado = {
  codigo: string;
  nome: string;
  grupo: string;
  subgrupo: string;
  /** preço -> receita vendida sob aquele preço */
  receitaPorPreco: Map<number, number>;
  quantidade: number;
  valor: number;
};
const porCodigo = new Map<string, Agregado>();
for (const l of linhas) {
  const codigo = l.codigo.trim();
  if (!codigo) continue;
  const preco = Math.round(Number(l.preco_unitario) * 100) / 100;
  const valor = Number(l.valor_total_vendido);
  const atual = porCodigo.get(codigo);
  if (atual) {
    atual.receitaPorPreco.set(preco, (atual.receitaPorPreco.get(preco) ?? 0) + valor);
    atual.quantidade += Number(l.quantidade_vendida);
    atual.valor += valor;
  } else {
    porCodigo.set(codigo, {
      codigo,
      nome: normalizarNome(l.nome),
      grupo: l.grupo.trim(),
      subgrupo: l.subgrupo.trim(),
      receitaPorPreco: new Map([[preco, valor]]),
      quantidade: Number(l.quantidade_vendida),
      valor,
    });
  }
}

// "TESTE IMPRESSORAS" não é venda. R$ 0,02 no período inteiro, e o nome diz o
// que é. Fica de fora com registro, não some em silêncio.
const EXCLUIDOS = [...porCodigo.values()].filter((a) => /^TESTE /i.test(a.nome));
for (const e of EXCLUIDOS) porCodigo.delete(e.codigo);

const novos = [...porCodigo.values()].filter((a) => !jaCadastrados.has(a.codigo));

const precoModal = (a: Agregado) =>
  [...a.receitaPorPreco].sort((x, y) => y[1] - x[1] || y[0] - x[0])[0][0];

// A CATEGORIA SAI CANÔNICA, não crua do export.
//
// O subgrupo do XMenu vem em MAIÚSCULA, e o cadastro antigo da casa usa
// Capitalizada. Gravar cru foi o que encheu o painel de barras duplicadas:
// TINTO ao lado de Tintos, BRANCO ao lado de Brancos — dez barras para cinco
// categorias, e mais de R$ 160 mil de vinho picados em nove delas.
//
// Consertar só o dado gravado não bastaria: a próxima leva de itens novos
// traria MAIÚSCULA de volta por este mesmo caminho.
const categoria = (a: Agregado) => categoriaCanonicaPura(a.subgrupo) ?? a.subgrupo;

// Duas linhas com o mesmo (tipo, categoria, nome) quebrariam o unique do
// banco. Acontece quando o XMenu tem dois códigos pro mesmo nome no mesmo
// subgrupo — e aí é decisão humana, não do script.
//
// A chave usa a categoria CANÔNICA, não o subgrupo cru: dois itens de mesmo
// nome em "TINTO" e "Tintos" são a mesma linha depois da normalização, e com a
// chave crua eles passariam batido aqui para quebrar o INSERT lá no banco.
const porChave = new Map<string, Agregado[]>();
for (const a of novos) {
  const k = `${tipoDoGrupo(a.grupo, a.subgrupo)}|||${categoria(a)}|||${a.nome.toLowerCase()}`;
  porChave.set(k, [...(porChave.get(k) ?? []), a]);
}
const colisoes = [...porChave.values()].filter((v) => v.length > 1);
if (colisoes.length) {
  console.error(`${colisoes.length} colisão(ões) de tipo+categoria+nome — resolva antes:`);
  for (const c of colisoes) console.error("  " + c.map((a) => `${a.nome} (${a.codigo})`).join(" / "));
  process.exit(1);
}

const brl = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const porGrupo = [...new Set(novos.map((a) => a.grupo))].sort();
const valores = novos
  .sort((a, b) => a.grupo.localeCompare(b.grupo) || a.subgrupo.localeCompare(b.subgrupo) || a.nome.localeCompare(b.nome))
  .map((a, n, arr) => {
    const linha = `  (${sql(a.codigo)}, ${sql(a.nome)}, ${sql(tipoDoGrupo(a.grupo, a.subgrupo))}, ${sql(categoria(a))}, ${precoModal(a)})`;
    // A vírgula vai ANTES do comentário; dentro dele, ela viraria texto.
    return linha + (n < arr.length - 1 ? "," : "") + `  -- ${a.grupo} · vendeu R$ ${brl(a.valor)}`;
  });

const totalNovos = novos.reduce((s, a) => s + a.valor, 0);
const totalTudo = [...porCodigo.values()].reduce((s, a) => s + a.valor, 0);

writeFileSync(saida, `-- Cadastra os ${novos.length} itens de venda do Beira Lago que ainda não existem.
-- GERADO por prisma/scripts/beira-lago/gerar-itens-venda.ts.
--
-- Fonte: export de vendas do XMenu, 01/10 a 20/10/2026.
-- ${porCodigo.size} itens no export · ${porCodigo.size - novos.length} já cadastrados · ${novos.length} a cadastrar.
-- Receita dos novos: R$ ${brl(totalNovos)} de R$ ${brl(totalTudo)}.
--
-- Por grupo do XMenu:
${porGrupo
  .map((g) => {
    const l = novos.filter((a) => a.grupo === g);
    return `--   ${g.padEnd(26)} ${String(l.length).padStart(3)} itens  R$ ${brl(l.reduce((s, a) => s + a.valor, 0)).padStart(12)}`;
  })
  .join("\n")}
--
-- O CÓDIGO VAI JUNTO, e é o ponto. Sem ele o casamento cai no nome, e nome é a
-- parte que a casa muda sozinha — foi por isso que 34 vinhos já cadastrados
-- não casaram na primeira carga. Com código, o item casa mesmo que o cardápio
-- seja reescrito amanhã.
--
-- O PREÇO é o modal por receita: o preço sob o qual mais dinheiro foi vendido.
-- Não é o último (pode ser uma cortesia de R$ 0,01) nem a média (mistura as
-- duas). ${[...porCodigo.values()].filter((a) => a.receitaPorPreco.size > 1).length} itens tiveram mais de um preço no período.
--
-- OS 4 ITENS DE EVENTO entram com preço R$ 1,00 de propósito: o painel manda
-- \`quantidade = valor em reais\`, então quantidade × preço reproduz o valor
-- vendido. É o único jeito de somar receita de evento sem inventar um item por
-- festa. Eles NÃO têm ficha e não devem ter: o custo de evento está diluído
-- na matéria-prima e só a contagem separa.
--
-- A CATEGORIA é o subgrupo do XMenu ("TINTO", "PRINCIPAIS"), enquanto os 190
-- itens antigos usam o vocabulário do dashboard ("Tintos", "Massas"). Ficam
-- dois vocabulários no mesmo cadastro — de propósito: o do XMenu é o que vai
-- continuar chegando, e traduzir seria adivinhar.
${EXCLUIDOS.length ? `--\n-- FORA DA LISTA, por não ser venda:\n${EXCLUIDOS.map((e) => `--   ${e.codigo} ${e.nome.trim()} — R$ ${brl(e.valor)}`).join("\n")}` : ""}

BEGIN;

INSERT INTO "ItemVenda" (id, "unidadeId", tipo, categoria, nome, "precoVenda", "codigoPdv", ativo, "criadoEm", "atualizadoEm")
SELECT
  'bv' || substr(md5(v.codigo), 1, 23),
  (SELECT id FROM "Unidade" WHERE nome = 'Beira Lago'),
  v.tipo,
  v.categoria,
  v.nome,
  v.preco,
  v.codigo,
  true,
  now(),
  now()
FROM (VALUES
${valores.join("\n")}
) AS v(codigo, nome, tipo, categoria, preco)
-- Nada entra por cima de item que já existe, nem pelo código nem pelo trio
-- (tipo, categoria, nome) — são os dois uniques da tabela, e bater num deles
-- derrubaria a carga inteira em vez de pular a linha.
WHERE NOT EXISTS (
  SELECT 1 FROM "ItemVenda" x
  WHERE x."unidadeId" = (SELECT id FROM "Unidade" WHERE nome = 'Beira Lago')
    AND x."codigoPdv" = v.codigo
)
AND NOT EXISTS (
  SELECT 1 FROM "ItemVenda" x
  WHERE x."unidadeId" = (SELECT id FROM "Unidade" WHERE nome = 'Beira Lago')
    AND x.tipo = v.tipo
    AND coalesce(x.categoria, '') = v.categoria
    AND x.nome = v.nome
);

COMMIT;

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA: quantos itens o Beira Lago tem agora, e quantos com código.
-- "com_codigo" é o que importa: é por ele que a venda casa.
-- ---------------------------------------------------------------------------
SELECT count(*) AS itens,
       count("codigoPdv") AS com_codigo,
       count("receitaId") AS com_ficha
FROM "ItemVenda" iv
JOIN "Unidade" u ON u.id = iv."unidadeId"
WHERE u.nome = 'Beira Lago';

-- Depois disto: chame POST /api/n8n/reprocessar-vendas com
-- { "unidade": "Beira Lago" } pra fazer entrar a semana 13-19/10 que ficou
-- gravada com 29 itens casados.
`);

console.log(`${porCodigo.size} itens no export, ${novos.length} a cadastrar -> ${saida}`);
for (const g of porGrupo) {
  const l = novos.filter((a) => a.grupo === g);
  console.log(`  ${g.padEnd(26)} ${String(l.length).padStart(3)}  R$ ${brl(l.reduce((s, a) => s + a.valor, 0))}`);
}
if (EXCLUIDOS.length) console.log(`  fora: ${EXCLUIDOS.map((e) => e.nome.trim()).join(", ")}`);
