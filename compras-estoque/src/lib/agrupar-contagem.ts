// A ordem da folha de contagem.
//
// POR QUE AGRUPAR POR CATEGORIA. A ordem alfabética põe o vinho entre a carne e
// a mercearia, e quem conta não anda pela despensa em ordem alfabética: anda
// pela câmara fria, depois pela adega, depois pela prateleira seca. Uma lista
// misturada obriga a percorrer a despensa inteira várias vezes, e cada volta é
// uma chance de contar duas vezes o mesmo item ou pular um.
//
// DENTRO DO GRUPO, ALFABÉTICA — e aí sim é o certo: parado na frente da adega,
// a pessoa procura o rótulo pelo nome.
//
// A CLASSE ABC NÃO ORDENA NADA, de propósito. Saber que um item "vale mais"
// convida a caprichar nele e correr nos outros, e o erro de contagem num item
// barato estraga o CMV igual.
//
// "SEM CATEGORIA" FICA POR ÚLTIMO, por maior que seja: é o buraco de cadastro,
// não um corredor da despensa. No meio da lista ele mandaria a pessoa procurar
// num lugar que não existe.
//
// Núcleo puro: sem Prisma, sem I/O.

export const SEM_CATEGORIA_CONTAGEM = "Sem categoria";

export type ItemContagem = {
  id: string;
  nome: string;
  unidadeMedida: string;
  classeAbc: string | null;
  categoria: string | null;
  /**
   * Aviso de como contar este item, quando contar não é olhar — a garrafa de
   * whisky que se pesa. Ver src/lib/pesagem.ts.
   */
  aviso?: string | null;
};

export type GrupoContagem = {
  categoria: string;
  itens: ItemContagem[];
  /**
   * Número da primeira linha do grupo na folha inteira.
   *
   * A numeração é CONTÍNUA entre os grupos, não reiniciada em cada um: a
   * pessoa que conta confere "45 de 112" no fim, e três listas começando do 1
   * tornariam essa conferência impossível.
   */
  primeiroNumero: number;
};

export function agruparPorCategoriaPura(itens: ItemContagem[]): GrupoContagem[] {
  const porCategoria = new Map<string, ItemContagem[]>();
  for (const item of itens) {
    const chave = item.categoria?.trim() || SEM_CATEGORIA_CONTAGEM;
    porCategoria.set(chave, [...(porCategoria.get(chave) ?? []), item]);
  }

  const ordenados = [...porCategoria]
    .sort(([a], [b]) => {
      if (a === SEM_CATEGORIA_CONTAGEM) return 1;
      if (b === SEM_CATEGORIA_CONTAGEM) return -1;
      return a.localeCompare(b, "pt-BR");
    })
    .map(([categoria, lista]) => ({
      categoria,
      itens: [...lista].sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR")),
    }));

  let numero = 1;
  return ordenados.map((g) => {
    const grupo = { ...g, primeiroNumero: numero };
    numero += g.itens.length;
    return grupo;
  });
}
