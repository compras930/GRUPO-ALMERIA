// Prova, contra um banco de verdade, que recarregar a mesma nota NÃO dobra o
// estoque.
//
//   npx tsx prisma/scripts/teste-entrada-estoque.ts        (banco do DATABASE_URL)
//
// POR QUE ISTO NÃO É UM TESTE DE UNIDADE. A propriedade que importa aqui é do
// banco, não da função: a linha repetida é reconhecida por um índice único em
// `ItemNotaCompra.chaveOrigem` e por uma consulta que roda antes da transação.
// Um mock de Prisma provaria que o código chama o que eu mandei chamar, que é
// exatamente o que eu não preciso saber.
//
// Preço tolera recarga — regravar o mesmo preço não muda nada. Estoque não:
// somar a mesma mercadoria duas vezes infla o saldo, e um saldo inflado
// aparece como perda na contagem seguinte. É o tipo de erro que só dá as caras
// meses depois, com o CMV já contaminado.
//
// Limpa o que criou e devolve o saldo ao valor original ao terminar.
import { prisma } from "@/lib/prisma";
import { processarNotaCompra } from "@/lib/nota-compra";

async function main() {
  const unidade = await prisma.unidade.findFirst({ where: { estoqueEmId: null } });
  const produto = await prisma.produto.findFirst({ where: { ativo: true, unidadeMedida: "KG" } });
  const usuario = await prisma.usuario.findFirst();
  if (!unidade || !produto || !usuario) throw new Error("banco sem unidade/produto/usuário pra testar");

  const saldoDe = async () =>
    (
      await prisma.estoqueSaldo.findUnique({
        where: { unidadeId_produtoId: { unidadeId: unidade.id, produtoId: produto.id } },
      })
    )?.quantidade ?? 0;

  // Preço igual ao vigente de propósito. Um preço qualquer faria a trava de
  // salto (LIMITE_SALTO_PRECO) classificar a linha como suspeita — e linha
  // suspeita NÃO entra em estoque, porque preço 10x errado quase sempre quer
  // dizer unidade errada, e aí a quantidade também está. O teste aqui é o da
  // recarga; o da trava é outro.
  const precoVigente =
    (
      await prisma.precoAtualProduto.findUnique({
        where: { unidadeId_produtoId: { unidadeId: unidade.id, produtoId: produto.id } },
      })
    )?.preco ?? 10;

  const carga = [
    { nome: produto.nome, unidadeMedida: "KG", preco: precoVigente, dataCompra: "2026-09-10", quantidade: 3, chave: "TESTE|A" },
    { nome: produto.nome, unidadeMedida: "KG", preco: precoVigente, dataCompra: "2026-09-12", quantidade: 2, chave: "TESTE|B" },
  ];

  // Se o produto ainda não tinha linha de saldo, a carga vai criar uma — e a
  // limpeza tem que APAGAR, não atualizar pra zero: uma linha de saldo zero que
  // não existia antes é sujeira que o teste deixou pra trás.
  const existiaSaldo = !!(await prisma.estoqueSaldo.findUnique({
    where: { unidadeId_produtoId: { unidadeId: unidade.id, produtoId: produto.id } },
  }));
  const antes = await saldoDe();
  const r1 = await processarNotaCompra(unidade.nome, "teste-entrada-estoque", carga, usuario.id);
  const depois1 = await saldoDe();
  const r2 = await processarNotaCompra(unidade.nome, "teste-entrada-estoque", carga, usuario.id);
  const depois2 = await saldoDe();

  console.log(`produto        : ${produto.nome} [${produto.unidadeMedida}] em ${unidade.nome}`);
  console.log(`saldo antes    : ${antes}`);
  console.log(`1a carga       : ${depois1} (esperado ${antes + 5})  entradas=${JSON.stringify(r1.entradasDeEstoque)} jaCarregadas=${r1.linhasJaCarregadas}`);
  console.log(`recarga igual  : ${depois2} (esperado ${antes + 5})  entradas=${JSON.stringify(r2.entradasDeEstoque)} jaCarregadas=${r2.linhasJaCarregadas}`);

  const ok = depois1 === antes + 5 && depois2 === antes + 5 && r2.linhasJaCarregadas === 2;
  console.log(ok ? "\nOK — recarregar não dobra o estoque." : "\nFALHOU");

  await prisma.movimentoEstoque.deleteMany({ where: { observacao: { contains: "teste-entrada-estoque" } } });
  await prisma.itemNotaCompra.deleteMany({ where: { chaveOrigem: { in: ["TESTE|A", "TESTE|B"] } } });
  await prisma.notaCompra.deleteMany({ where: { arquivoNome: "teste-entrada-estoque" } });
  const onde = { unidadeId_produtoId: { unidadeId: unidade.id, produtoId: produto.id } };
  if (existiaSaldo) await prisma.estoqueSaldo.update({ where: onde, data: { quantidade: antes } });
  else await prisma.estoqueSaldo.deleteMany({ where: { unidadeId: unidade.id, produtoId: produto.id } });
  process.exit(ok ? 0 : 1);
}

main();
