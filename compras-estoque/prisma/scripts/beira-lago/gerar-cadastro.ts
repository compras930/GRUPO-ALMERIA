// Gera o SQL que cadastra os produtos do Beira Lago que não casaram na
// primeira carga do XMenu, a partir do CSV de não reconhecidos.
//
//   npx tsx prisma/scripts/beira-lago/gerar-cadastro.ts <csv> [saida.sql]
//
// O script NÃO toca no banco. Ele escreve um .sql pra ser lido linha a linha
// antes de rodar — é o passo de revisão que o cadastro em massa exige.
//
// O NOME É O IDENTIFICADOR, e é por isso que este script existe. Sem código
// (o XMenu não manda um que possa ser usado — ver docs/n8n/contrato-integracao.md),
// a próxima carga vai casar por nome+unidade. Então o nome gravado tem que ser
// o nome que o XMenu manda. Qualquer "melhorada" na grafia — tirar o "- MUTUM",
// corrigir "BRÓCOLIS DE RÃMA", padronizar maiúscula — faz a linha deixar de
// casar e o produto voltar pra lista de não reconhecidos na semana seguinte.
//
// A ÚNICA coisa que o script muda no nome é espaço sobrando (ponta e duplo no
// meio), e isso não é liberdade: é o que normalizarNome faz nos DOIS lados do
// casamento (src/lib/nome-normalizado.ts). Gravar com o espaço sobrando não
// faria a linha casar melhor — faria o catálogo guardar " EVENTOS - AGUA..."
// com um espaço invisível na frente.
//
// A UNIDADE, ao contrário do nome, TEM que ser normalizada — e isso custou uma
// descoberta. O app resolve a unidade da linha por SINONIMO_UNIDADE antes de
// procurar o produto (normalizarUnidade, em resolucao-produto-compra.ts): uma
// linha em PCT vira CX. Se o produto fosse cadastrado com "PCT" cru, o
// casamento procuraria "nome|||CX" e não acharia nada — para sempre, e sem
// nenhuma mensagem, porque "não encontrado" é o mesmo texto de produto que não
// existe. Rodando a carga inteira contra o catálogo recém-criado, as 63 linhas
// em CX casaram e as 75 em PCT ficaram em 0/75 por exatamente isso.
//
// Por isso aqui se importa normalizarUnidade do app em vez de repetir a
// tabela: duas cópias da lista de sinônimos é como elas se separam.
import { readFileSync, writeFileSync } from "node:fs";
import { normalizarUnidade } from "@/lib/resolucao-produto-compra";

type Linha = {
  nome: string;
  /** Unidade JÁ normalizada — é com ela que o produto tem que ser cadastrado. */
  unidade: string;
  /** O que o XMenu escreveu, pra quem revisa ver que PCT virou CX. */
  unidadeBruta: string;
  grupo: string;
  valor: number;
  linhas: number;
  ultima: string;
};

/** Mesma regra de src/lib/nome-normalizado.ts — repetida aqui porque o script roda fora do app. */
const normalizarNome = (s: string) => s.trim().replace(/\s+/g, " ");
const sql = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** CSV com aspas e vírgula dentro do campo — o export tem os dois. */
function lerCsv(texto: string): Record<string, string>[] {
  const linhas: string[][] = [];
  let campo = "";
  let atual: string[] = [];
  let dentroDeAspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (dentroDeAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; } else dentroDeAspas = false;
      } else campo += c;
    } else if (c === '"') dentroDeAspas = true;
    else if (c === ",") { atual.push(campo); campo = ""; }
    else if (c === "\n") { atual.push(campo); linhas.push(atual); atual = []; campo = ""; }
    else if (c !== "\r") campo += c;
  }
  if (campo || atual.length) { atual.push(campo); linhas.push(atual); }
  const [cab, ...resto] = linhas;
  return resto
    .filter((l) => l.some((c) => c !== ""))
    .map((l) => Object.fromEntries(cab.map((h, i) => [h.trim(), l[i] ?? ""])));
}

const [, , caminhoCsv, caminhoSaida = "prisma/scripts/beira-lago/2-cadastro.sql"] = process.argv;
if (!caminhoCsv) {
  console.error("uso: npx tsx prisma/scripts/beira-lago/gerar-cadastro.ts <csv> [saida.sql]");
  process.exit(1);
}

const itens: Linha[] = lerCsv(readFileSync(caminhoCsv, "utf-8")).map((r) => ({
  nome: normalizarNome(r.nome),
  unidade: normalizarUnidade(r.unidadeMedida),
  unidadeBruta: r.unidadeMedida.trim().toUpperCase(),
  grupo: r.grupo.trim(),
  valor: Number(r.valor_total),
  linhas: Number(r.linhas),
  ultima: r.ultima_compra,
}));

// Duas linhas que viram a MESMA chave de casamento não podem virar dois
// produtos: a segunda carga escolheria uma das duas e a outra ficaria sem
// preço pra sempre, sem reclamar. Se isso aparecer, é pra resolver na mão.
const porChave = new Map<string, Linha[]>();
for (const i of itens) {
  const k = `${i.nome.toLowerCase()}|||${i.unidade}`;
  porChave.set(k, [...(porChave.get(k) ?? []), i]);
}
const colisoes = [...porChave.values()].filter((v) => v.length > 1);
if (colisoes.length) {
  console.error(`${colisoes.length} colisão(ões) de nome+unidade no CSV — resolva antes:`);
  for (const c of colisoes) console.error("  ", c.map((x) => `${x.nome} (${x.unidade})`).join(" / "));
  process.exit(1);
}

const grupos = [...new Set(itens.map((i) => i.grupo))].sort(
  (a, b) =>
    itens.filter((i) => i.grupo === b).reduce((s, i) => s + i.valor, 0) -
    itens.filter((i) => i.grupo === a).reduce((s, i) => s + i.valor, 0)
);
const total = itens.reduce((s, i) => s + i.valor, 0);
const brl = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const out: string[] = [];
out.push(`-- Cadastro dos produtos do Beira Lago não reconhecidos na 1ª carga do XMenu.
-- GERADO por prisma/scripts/beira-lago/gerar-cadastro.ts — não edite à mão sem
-- reler o cabeçalho daquele arquivo.
--
-- ${itens.length} produtos, ${itens.reduce((s, i) => s + i.linhas, 0)} linhas de compra, R$ ${brl(total)}.
--
-- ORDEM: rode os passos 1 a 4 e LEIA o que eles devolvem. O passo 5 é o único
-- que escreve. O passo 3 é o que mais importa: produto que já existe no
-- catálogo com OUTRA unidade não deve ser cadastrado de novo.
--
-- O nome vai EXATAMENTE como o XMenu escreve (só sem espaço sobrando), porque
-- é por ele que a próxima carga casa. Não "arrume" grafia aqui.
--
-- A UNIDADE, essa sim, vai normalizada (PCT -> CX, FD -> CX, UN -> UND...),
-- porque o app normaliza a unidade da LINHA antes de procurar o produto.
-- Cadastrar "PCT" faria a busca por "CX" não achar nada, calada.
${(() => {
  const trocadas = itens.filter((i) => i.unidade !== i.unidadeBruta);
  const por = [...new Set(trocadas.map((i) => `${i.unidadeBruta} -> ${i.unidade}`))];
  return trocadas.length
    ? `-- Trocadas aqui: ${por.join(", ")} (${trocadas.length} produtos, ${trocadas.reduce((s, i) => s + i.linhas, 0)} linhas).`
    : "-- Nenhuma unidade precisou de troca nesta lista.";
})()}
--
-- Por grupo:
${grupos
  .map((g) => {
    const l = itens.filter((i) => i.grupo === g);
    return `--   ${g.padEnd(26)} ${String(l.length).padStart(3)} produtos  R$ ${brl(l.reduce((s, i) => s + i.valor, 0)).padStart(10)}`;
  })
  .join("\n")}
--
-- SEM transação em volta do arquivo inteiro, de propósito. A revisão só é
-- revisão se der pra PARAR entre o passo 4 e o passo 5 — e uma transação
-- aberta no console do Neon não sobrevive a essa pausa (nem a tabela de
-- trabalho sobreviveria). Então: passos 1 a 4 numa execução, leia, e só depois
-- o passo 5. O 5 tem BEGIN/COMMIT próprios, que é onde a transação serve pra
-- alguma coisa: ou os 396 entram, ou nenhum entra.

-- ---------------------------------------------------------------------------
-- 1. A lista, numa tabela de trabalho (não é TEMP: TEMP sumiria entre uma
--    execução e outra, e é justamente entre elas que a revisão acontece).
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS "_bl_cadastro";
CREATE TABLE "_bl_cadastro" (
  nome          text,
  unidade       text,  -- já normalizada: é esta que vai pro cadastro
  unidade_bruta text,  -- o que o XMenu escreveu
  grupo         text,
  valor         numeric,
  linhas        int,
  ultima        date
);

INSERT INTO "_bl_cadastro" (nome, unidade, unidade_bruta, grupo, valor, linhas, ultima) VALUES`);

const valores: string[] = [];
const comentario = new Map<number, string>();
for (const g of grupos) {
  const lista = itens.filter((i) => i.grupo === g).sort((a, b) => b.valor - a.valor);
  valores.push(`-- ${g} — ${lista.length} produtos, R$ ${brl(lista.reduce((s, i) => s + i.valor, 0))}`);
  for (const i of lista) {
    valores.push(
      `  (${sql(i.nome)}, ${sql(i.unidade)}, ${sql(i.unidadeBruta)}, ${sql(i.grupo)}, ${i.valor}, ${i.linhas}, ${sql(i.ultima)})`
    );
    comentario.set(valores.length - 1, i.unidade !== i.unidadeBruta ? `  -- ${i.unidadeBruta} -> ${i.unidade}` : "");
  }
}
// Vírgula só entre linhas de valor — os comentários de grupo não contam. E ela
// vai ANTES do comentário de unidade, senão vira parte dele e o SQL quebra.
const indicesDeValor = valores.map((v, n) => (v.startsWith("  (") ? n : -1)).filter((n) => n >= 0);
for (const n of indicesDeValor.slice(0, -1)) valores[n] += ",";
valores[indicesDeValor[indicesDeValor.length - 1]] += ";";
for (const [n, c] of comentario) valores[n] += c;
out.push(valores.join("\n"));

out.push(`
-- ---------------------------------------------------------------------------
-- 2. CONFERÊNCIA: nome+unidade que JÁ existe no catálogo.
--    Tem que voltar VAZIO. Se voltar alguma coisa, a linha devia ter casado na
--    carga e não casou — aí o problema é outro (grafia invisível, caractere
--    diferente) e cadastrar de novo esconderia o problema em vez de resolver.
-- ---------------------------------------------------------------------------
SELECT c.nome, c.unidade, p.nome AS ja_cadastrado, p."unidadeMedida"
FROM "_bl_cadastro" c
JOIN "Produto" p
  ON lower(regexp_replace(btrim(p.nome), '\\s+', ' ', 'g')) = lower(c.nome)
 AND p."unidadeMedida" = c.unidade;

-- ---------------------------------------------------------------------------
-- 3. O PASSO QUE DECIDE: mesmo nome, OUTRA unidade de medida.
--    O casamento exige nome E unidade (src/lib/resolucao-produto-compra.ts,
--    passo 2 — não existe queda pra nome sozinho). Então um produto já
--    cadastrado em UND que o XMenu compra em CX não casa, e cadastrar um
--    segundo produto com o mesmo nome em CX PARTE O ESTOQUE EM DOIS: metade da
--    compra num, a contagem no outro, e o consumo de ambos sai errado.
--
--    O certo nesses casos é UM dos dois:
--      a) o cadastro está na unidade errada -> corrigir o Produto; ou
--      b) são embalagens do mesmo produto -> ConversaoUnidadeCompra
--         (produtoId, unidadeCompra, fator), e NÃO cadastrar aqui.
--    Tire do passo 5 o que aparecer aqui.
-- ---------------------------------------------------------------------------
SELECT c.nome, c.unidade AS unidade_da_compra, p."unidadeMedida" AS unidade_cadastrada,
       p.id AS produto_id, c.valor
FROM "_bl_cadastro" c
JOIN "Produto" p
  ON lower(regexp_replace(btrim(p.nome), '\\s+', ' ', 'g')) = lower(c.nome)
 AND p."unidadeMedida" <> c.unidade
ORDER BY c.valor DESC;

-- ---------------------------------------------------------------------------
-- 4. PARECIDOS: mesmas duas primeiras palavras de um produto que já existe.
--    Não é erro — "QUEIJO BRIE SÃO VICENTE 1KG" e "QUEIJO BRIE" podem ser a
--    mesma coisa ou não. É a lista pra olhar com olho humano antes de criar
--    mais um "BURRATA"/"Burrata" no catálogo.
-- ---------------------------------------------------------------------------
SELECT c.nome AS a_cadastrar, c.unidade, p.nome AS parecido_ja_existente,
       p."unidadeMedida", c.valor
FROM "_bl_cadastro" c
JOIN "Produto" p
  ON lower(split_part(p.nome, ' ', 1) || ' ' || split_part(p.nome, ' ', 2))
   = lower(split_part(c.nome, ' ', 1) || ' ' || split_part(c.nome, ' ', 2))
WHERE lower(regexp_replace(btrim(p.nome), '\\s+', ' ', 'g')) <> lower(c.nome)
ORDER BY c.valor DESC;

-- ---------------------------------------------------------------------------
-- 5. O CADASTRO. É o único passo que escreve.
--
--    AJUSTE A LISTA DE GRUPOS. Cadastrar tudo deixa a compra inteira do Beira
--    Lago visível — que é o que se quer pra "quanto foi gasto". Mas três
--    grupos NÃO são matéria-prima de prato vendido:
--
--      ALIMENTAÇÃO FUNCIONÁRIO    R$ 34.979,66
--      HIGIENE E LIMPEZA          R$ 26.743,50
--      DESCARTÁVEIS E EMBALAGENS  R$ 24.665,20
--
--    Hoje a tela de consumo (src/app/(app)/estoque/consumo/page.tsx) não filtra
--    por categoria: tudo que tiver saldo e contagem entra no mesmo número. A
--    categoria vai gravada justamente pra dar o filtro depois — mas enquanto o
--    filtro não existe, esses R$ 86 mil aparecem junto do CMV se forem contados.
--
--    Comente a linha do grupo que não quiser cadastrar AGORA.
--
--    O NOT EXISTS é case-insensitive de propósito: o unique do Postgres é
--    byte a byte, então sem ele "Queijo Gouda" e "QUEIJO GOUDA" entrariam os
--    dois e o casamento (que ignora caixa) passaria a ter duas respostas.
-- ---------------------------------------------------------------------------
BEGIN;

INSERT INTO "Produto" (id, nome, "unidadeMedida", categoria, ativo, "criadoEm")
SELECT
  'bl' || substr(md5(c.nome || '|' || c.unidade), 1, 23),
  c.nome,
  c.unidade,
  c.grupo,
  true,
  now()
FROM "_bl_cadastro" c
WHERE c.grupo IN (
  'VINHOS',
  'MATERIA PRIMA',
  'BEBIDAS',
  'EVENTOS',
  'ALIMENTAÇÃO FUNCIONÁRIO',
  'HIGIENE E LIMPEZA',
  'DESCARTÁVEIS E EMBALAGENS'
)
AND NOT EXISTS (
  SELECT 1 FROM "Produto" p
  WHERE lower(regexp_replace(btrim(p.nome), '\\s+', ' ', 'g')) = lower(c.nome)
    AND p."unidadeMedida" = c.unidade
);

COMMIT;

-- ---------------------------------------------------------------------------
-- 6. CONFERÊNCIA FINAL: quantos dos ${itens.length} existem agora, por grupo.
--    "faltam" só pode ser > 0 nos grupos que você comentou no passo 5, ou nos
--    que o passo 3 mandou tirar.
-- ---------------------------------------------------------------------------
SELECT c.grupo,
       count(*) AS na_lista,
       count(p.id) AS cadastrados,
       count(*) - count(p.id) AS faltam,
       round(sum(c.valor), 2) AS valor
FROM "_bl_cadastro" c
LEFT JOIN "Produto" p
  ON lower(regexp_replace(btrim(p.nome), '\\s+', ' ', 'g')) = lower(c.nome)
 AND p."unidadeMedida" = c.unidade
GROUP BY c.grupo
ORDER BY valor DESC;

-- ---------------------------------------------------------------------------
-- 7. LIMPEZA, só depois de conferir o passo 6. Descomente e rode.
--    A tabela não atrapalha nada se ficar — ela só não é do app.
-- ---------------------------------------------------------------------------
-- DROP TABLE "_bl_cadastro";

-- Depois do passo 5: mande a MESMA carga de novo pela rota /api/n8n/precos.
-- Nada duplica — a \`chave\` XMENU|id_entrada|sequencia já está gravada e as
-- linhas repetidas são puladas. O que muda é que agora elas casam: preço e
-- entrada de estoque entram para os produtos recém-criados, com a data da
-- nota (não a data da carga). \`naoReconhecidos\` tem que cair de ${itens.length} para
-- perto de zero.
`);

writeFileSync(caminhoSaida, out.join("\n"));
console.log(`${itens.length} produtos, R$ ${brl(total)} -> ${caminhoSaida}`);
for (const g of grupos) {
  const l = itens.filter((i) => i.grupo === g);
  console.log(`  ${g.padEnd(26)} ${String(l.length).padStart(3)}  R$ ${brl(l.reduce((s, i) => s + i.valor, 0))}`);
}
