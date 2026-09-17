// Casa uma linha de venda vinda do PDV contra o ItemVenda cadastrado.
//
// POR QUE POR CÓDIGO. Até agora o casamento era só por nome
// (chaveComparacao), e o nome é justamente a parte que a casa muda sozinha:
// o mesmo prato sai do Teknisa como "FILE AU POIVRE WINE" no Wine Garden e
// "Filé au Poivre" no cadastro. No levantamento de setembro/2026, R$ 169 mil
// de faturamento tinham ficha pronta e não casavam só por diferença de
// grafia. O código do PDV não muda quando alguém renomeia o item no cardápio.
//
// É a mesma lição de resolucao-ingredientes.ts, um nível acima: resolver por
// identificador, nunca por texto digitado.
//
// O código é por casa. Cada unidade roda um PDV só (Teknisa nas três do
// Grupo, Xmenu no Beira Lago) e os espaços de código não se comunicam — por
// isso a chave é (unidadeId, codigoPdv) e não o código sozinho.
//
// Núcleo puro: sem Prisma, sem I/O. Quem chama carrega o catálogo da unidade
// e passa pronto (ver src/lib/venda-semanal.ts).
import { chaveComparacao } from "@/lib/nome-normalizado";

export type LinhaVendaBruta = {
  nome: string;
  /** Código do produto no PDV. Ausente quando a origem não manda (planilha antiga). */
  codigo?: string | null;
  quantidadeVendida: number;
};

export type ItemVendaResumo = {
  id: string;
  nome: string;
  codigoPdv: string | null;
};

export type MotivoNaoCasou =
  /** Não existe item com esse nome no cadastro da casa. */
  | "NOME_NAO_ENCONTRADO"
  /** Mais de um item com o mesmo nome (tipo/categoria diferentes) — humano decide. */
  | "NOME_AMBIGUO"
  /** O nome casa com um item que já declara OUTRO código. Ver comentário abaixo. */
  | "CONFLITO_DE_CODIGO";

export type ResolucaoLinhaVenda = {
  linha: LinhaVendaBruta;
  itemVendaId: string | null;
  /** Como casou. null quando não casou. */
  via: "CODIGO" | "NOME" | null;
  motivo: MotivoNaoCasou | null;
  /**
   * Casou por nome, o item não tem código gravado e a linha trouxe um.
   * É o código que dá pra aprender pra esse item — mas quem grava é uma ação
   * explícita (prisma/scripts/backfill-codigo-pdv.ts), nunca esta função:
   * gravar código a partir de um casamento por nome é exatamente o atalho que
   * este arquivo existe pra evitar.
   */
  codigoSugerido: string | null;
};

function normalizarCodigo(codigo: string | null | undefined): string | null {
  const c = String(codigo ?? "").trim();
  return c === "" ? null : c;
}

export function resolverItensVendaPura(
  linhas: LinhaVendaBruta[],
  catalogo: ItemVendaResumo[]
): ResolucaoLinhaVenda[] {
  // (unidadeId, codigoPdv) é único no banco, então não há colisão possível aqui.
  const porCodigo = new Map<string, ItemVendaResumo>();
  for (const iv of catalogo) {
    const c = normalizarCodigo(iv.codigoPdv);
    if (c) porCodigo.set(c, iv);
  }
  const porNome = new Map<string, ItemVendaResumo[]>();
  for (const iv of catalogo) {
    const k = chaveComparacao(iv.nome);
    const lista = porNome.get(k) ?? [];
    lista.push(iv);
    porNome.set(k, lista);
  }

  return linhas.map((linha) => {
    const codigo = normalizarCodigo(linha.codigo);

    // 1. Código bate: fim. O nome pode estar diferente à vontade — é pra isso
    //    que o código serve.
    if (codigo) {
      const porCod = porCodigo.get(codigo);
      if (porCod) {
        return { linha, itemVendaId: porCod.id, via: "CODIGO", motivo: null, codigoSugerido: null };
      }
    }

    // 2. Sem código, ou código desconhecido: cai pro nome.
    const candidatos = porNome.get(chaveComparacao(linha.nome)) ?? [];
    if (candidatos.length === 0) {
      return { linha, itemVendaId: null, via: null, motivo: "NOME_NAO_ENCONTRADO", codigoSugerido: null };
    }
    if (candidatos.length > 1) {
      return { linha, itemVendaId: null, via: null, motivo: "NOME_AMBIGUO", codigoSugerido: null };
    }

    const unico = candidatos[0];
    const codigoDoItem = normalizarCodigo(unico.codigoPdv);

    // 3. O nome casa, mas o item já declara um código DIFERENTE do que veio na
    //    linha. Os dois dados se contradizem: ou o PDV recadastrou o prato com
    //    código novo, ou dois pratos diferentes têm o mesmo nome e um deles
    //    ainda não está cadastrado. Casar por nome aqui seria escolher o texto
    //    por cima do identificador — a inversão que este arquivo evita.
    if (codigo && codigoDoItem && codigoDoItem !== codigo) {
      return { linha, itemVendaId: null, via: null, motivo: "CONFLITO_DE_CODIGO", codigoSugerido: null };
    }

    return {
      linha,
      itemVendaId: unico.id,
      via: "NOME",
      motivo: null,
      codigoSugerido: codigo && !codigoDoItem ? codigo : null,
    };
  });
}

export const EXPLICACAO_MOTIVO: Record<MotivoNaoCasou, string> = {
  NOME_NAO_ENCONTRADO: "nenhum item de venda com esse nome nessa casa",
  NOME_AMBIGUO: "mais de um item de venda com esse nome nessa casa",
  CONFLITO_DE_CODIGO: "o item com esse nome já está cadastrado com outro código de PDV",
};
