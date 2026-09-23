// Prova de empate entre a resolução de hoje e a resolução com
// CodigoCompraProduto, contra um banco de verdade.
//
//   DATABASE_URL=... npx tsx prisma/scripts/codigo-compra/_conferir-paridade.ts
//
// Para cada linha de compra já gravada, e para todo par (código × unidade
// possível), as duas resoluções têm que devolver o MESMO produto, a MESMA via,
// o MESMO motivo de recusa e o MESMO fator. Sai com código 1 se divergir.
//
// POR QUE ISTO EXISTE. A cópia de 1-migrar-codigos-existentes.sql tem um único
// objetivo: não mudar nada. Conferir isso olhando contagem de linhas não basta
// — a primeira versão do passo 2 batia todas as contagens e mesmo assim fazia
// o ovo avulso parar de casar, porque trocava a unidade da linha em vez de
// acrescentar outra. Só rodando as duas resoluções lado a lado aparece.
//
// Rode contra uma CÓPIA do banco de produção antes de trocar a rota. Só lê.
//
// O underscore no nome marca script de apoio, como os outros desta base.
import { PrismaClient } from "@prisma/client";
import { montarIndiceProdutos, resolverLinhaCompraPura } from "@/lib/resolucao-produto-compra";

const prisma = new PrismaClient();

/** As unidades que uma nota pode trazer, incluindo os sinônimos. */
const UNIDADES_POSSIVEIS = ["KG", "LT", "UND", "CX", "GF", "FD", "LA", "BD", "PC", "PT"];

async function main() {
  const [produtos, conversoes, codigos, linhas] = await Promise.all([
    prisma.produto.findMany({ select: { id: true, nome: true, unidadeMedida: true, codigoTeknisa: true } }),
    prisma.conversaoUnidadeCompra.findMany({ select: { produtoId: true, unidadeCompra: true, fator: true } }),
    prisma.codigoCompraProduto.findMany({
      select: { origem: true, codigo: true, produtoId: true, unidadeCompra: true, fator: true },
    }),
    prisma.itemNotaCompra.findMany({ select: { nomeBruto: true, codigoBruto: true, unidadeBruta: true } }),
  ]);

  const hoje = montarIndiceProdutos(produtos, conversoes);
  const depois = montarIndiceProdutos(produtos, conversoes, codigos);

  // As linhas reais provam o que aconteceu; o produto cartesiano prova o que
  // poderia acontecer — é onde uma divergência se esconderia.
  const casos = [
    ...linhas.map((l) => ({ nome: l.nomeBruto, unidadeMedida: l.unidadeBruta ?? "", codigo: l.codigoBruto })),
    ...codigos.flatMap((c) =>
      UNIDADES_POSSIVEIS.map((u) => ({ nome: "(sondagem)", unidadeMedida: u, codigo: c.codigo }))
    ),
  ];

  let iguais = 0;
  const divergentes: string[] = [];
  for (const caso of casos) {
    const a = resolverLinhaCompraPura(caso, hoje);
    const b = resolverLinhaCompraPura(caso, depois);
    const mesmo =
      a.produto?.id === b.produto?.id &&
      a.via === b.via &&
      a.motivo === b.motivo &&
      a.fatorConversao === b.fatorConversao;
    if (mesmo) {
      iguais++;
      continue;
    }
    const conta = (r: typeof a) => `${r.produto?.nome ?? "—"} / ${r.via ?? r.motivo} / fator ${r.fatorConversao}`;
    divergentes.push(`${caso.codigo} em ${caso.unidadeMedida}:\n      hoje:   ${conta(a)}\n      depois: ${conta(b)}`);
  }

  console.log(`${produtos.length} produtos, ${conversoes.length} conversões, ${codigos.length} códigos na tabela nova`);
  console.log(`${linhas.length} linhas de compra + sondagem = ${casos.length} casos`);
  console.log(`\n${iguais} iguais, ${divergentes.length} DIVERGENTES`);
  for (const d of divergentes.slice(0, 40)) console.log("  ✗", d);
  if (divergentes.length > 40) console.log(`  ... e mais ${divergentes.length - 40}`);

  await prisma.$disconnect();
  if (divergentes.length) process.exit(1);
}

main();
