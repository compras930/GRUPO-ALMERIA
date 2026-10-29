// O item de venda que a carga cria sozinha.
//
// POR QUE CRIAR. Antes disto, linha de venda que não casava com nenhum item
// cadastrado ficava gravada com `itemVendaId = null`: o dinheiro entrava no
// faturamento, mas a venda não tinha nome, nem categoria, nem lugar em
// relatório nenhum. Eram R$ 117 mil assim no Beira Lago em agosto e setembro.
//
// SÓ COM CÓDIGO DO PDV. Sem código não existe identidade: o mesmo prato chega
// com grafia diferente a cada semana e cada grafia viraria um item novo. A
// lista encheria de gêmeos e o cadastro ficaria pior do que vazio. Linha sem
// código continua não reconhecida, de propósito — e é o alarme.
//
// NASCE SEM FICHA, e é isso que ela é: a venda fica registrada, o consumo de
// insumo NÃO é baixado. A saída desses insumos aparece na contagem, e a
// conferência separa quanto da falta veio daí (src/lib/consumo-sem-ficha.ts).
//
// TIPO "PRATO" PARA TODOS. A origem não manda o tipo, e deduzir pelo nome
// erraria em silêncio. Quem cadastrar a ficha corrige o tipo junto — é um
// campo, na mesma tela.
//
// O ALARME QUE NÃO PODE SUMIR. Criar sozinho mata a lista de não reconhecidos,
// que era o aviso de "entrou prato novo no cardápio". Por isso cada item nasce
// marcado como automático e a carga responde quantos criou: trocar um silêncio
// por outro seria o pior resultado possível desta mudança.
//
// Núcleo puro: sem Prisma, sem I/O.
import { normalizarNome } from "@/lib/nome-normalizado";

export type LinhaNaoCasada = {
  nome: string;
  codigo?: string | null;
  quantidadeVendida: number;
  valorTotal?: number | null;
};

export type ItemAutomatico = {
  codigoPdv: string;
  /** Nome cru da origem, limpo e em maiúscula — a grafia do PDV, não um palpite. */
  nome: string;
  /** Faturamento ÷ quantidade da própria carga. Zero quando não dá para saber. */
  precoVenda: number;
};

export type PlanoDeCriacao = {
  criar: ItemAutomatico[];
  /** Linhas que ficam não reconhecidas por não trazerem código. */
  semCodigo: number;
};

export function itensAutomaticosPuros(linhas: LinhaNaoCasada[]): PlanoDeCriacao {
  const porCodigo = new Map<string, { nome: string; quantidade: number; valor: number }>();
  let semCodigo = 0;

  for (const l of linhas) {
    const codigo = String(l.codigo ?? "").trim();
    if (!codigo) {
      semCodigo++;
      continue;
    }
    const nome = normalizarNome(l.nome).toUpperCase();
    const atual = porCodigo.get(codigo);
    // O mesmo código pode vir em várias linhas da mesma carga. Vira UM item, e
    // o preço sai do total das linhas — não da primeira que apareceu.
    if (atual) {
      atual.quantidade += l.quantidadeVendida;
      atual.valor += l.valorTotal ?? 0;
    } else {
      porCodigo.set(codigo, { nome, quantidade: l.quantidadeVendida, valor: l.valorTotal ?? 0 });
    }
  }

  const criar = [...porCodigo]
    .map(([codigoPdv, v]) => ({
      codigoPdv,
      nome: v.nome,
      // Preço zero quando a origem não mandou valor: o faturamento da linha
      // vem do valor declarado de qualquer jeito (ver src/lib/faturamento.ts),
      // e inventar um preço de tabela aqui seria palpite gravado no cadastro.
      precoVenda: v.quantidade > 0 && v.valor > 0 ? v.valor / v.quantidade : 0,
    }))
    // Ordem estável: a carga roda de novo e cria na mesma ordem.
    .sort((a, b) => a.codigoPdv.localeCompare(b.codigoPdv));

  return { criar, semCodigo };
}
