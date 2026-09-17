// Preenche ItemVenda.codigoPdv a partir de uma exportação de vendas do PDV.
//
// SÓ CASAMENTO EXATO DE NOME. O relatório de casamento (casar3.py) usa
// similaridade pra sugerir pares como "FILE AU POIVRE WINE" -> "Filé au
// Poivre"; aqueles são palpite e precisam de olho humano. Este script não
// palpita: grava o código só onde o nome é o MESMO — ignorando caixa, espaço
// e acento, que são normalização e não semelhança (ver chaveSemAcento). Nome
// parecido não conta. O resto sai num relatório de pendências, item a item.
//
// A razão é a mesma do resto do projeto: gravar um identificador a partir de
// um casamento por texto congela o palpite como se fosse identidade. Errar
// aqui é pior que não preencher — um código errado faz a venda de um prato
// entrar na ficha de outro, silenciosamente, toda semana.
//
// Dry-run por padrão. Passe --commit pra gravar, ou --sql pra imprimir o
// comando a colar no console do Neon (produção não é alcançável daqui, o
// mesmo motivo de todo script SQL deste diretório).
//
//   npx tsx prisma/scripts/backfill-codigo-pdv.ts "<casa>" <planilha.xlsx> [--commit|--sql]
//
// Formatos aceitos (detectado pelo cabeçalho):
//   Teknisa  — colunas Unidade/Modalidade/Código/Produto/... (104 Sul, Wine Garden, Noroeste)
//   Xmenu    — Código/Nome/Quantidade/Valor Total, com linhas Data:/Grupo:/Subgrupo: (Beira Lago)
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import { chaveComparacao } from "../../src/lib/nome-normalizado";

const prisma = new PrismaClient();

/**
 * chaveComparacao + acento removido. Segunda passada do casamento, só pros
 * códigos que não acharam nada na primeira.
 *
 * Isto NÃO é similaridade: "PAELLA ALMERIA" e "Paella Almería" são a mesma
 * string a menos de diacrítico, não dois nomes parecidos. Dois pratos
 * diferentes na mesma casa que se distingam só por um acento seriam um
 * problema de cadastro, não um par legítimo — e se existirem, caem na
 * checagem de ambiguidade abaixo e viram pendência, não gravação errada.
 *
 * Medido no cadastro de setembro/2026: nenhuma ambiguidade nova nas 4 casas.
 */
function chaveSemAcento(nome: string): string {
  return chaveComparacao(nome).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

type LinhaPdv = { codigo: string; nome: string };

/**
 * Código como texto, a partir do valor CRU da célula.
 *
 * O Teknisa grava o código como número com formato de exibição científico: a
 * célula é {v: 121000000103, w: "1.21E+11"}. Ler o texto formatado (raw:false)
 * transforma centenas de códigos distintos em meia dúzia de "1.21E+11" — foi
 * o que aconteceu na primeira versão deste script, que reportou 36 códigos
 * distintos numa planilha de 3.774 linhas e acusou "o mesmo código veio com
 * nomes diferentes" 32 vezes. O sintoma parecia dado sujo; era o leitor.
 *
 * Zero à esquerda: se o PDV exporta o código como número, a planilha já perdeu
 * qualquer zero inicial antes de chegar aqui. Não dá pra recuperar — só pra
 * garantir que os dois lados (planilha e cadastro) percam igual.
 */
function paraCodigo(valor: unknown): string {
  if (valor == null) return "";
  if (typeof valor === "number") {
    // Código não é medida: qualquer coisa com casa decimal não é um código.
    if (!Number.isInteger(valor)) return "";
    return String(valor);
  }
  return String(valor).trim();
}

/**
 * Alguns exportadores declaram um !ref menor que a planilha de verdade — o
 * relatório do Xmenu chega com "A1:C1" e 8.280 células preenchidas até a linha
 * 2.174. sheet_to_json respeita o !ref e devolveria só o cabeçalho. Recalcula
 * o intervalo a partir das células que existem de fato.
 */
function corrigirIntervalo(ws: XLSX.WorkSheet) {
  const celulas = Object.keys(ws).filter((k) => !k.startsWith("!"));
  if (celulas.length === 0) return;
  let maxL = 0;
  let maxC = 0;
  for (const k of celulas) {
    const { r, c } = XLSX.utils.decode_cell(k);
    if (r > maxL) maxL = r;
    if (c > maxC) maxC = c;
  }
  const declarado = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"] as string) : null;
  if (declarado && declarado.e.r >= maxL && declarado.e.c >= maxC) return;
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxL, c: maxC } });
}

function lerPlanilha(caminho: string): LinhaPdv[] {
  const wb = XLSX.readFile(caminho);
  const ws = wb.Sheets[wb.SheetNames[0]];
  corrigirIntervalo(ws);
  // raw:true — ver paraCodigo(): o texto formatado destrói o código.
  const linhas = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: "" });
  if (linhas.length === 0) throw new Error("Planilha vazia.");

  const cabecalho = linhas[0].map((c) => String(c).trim());
  const ehTeknisa = cabecalho.includes("Produto") && cabecalho.includes("Código");
  const ehXmenu = cabecalho[0] === "Código" && cabecalho[1] === "Nome";
  if (!ehTeknisa && !ehXmenu) {
    throw new Error(`Cabeçalho não reconhecido: ${cabecalho.slice(0, 6).join(" | ")}`);
  }

  const out: LinhaPdv[] = [];
  if (ehTeknisa) {
    const iCod = cabecalho.indexOf("Código");
    const iNome = cabecalho.indexOf("Produto");
    for (const l of linhas.slice(1)) {
      const codigo = paraCodigo(l[iCod]);
      const nome = String(l[iNome] ?? "").trim();
      if (codigo && nome) out.push({ codigo, nome });
    }
  } else {
    // Xmenu: hierárquico. Linhas de cabeçalho de seção (Data:/Grupo:/Subgrupo:)
    // não são itens, e a ÚLTIMA linha do arquivo é o total geral — ela tem um
    // número na coluna de código (a contagem de itens) e nenhum nome.
    for (let i = 1; i < linhas.length; i++) {
      const bruto = String(linhas[i][0] ?? "").trim();
      const nome = String(linhas[i][1] ?? "").trim();
      if (!bruto || !nome) continue;
      if (/^(Data|Grupo|Subgrupo):/.test(bruto)) continue;
      const codigo = paraCodigo(linhas[i][0]);
      if (codigo) out.push({ codigo, nome });
    }
  }
  return out;
}

/**
 * Imprime o UPDATE pra colar no console do Neon.
 *
 * Casa por (casa, nome do item) e não por id: os ids de produção e os do banco
 * local são cuids gerados em importações separadas, não são os mesmos. O nome
 * usado é o do CADASTRO (não o da planilha), então o casamento aqui é
 * literalmente exato — o folding de acento já foi resolvido antes.
 *
 * O guard `EXISTS ... HAVING count(*) = 1` recusa gravar num nome que exista
 * duas vezes na casa: em produção pode haver homônimo que o banco local não
 * tem, e gravar código no item errado é o pior desfecho possível aqui.
 */
function sqlEscape(s: string) {
  return s.replace(/'/g, "''");
}

function imprimirSql(casa: string, aGravar: { nome: string; codigo: string }[]) {
  if (aGravar.length === 0) {
    console.log(`-- ${casa}: nada a gravar.`);
    return;
  }
  const valores = aGravar
    .map((g) => `  ('${sqlEscape(casa)}', '${sqlEscape(g.nome)}', '${sqlEscape(g.codigo)}')`)
    .join(",\n");
  console.log(`
-- ${casa} — ${aGravar.length} códigos
WITH mapa(casa, item, codigo) AS (VALUES
${valores}
)
UPDATE "ItemVenda" iv
SET "codigoPdv" = m.codigo
FROM mapa m
JOIN "Unidade" un ON un.nome = m.casa
WHERE iv."unidadeId" = un.id
  AND lower(btrim(iv.nome)) = lower(btrim(m.item))
  AND iv."codigoPdv" IS NULL          -- nunca sobrescreve código já gravado
  AND 1 = (SELECT count(*) FROM "ItemVenda" x
            WHERE x."unidadeId" = un.id
              AND lower(btrim(x.nome)) = lower(btrim(m.item)));
`);
}

async function main() {
  const [casa, caminho] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const commit = process.argv.includes("--commit");
  const comoSql = process.argv.includes("--sql");
  if (!casa || !caminho) {
    console.error('Uso: npx tsx prisma/scripts/backfill-codigo-pdv.ts "<casa>" <planilha.xlsx> [--commit]');
    process.exit(1);
  }

  const unidade = await prisma.unidade.findUnique({ where: { nome: casa } });
  if (!unidade) {
    const todas = await prisma.unidade.findMany({ select: { nome: true } });
    throw new Error(`Casa "${casa}" não existe. Casas: ${todas.map((u) => u.nome).join(", ")}`);
  }

  // Um código pode aparecer em várias linhas da planilha (uma por dia ou por
  // modalidade). Agrupamos por código; se o mesmo código vier com nomes
  // diferentes, isso por si só é um achado e a linha não é usada.
  const nomesPorCodigo = new Map<string, Set<string>>();
  for (const { codigo, nome } of lerPlanilha(caminho)) {
    const s = nomesPorCodigo.get(codigo) ?? new Set<string>();
    s.add(nome);
    nomesPorCodigo.set(codigo, s);
  }

  const itens = await prisma.itemVenda.findMany({
    where: { unidadeId: unidade.id },
    select: { id: true, nome: true, codigoPdv: true },
  });
  const porNome = new Map<string, typeof itens>();
  const porNomeSemAcento = new Map<string, typeof itens>();
  for (const iv of itens) {
    const k = chaveComparacao(iv.nome);
    porNome.set(k, [...(porNome.get(k) ?? []), iv]);
    const ks = chaveSemAcento(iv.nome);
    porNomeSemAcento.set(ks, [...(porNomeSemAcento.get(ks) ?? []), iv]);
  }

  const aGravar: { id: string; nome: string; codigo: string; viaAcento: boolean }[] = [];
  const pendencias: { codigo: string; nome: string; motivo: string }[] = [];
  const codigoPorItem = new Map<string, string>(); // detecta 2 códigos pro mesmo item

  for (const [codigo, nomes] of nomesPorCodigo) {
    if (nomes.size > 1) {
      pendencias.push({ codigo, nome: [...nomes].join(" | "), motivo: "o mesmo código veio com nomes diferentes" });
      continue;
    }
    const nome = [...nomes][0];
    // 1a passada: nome idêntico (a menos de caixa/espaço).
    // 2a passada, só se a 1a não achou nada: idem, ignorando acento.
    let candidatos = porNome.get(chaveComparacao(nome)) ?? [];
    let viaAcento = false;
    if (candidatos.length === 0) {
      candidatos = porNomeSemAcento.get(chaveSemAcento(nome)) ?? [];
      viaAcento = candidatos.length > 0;
    }
    if (candidatos.length === 0) {
      pendencias.push({ codigo, nome, motivo: "não existe item de venda com esse nome" });
      continue;
    }
    if (candidatos.length > 1) {
      pendencias.push({ codigo, nome, motivo: `${candidatos.length} itens de venda com esse nome` });
      continue;
    }
    const item = candidatos[0];
    if (item.codigoPdv === codigo) continue; // já está gravado, nada a fazer
    if (item.codigoPdv) {
      pendencias.push({ codigo, nome, motivo: `o item já tem o código ${item.codigoPdv}` });
      continue;
    }
    const jaVisto = codigoPorItem.get(item.id);
    if (jaVisto) {
      pendencias.push({ codigo, nome, motivo: `o mesmo item já casou com o código ${jaVisto}` });
      continue;
    }
    codigoPorItem.set(item.id, codigo);
    aGravar.push({ id: item.id, nome: item.nome, codigo, viaAcento });
  }

  if (comoSql) {
    imprimirSql(unidade.nome, aGravar);
    return;
  }

  console.log(`\nCasa: ${unidade.nome}`);
  console.log(`Itens de venda cadastrados: ${itens.length} (${itens.filter((i) => i.codigoPdv).length} já com código)`);
  console.log(`Códigos distintos na planilha: ${nomesPorCodigo.size}`);
  const porAcento = aGravar.filter((g) => g.viaAcento).length;
  console.log(
    `\nCasam e serão preenchidos: ${aGravar.length}` +
      (porAcento ? ` (${aGravar.length - porAcento} por nome idêntico, ${porAcento} ignorando acento)` : "")
  );
  for (const g of aGravar.slice(0, 20)) {
    console.log(`  ${g.codigo.padEnd(14)} ${g.nome}${g.viaAcento ? "   [acento]" : ""}`);
  }
  if (aGravar.length > 20) console.log(`  ... e mais ${aGravar.length - 20}`);

  console.log(`\nPendências (NÃO preenchidas, decisão humana): ${pendencias.length}`);
  const porMotivo = new Map<string, number>();
  for (const p of pendencias) porMotivo.set(p.motivo, (porMotivo.get(p.motivo) ?? 0) + 1);
  for (const [motivo, n] of [...porMotivo].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${motivo}`);

  if (!commit) {
    console.log("\n(dry-run — nada foi gravado. Rode com --commit pra aplicar.)");
    return;
  }
  for (const g of aGravar) {
    await prisma.itemVenda.update({ where: { id: g.id }, data: { codigoPdv: g.codigo } });
  }
  console.log(`\n${aGravar.length} códigos gravados.`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
