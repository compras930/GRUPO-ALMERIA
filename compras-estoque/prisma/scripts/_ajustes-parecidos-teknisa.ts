// Ajustes manuais confirmados pelo usuário sobre os 17 "parecidos" da
// comparação Teknisa x compras-estoque (104 Sul):
//  - 5 são produtos DIFERENTES apesar do nome parecido -> cadastra como novo
//  - CHORIZO CANTIPALO e COGUMELO PORTO BELLO são o mesmo produto (nome com
//    erro de digitação no lado Teknisa) -> só atualiza o preço
//  - LINGUIÇA TIPO CALABRESA é o mesmo produto que "LINGUICA CALABRESA" do
//    Teknisa, mas cadastrada com unidade errada (UNIDADE) -> corrige pra KG
//    (as 2 receitas que já usam esse insumo têm quantidade 0.18, plausível
//    como 0.18 KG numa sopa — não como "0.18 de uma linguiça inteira" — não
//    precisa reescalar, só corrigir o rótulo da unidade)
import { PrismaClient } from "@prisma/client";
import { normalizarNome } from "../../src/lib/nome-normalizado";

const prisma = new PrismaClient();

type Novo = { nome: string; unidade: string; custo: number; data: string };
const NOVOS: Novo[] = [
  { nome: "COXA E SOBRECOXA DE FRANGO KG", unidade: "KG", custo: 15.99, data: "01/09/2026" },
  { nome: "PIMENTAO VERDE KG", unidade: "KG", custo: 6, data: "31/08/2026" },
  { nome: "FRAMBOESA CONGELADA KG", unidade: "KG", custo: 55, data: "13/08/2026" },
  { nome: "AÇUCAR REFINADO SACHE CX", unidade: "CX", custo: 15.83, data: "29/07/2026" },
  { nome: "POLPA DE FRUTAS VERMELHAS KG", unidade: "KG", custo: 21.7, data: "24/08/2026" },
];

type Preco = { nomeExistente: string; unidadeExistente: string; custo: number; data: string };
const ATUALIZACOES_PRECO: Preco[] = [
  { nomeExistente: "CHORIZO CANTIPALO", unidadeExistente: "KG", custo: 153.98, data: "26/08/2026" },
  { nomeExistente: "COGUMELO PORTO BELLO", unidadeExistente: "KG", custo: 54, data: "21/08/2026" },
];

function parseDataBr(s: string): Date {
  const [d, m, y] = s.split("/").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

async function main() {
  const unidade = await prisma.unidade.findFirst({ where: { nome: "104 Sul" } });
  if (!unidade) throw new Error("104 Sul não encontrada");

  // 1) cadastra os 5 realmente novos
  for (const item of NOVOS) {
    const nome = normalizarNome(item.nome);
    const unidadeMedida = normalizarNome(item.unidade).toUpperCase();
    const produto = await prisma.produto.upsert({
      where: { nome_unidadeMedida: { nome, unidadeMedida } },
      update: {},
      create: { nome, unidadeMedida },
    });
    const dataCompra = parseDataBr(item.data);
    const existente = await prisma.precoAtualProduto.findUnique({
      where: { unidadeId_produtoId: { unidadeId: unidade.id, produtoId: produto.id } },
    });
    if (!existente) {
      await prisma.precoAtualProduto.create({ data: { unidadeId: unidade.id, produtoId: produto.id, preco: item.custo, dataCompra } });
    }
    const jaTemHistorico = await prisma.historicoPrecoProduto.findFirst({
      where: { unidadeId: unidade.id, produtoId: produto.id, origem: "IMPORTACAO_TEKNISA_MANUAL" },
    });
    if (!jaTemHistorico) {
      await prisma.historicoPrecoProduto.create({
        data: { unidadeId: unidade.id, produtoId: produto.id, preco: item.custo, origem: "IMPORTACAO_TEKNISA_MANUAL", origemId: nome, dataCompra },
      });
    }
    console.log(`Novo: ${nome} (${unidadeMedida}) — preço ${item.custo}`);
  }

  // 2) atualiza preço dos 2 confirmados como "mesmo produto, só nome diferente"
  for (const item of ATUALIZACOES_PRECO) {
    const produto = await prisma.produto.findUnique({
      where: { nome_unidadeMedida: { nome: item.nomeExistente, unidadeMedida: item.unidadeExistente } },
    });
    if (!produto) { console.log(`AVISO: não achei ${item.nomeExistente} (${item.unidadeExistente})`); continue; }
    const dataCompra = parseDataBr(item.data);
    const existente = await prisma.precoAtualProduto.findUnique({
      where: { unidadeId_produtoId: { unidadeId: unidade.id, produtoId: produto.id } },
    });
    if (!existente || dataCompra > existente.dataCompra) {
      await prisma.precoAtualProduto.upsert({
        where: { unidadeId_produtoId: { unidadeId: unidade.id, produtoId: produto.id } },
        update: { preco: item.custo, dataCompra },
        create: { unidadeId: unidade.id, produtoId: produto.id, preco: item.custo, dataCompra },
      });
      console.log(`Preço atualizado: ${item.nomeExistente} -> ${item.custo}`);
    } else {
      console.log(`Preço de ${item.nomeExistente} já mais recente que o Teknisa (${existente.dataCompra.toISOString()} > ${dataCompra.toISOString()}) — mantido`);
    }
    const jaTemHistorico = await prisma.historicoPrecoProduto.findFirst({
      where: { unidadeId: unidade.id, produtoId: produto.id, origem: "IMPORTACAO_TEKNISA_MANUAL" },
    });
    if (!jaTemHistorico) {
      await prisma.historicoPrecoProduto.create({
        data: { unidadeId: unidade.id, produtoId: produto.id, preco: item.custo, origem: "IMPORTACAO_TEKNISA_MANUAL", origemId: item.nomeExistente, dataCompra },
      });
    }
  }

  // 3) corrige unidade errada da LINGUIÇA TIPO CALABRESA (UNIDADE -> KG), sem reescalar quantidade
  const linguica = await prisma.produto.findUnique({
    where: { nome_unidadeMedida: { nome: "LINGUIÇA TIPO CALABRESA", unidadeMedida: "UNIDADE" } },
  });
  if (linguica) {
    const jaExisteEmKg = await prisma.produto.findUnique({
      where: { nome_unidadeMedida: { nome: "LINGUIÇA TIPO CALABRESA", unidadeMedida: "KG" } },
    });
    if (jaExisteEmKg) {
      console.log("AVISO: já existe 'LINGUIÇA TIPO CALABRESA' em KG — precisa de merge manual, não mexi.");
    } else {
      await prisma.produto.update({ where: { id: linguica.id }, data: { unidadeMedida: "KG" } });
      await prisma.ingredienteReceita.updateMany({ where: { produtoId: linguica.id }, data: { unidadeMedida: "KG" } });
      const dataCompra = parseDataBr("27/08/2026");
      await prisma.precoAtualProduto.upsert({
        where: { unidadeId_produtoId: { unidadeId: unidade.id, produtoId: linguica.id } },
        update: { preco: 467.2, dataCompra },
        create: { unidadeId: unidade.id, produtoId: linguica.id, preco: 467.2, dataCompra },
      });
      console.log("LINGUIÇA TIPO CALABRESA: unidade corrigida pra KG, preço atualizado.");
    }
  } else {
    console.log("AVISO: não achei 'LINGUIÇA TIPO CALABRESA' (UNIDADE) — já foi mexido antes?");
  }

  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
