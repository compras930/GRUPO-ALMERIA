// Cenário do ensaio de apresentação. Imita o Beira Lago em escala pequena:
// uma contagem de marco zero, compras e vendas no meio da semana, e a contagem
// de segunda por cima — que é exatamente a sequência da reunião.
//
// Os casos foram escolhidos pra que a Conferência da contagem tenha o que
// mostrar: um produto que fecha certinho, um com falta cara, um com sobra, um
// sem ficha e um com perda declarada (que tem que NÃO virar falta).
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const dia = (n: number) => new Date(Date.UTC(2026, 9, n, 12, 0, 0));

async function main() {
  await prisma.$transaction([
    prisma.ingredienteReceita.deleteMany(),
    prisma.itemVendaSemanal.deleteMany(),
    prisma.vendaSemanal.deleteMany(),
    prisma.itemVenda.deleteMany(),
    prisma.receita.deleteMany(),
    prisma.itemNotaCompra.deleteMany(),
    prisma.notaCompra.deleteMany(),
    prisma.contagemEstoque.deleteMany(),
    prisma.movimentoEstoque.deleteMany(),
    prisma.estoqueSaldo.deleteMany(),
    prisma.precoAtualProduto.deleteMany(),
    prisma.parametroEstoqueProduto.deleteMany(),
    prisma.produto.deleteMany(),
    prisma.usuario.deleteMany(),
    prisma.unidade.deleteMany(),
  ]);

  const casa = await prisma.unidade.create({ data: { nome: "Beira Lago", ativo: true } });
  const senhaHash = await bcrypt.hash("ensaio123", 10);
  const admin = await prisma.usuario.create({
    data: { nome: "Administrador", email: "admin@ensaio.local", senhaHash, papel: "ADMIN" },
  });
  await prisma.usuario.create({
    data: {
      nome: "Gerente Beira Lago",
      email: "gerente@ensaio.local",
      senhaHash,
      papel: "GERENTE",
      unidadeId: casa.id,
    },
  });

  // nome, unidade, preço, curva, saldo do marco zero, comprado, vendido de
  // verdade (o que a contagem de segunda vai revelar), perda declarada
  const catalogo: [string, string, number, string, number, number, number, number][] = [
    // fecha certinho: a ficha explica tudo
    ["FILE MIGNON", "KG", 89.9, "A", 20, 30, 28, 0],
    // falta cara: saiu 6 kg a mais do que a ficha explica
    ["CARABINEIRO", "KG", 340.0, "A", 8, 12, 9, 0],
    // sobra: contado a mais do que a conta previa
    ["BURRATA CAMPANA 200GR", "UND", 24.47, "A", 40, 120, 130, 0],
    // sem ficha nenhuma: toda a saída aparece como falta, e a tela avisa
    ["AZEITE EXTRA VIRGEM", "LT", 48.55, "A", 15, 20, 18, 0],
    // perda declarada: o gerente lançou 3 kg de quebra, e isso NÃO pode virar falta
    ["TOMATE ITALIANO", "KG", 8.0, "A", 25, 60, 70, 3],
  ];

  const porNome = new Map<string, string>();
  for (const [nome, un, preco, curva, inicial, comprado, vendido, perda] of catalogo) {
    const p = await prisma.produto.create({
      data: { nome, unidadeMedida: un, categoria: "MATERIA PRIMA" },
    });
    porNome.set(nome, p.id);
    await prisma.precoAtualProduto.create({
      data: { unidadeId: casa.id, produtoId: p.id, preco, dataCompra: dia(14) },
    });
    await prisma.parametroEstoqueProduto.create({
      data: { unidadeId: casa.id, produtoId: p.id, classeAbc: curva, grupoContagem: 0 },
    });

    // Marco zero: a contagem da semana passada, que sobrescreveu o saldo.
    await prisma.contagemEstoque.create({
      data: {
        unidadeId: casa.id,
        produtoId: p.id,
        quantidadeSistema: 0,
        quantidadeContada: inicial,
        diferenca: inicial,
        contadoPorId: admin.id,
        criadoEm: dia(13),
      },
    });
    await prisma.estoqueSaldo.create({
      data: { unidadeId: casa.id, produtoId: p.id, quantidade: inicial },
    });

    // Compra no meio da semana.
    await prisma.movimentoEstoque.create({
      data: {
        unidadeId: casa.id,
        produtoId: p.id,
        tipo: "ENTRADA_NOTA",
        quantidade: comprado,
        criadoEm: dia(15),
        observacao: "Nota do ensaio",
      },
    });

    // Perda declarada pelo gerente.
    if (perda > 0) {
      await prisma.movimentoEstoque.create({
        data: {
          unidadeId: casa.id,
          produtoId: p.id,
          tipo: "PERDA_QUEBRA",
          quantidade: -perda,
          criadoEm: dia(16),
          observacao: "Caixa derrubada",
        },
      });
    }

    // Saldo do sistema antes da contagem de segunda.
    await prisma.estoqueSaldo.update({
      where: { unidadeId_produtoId: { unidadeId: casa.id, produtoId: p.id } },
      data: { quantidade: inicial + comprado - perda },
    });
    void vendido;
  }

  // As fichas: um prato por insumo, menos o azeite, que fica DE PROPÓSITO sem
  // ficha nenhuma pra a tela ter o que marcar.
  const pratos: [string, string, number, number][] = [
    ["Filé Mignon", "FILE MIGNON", 0.28, 100],
    ["Tartare de Carabineiro", "CARABINEIRO", 0.12, 75],
    ["Caprese", "BURRATA CAMPANA 200GR", 1, 130],
    ["Spaghetti Almeria", "TOMATE ITALIANO", 0.2, 335],
  ];

  const venda = await prisma.vendaSemanal.create({
    data: {
      unidadeId: casa.id,
      importadoPorId: admin.id,
      periodoInicio: dia(13),
      periodoFim: dia(19),
    },
  });

  for (const [prato, insumo, qtdFicha, vendidos] of pratos) {
    const receita = await prisma.receita.create({
      data: { unidadeId: casa.id, nome: prato, rendimentoQtd: 1, rendimentoUnidade: "PORCAO" },
    });
    await prisma.ingredienteReceita.create({
      data: {
        receitaId: receita.id,
        produtoId: porNome.get(insumo)!,
        quantidade: qtdFicha,
        unidadeMedida: "KG",
      },
    });
    const item = await prisma.itemVenda.create({
      data: {
        unidadeId: casa.id,
        tipo: "PRATO",
        nome: prato,
        precoVenda: 90,
        receitaId: receita.id,
        categoria: "PRATOS",
      },
    });
    await prisma.itemVendaSemanal.create({
      data: {
        vendaSemanalId: venda.id,
        itemVendaId: item.id,
        nomeBruto: prato,
        quantidadeVendida: vendidos,
        valorVendido: vendidos * 90,
      },
    });
    // A baixa teórica que a carga de venda grava.
    await prisma.movimentoEstoque.create({
      data: {
        unidadeId: casa.id,
        produtoId: porNome.get(insumo)!,
        tipo: "SAIDA_CONSUMO",
        quantidade: -(qtdFicha * vendidos),
        criadoEm: dia(19),
        observacao: "Consumo da semana",
      },
    });
  }

  const n = await prisma.produto.count();
  console.log(`Cenário pronto: ${n} produtos de curva A, marco zero em 13/10, compras em 15/10, venda da semana 13-19/10.`);
  console.log("Falta contar a segunda-feira — é o que o ensaio faz pela tela.");
}

main().finally(() => prisma.$disconnect());
