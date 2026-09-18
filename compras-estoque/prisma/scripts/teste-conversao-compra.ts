// Prova, contra banco de verdade, que a conversão de embalagem faz a conta na
// direção certa: preço DIVIDE pelo fator, quantidade MULTIPLICA.
//
// Um sinal invertido aqui gravaria R$ 170 como preço de um ovo (ou R$ 0,47 como
// preço da caixa) e ninguém perceberia pelo formato — os dois são números
// plausíveis. Por isso o teste confere o número, não o caminho.
import { prisma } from "@/lib/prisma";
import { processarNotaCompra } from "@/lib/nota-compra";

async function main() {
  const unidade = await prisma.unidade.findFirst({ where: { estoqueEmId: null } });
  const usuario = await prisma.usuario.findFirst();
  if (!unidade || !usuario) throw new Error("banco sem base");

  const codigo = `999${Date.now()}`.slice(0, 12);
  const produto = await prisma.produto.create({
    data: { nome: `TESTE CONVERSAO ${Date.now()}`, unidadeMedida: "KG", codigoTeknisa: codigo },
  });
  // 1 bandeja = 40 g, como o microverde real.
  await prisma.conversaoUnidadeCompra.create({
    data: { produtoId: produto.id, unidadeCompra: "UND", fator: 0.04, observacao: "teste" },
  });

  const r = await processarNotaCompra(
    unidade.nome,
    "teste-conversao",
    // Nome propositalmente sem relação nenhuma: quem tem que casar é o CÓDIGO.
    [{ nome: "qualquer coisa", unidadeMedida: "UND", preco: 15, dataCompra: "2026-09-18", quantidade: 10, codigo, chave: `CONV|${produto.id}` }],
    usuario.id
  );

  const preco = (await prisma.precoAtualProduto.findFirst({ where: { produtoId: produto.id } }))?.preco;
  const saldo = (await prisma.estoqueSaldo.findFirst({ where: { produtoId: produto.id } }))?.quantidade;

  console.log(`nota: 10 bandejas a R$ 15,00 · fator 0,04 KG por bandeja`);
  console.log(`preço gravado : R$ ${preco?.toFixed(2)}   (esperado 375.00 por KG)`);
  console.log(`saldo gravado : ${saldo?.toFixed(3)} KG   (esperado 0.400)`);
  console.log(`casou por      : ${r.casadosPorCodigo} código, ${r.casadosPorNome} nome`);

  const ok = preco === 375 && saldo === 0.4;
  console.log(ok ? "\nOK — preço divide pelo fator, quantidade multiplica." : "\nFALHOU");

  await prisma.movimentoEstoque.deleteMany({ where: { produtoId: produto.id } });
  await prisma.estoqueSaldo.deleteMany({ where: { produtoId: produto.id } });
  await prisma.historicoPrecoProduto.deleteMany({ where: { produtoId: produto.id } });
  await prisma.precoAtualProduto.deleteMany({ where: { produtoId: produto.id } });
  await prisma.itemNotaCompra.deleteMany({ where: { produtoId: produto.id } });
  await prisma.notaCompra.deleteMany({ where: { arquivoNome: "teste-conversao" } });
  await prisma.conversaoUnidadeCompra.deleteMany({ where: { produtoId: produto.id } });
  await prisma.produto.delete({ where: { id: produto.id } });
  process.exit(ok ? 0 : 1);
}
main();
