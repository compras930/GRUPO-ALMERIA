// Padroniza unidadeMedida de todo o catálogo de Produto pra só 3 valores:
// KG, LT, UND — conforme pedido do usuário (Teknisa vai operar só nesses 3).
//
// Regras (só aplica conversão MATEMATICAMENTE segura, sem chute de fator
// desconhecido):
//   - peso:  G -> KG  (fator 1000: preco*1000, quantidade/1000)
//   - volume: ML -> LT (fator 1000, mesma lógica)
//   - conta: UN/UNIDADE/UNI/UNID/PC -> UND (fator 1, é só variação de escrita
//     pra "1 unidade inteira", não precisa converter nada)
//   - já em KG/LT/UND: mantém.
//   - unidades de embalagem (CX, BOB, PT, RL, PR, GA, FD): NÃO mexe — não dá
//     pra saber quantos KG/LT tem numa "caixa" ou "fardo" sem informação
//     externa (tamanho da embalagem), então fica de fora, reportado à parte.
//
// Quando duas linhas de Produto (mesmo nome exato, unidades da mesma família)
// colapsam num único destino (ex.: "AZEITE EXTRA VIRGEM" tinha KG e G — as
// duas vão virar uma linha só em KG), migra tudo que referenciava a linha
// perdedora pra sobrevivente, com a quantidade/preço já escalados, e apaga a
// perdedora. Preço (PrecoAtualProduto) em conflito (duas unidades cadastrando
// preço da MESMA casa) resolve pelo mais recente (dataCompra); histórico
// nunca é descartado, só re-escalado e re-apontado.
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FATOR: Record<string, { alvo: string; fator: number }> = {
  g: { alvo: "KG", fator: 1000 },
  kg: { alvo: "KG", fator: 1 },
  ml: { alvo: "LT", fator: 1000 },
  lt: { alvo: "LT", fator: 1 },
  un: { alvo: "UND", fator: 1 },
  unidade: { alvo: "UND", fator: 1 },
  uni: { alvo: "UND", fator: 1 },
  unid: { alvo: "UND", fator: 1 },
  pc: { alvo: "UND", fator: 1 },
  und: { alvo: "UND", fator: 1 },
};

async function main() {
  const dryRun = !process.argv.includes("--commit");
  const produtos = await prisma.produto.findMany();

  type Grupo = { nome: string; alvo: string; itens: { id: string; unidadeMedida: string; fator: number }[] };
  const grupos = new Map<string, Grupo>();
  const ignorados: string[] = [];

  for (const p of produtos) {
    const regra = FATOR[p.unidadeMedida.toLowerCase()];
    if (!regra) { ignorados.push(`${p.nome} (${p.unidadeMedida})`); continue; }
    const chave = `${p.nome}|||${regra.alvo}`;
    let g = grupos.get(chave);
    if (!g) { g = { nome: p.nome, alvo: regra.alvo, itens: [] }; grupos.set(chave, g); }
    g.itens.push({ id: p.id, unidadeMedida: p.unidadeMedida, fator: regra.fator });
  }

  console.log(`Produtos: ${produtos.length}. Grupos (nome+alvo): ${grupos.size}. Ignorados (unidade de embalagem, não mexido): ${ignorados.length}`);
  if (ignorados.length) {
    console.log("Ignorados:");
    ignorados.forEach((s) => console.log("  - " + s));
  }

  const gruposComMerge = [...grupos.values()].filter((g) => g.itens.length > 1);
  const gruposConversaoSimples = [...grupos.values()].filter((g) => g.itens.length === 1 && g.itens[0].unidadeMedida !== g.alvo);
  console.log(`Grupos com merge (mais de 1 produto colapsando): ${gruposComMerge.length}`);
  console.log(`Conversões simples (1 produto, só troca de unidade): ${gruposConversaoSimples.length}`);

  if (dryRun) {
    console.log("\nDRY RUN — nada foi escrito. Rode com --commit pra aplicar.");
    await prisma.$disconnect();
    return;
  }

  let ingredientesAtualizados = 0, precosMigrados = 0, precosConflito = 0, historicosMigrados = 0, produtosApagados = 0, produtosConvertidos = 0;

  await prisma.$transaction(async (tx) => {
    for (const g of grupos.values()) {
      // escolhe sobrevivente: o que já está na unidade-alvo, senão o primeiro
      let sobrevivente = g.itens.find((i) => i.unidadeMedida === g.alvo) ?? g.itens[0];
      const perdedores = g.itens.filter((i) => i.id !== sobrevivente.id);

      // garante que o sobrevivente já fica com a unidade-alvo (contabilizado só
      // aqui quando há merge de verdade; grupos de 1 item só são tratados no
      // loop de "conversões simples" abaixo, pra não contar/logar 2x)
      if (sobrevivente.unidadeMedida !== g.alvo) {
        await tx.produto.update({ where: { id: sobrevivente.id }, data: { unidadeMedida: g.alvo } });
        if (perdedores.length > 0) produtosConvertidos++;
      }

      for (const perdedor of perdedores) {
        const fator = perdedor.fator; // ex.: G->KG fator 1000 (preco*fator, quantidade/fator)

        // IngredienteReceita: re-aponta pro sobrevivente, escala quantidade
        const ingredientes = await tx.ingredienteReceita.findMany({ where: { produtoId: perdedor.id } });
        for (const ing of ingredientes) {
          await tx.ingredienteReceita.update({
            where: { id: ing.id },
            data: { produtoId: sobrevivente.id, quantidade: ing.quantidade / fator, unidadeMedida: g.alvo },
          });
          ingredientesAtualizados++;
        }

        // PrecoAtualProduto: por unidade (casa), resolve conflito pelo mais recente
        const precosPerdedor = await tx.precoAtualProduto.findMany({ where: { produtoId: perdedor.id } });
        for (const preco of precosPerdedor) {
          const precoConvertido = preco.preco * fator;
          const existenteSobrevivente = await tx.precoAtualProduto.findUnique({
            where: { unidadeId_produtoId: { unidadeId: preco.unidadeId, produtoId: sobrevivente.id } },
          });
          if (!existenteSobrevivente) {
            await tx.precoAtualProduto.create({
              data: { unidadeId: preco.unidadeId, produtoId: sobrevivente.id, preco: precoConvertido, dataCompra: preco.dataCompra },
            });
          } else if (preco.dataCompra > existenteSobrevivente.dataCompra) {
            await tx.precoAtualProduto.update({
              where: { id: existenteSobrevivente.id },
              data: { preco: precoConvertido, dataCompra: preco.dataCompra },
            });
            precosConflito++;
          } else {
            precosConflito++;
          }
          await tx.precoAtualProduto.delete({ where: { id: preco.id } });
          precosMigrados++;
        }

        // HistoricoPrecoProduto: sempre migra e re-escala, nunca descarta (ledger)
        const historicos = await tx.historicoPrecoProduto.findMany({ where: { produtoId: perdedor.id } });
        for (const h of historicos) {
          await tx.historicoPrecoProduto.update({
            where: { id: h.id },
            data: { produtoId: sobrevivente.id, preco: h.preco * fator },
          });
          historicosMigrados++;
        }

        await tx.produto.delete({ where: { id: perdedor.id } });
        produtosApagados++;
      }
    }

    // conversões simples (produto sozinho, só troca de unidade, sem merge)
    for (const g of gruposConversaoSimples) {
      const item = g.itens[0];
      const fator = item.fator;
      await tx.produto.update({ where: { id: item.id }, data: { unidadeMedida: g.alvo } });
      await tx.ingredienteReceita.updateMany({
        where: { produtoId: item.id },
        data: { unidadeMedida: g.alvo }, // quantidade tratada abaixo linha a linha (updateMany não faz aritmética)
      });
      const ingredientes = await tx.ingredienteReceita.findMany({ where: { produtoId: item.id } });
      for (const ing of ingredientes) {
        await tx.ingredienteReceita.update({ where: { id: ing.id }, data: { quantidade: ing.quantidade / fator } });
        ingredientesAtualizados++;
      }
      await tx.precoAtualProduto.updateMany({ where: { produtoId: item.id }, data: {} }); // no-op placeholder, preco tratado abaixo
      const precos = await tx.precoAtualProduto.findMany({ where: { produtoId: item.id } });
      for (const p of precos) {
        await tx.precoAtualProduto.update({ where: { id: p.id }, data: { preco: p.preco * fator } });
      }
      const historicos = await tx.historicoPrecoProduto.findMany({ where: { produtoId: item.id } });
      for (const h of historicos) {
        await tx.historicoPrecoProduto.update({ where: { id: h.id }, data: { preco: h.preco * fator } });
      }
      produtosConvertidos++;
    }
  }, { timeout: 300_000 });

  console.log("\n=== RESULTADO ===");
  console.log(`Produtos convertidos em lugar (só troca de unidade): ${produtosConvertidos}`);
  console.log(`Produtos apagados (merge): ${produtosApagados}`);
  console.log(`Ingredientes de receita re-escalados: ${ingredientesAtualizados}`);
  console.log(`Preços migrados (merge): ${precosMigrados}, com conflito resolvido por data: ${precosConflito}`);
  console.log(`Históricos migrados: ${historicosMigrados}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
