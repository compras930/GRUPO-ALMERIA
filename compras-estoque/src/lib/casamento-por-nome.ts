// Casar duas listas PELO NOME — e só para sugerir.
//
// Casar por nome é o que este projeto evita em toda parte: nome é digitado por
// gente diferente, em sistemas diferentes, e casamento errado grava consumo
// errado sem avisar ninguém. A exceção, a única, é esta: quando o resultado
// não é gravado, e sim oferecido a uma pessoa que confirma. Aí o risco de
// errar vira um clique, e o ganho é não fazer alguém procurar 200 nomes numa
// lista suspensa.
//
// ESTE ARQUIVO EXISTE PARA NÃO HAVER DUAS RÉGUAS. A revenda direta (item de
// cardápio ↔ produto) e o vínculo de ficha (item de cardápio ↔ receita) fazem
// a mesma pergunta. Se cada tela tivesse a sua própria comparação, uma delas
// casaria o que a outra recusa, e ninguém saberia qual está certa.
//
// Núcleo puro: sem Prisma, sem I/O.

import { chaveComparacao } from "@/lib/nome-normalizado";

/**
 * Chave SEM ACENTO, só para comparação de sugestão.
 *
 * `chaveComparacao` baixa a caixa e preserva o acento — e está certo assim no
 * resto do app, onde ela decide casamento que vira gravação. Aqui os dois
 * lados vêm de cadastros digitados por gente diferente: o cardápio escreve
 * "Tartar de Atum", a planilha do chef escreve "MONTAGEM - TARTAR DE ATUM".
 */
export const chaveSemAcento = (nome: string) =>
  chaveComparacao(nome)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export type Nomeado = { id: string; nome: string };

export type Casamento = {
  alvoId: string;
  candidatoId: string | null;
  /**
   * EXATA  — nome igual depois de normalizar: pode ser aplicada em lote.
   * PARCIAL— casou por apelido ou por prefixo: precisa de olho humano.
   * NENHUMA— não há candidato único; alguém escolhe na mão.
   */
  confianca: "EXATA" | "PARCIAL" | "NENHUMA";
  /** Por que o app sugeriu isto — aparece na tela, para não parecer mágica. */
  motivo: string;
};

/**
 * Como gerar as chaves de um nome.
 *
 * A PRIMEIRA É A ESTRITA: só ela produz EXATA, e só EXATA entra no botão de
 * lote. As seguintes são apelidos — tirar o "SB -" do começo, comparar por
 * conjunto de palavras — e rendem no máximo PARCIAL, que vai uma a uma. A
 * diferença importa: "MOLHO DE TOMATE" e "TOMATE MOLHO" provavelmente são a
 * mesma coisa, mas "provavelmente" não é critério para gravar 150 vínculos de
 * uma vez.
 */
export type ChavesDe = (nome: string) => string[];

export const chavesPadrao: ChavesDe = (nome) => [chaveSemAcento(nome)];

export function sugerirPorNomePuro(
  alvos: Nomeado[],
  candidatos: Nomeado[],
  chavesDe: ChavesDe = chavesPadrao
): Casamento[] {
  // Índice por nível: nível 0 é o nome estrito, os demais são apelidos.
  const indice: Map<string, Nomeado[]>[] = [];
  for (const c of candidatos) {
    chavesDe(c.nome).forEach((k, nivel) => {
      if (!k) return;
      if (!indice[nivel]) indice[nivel] = new Map();
      const m = indice[nivel];
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    });
  }

  return alvos.map((alvo) => {
    const chaves = chavesDe(alvo.nome);

    for (let nivel = 0; nivel < chaves.length; nivel++) {
      const achados = (indice[nivel]?.get(chaves[nivel]) ?? []).filter(
        (c, i, todos) => todos.findIndex((x) => x.id === c.id) === i
      );
      if (achados.length === 1) {
        return {
          alvoId: alvo.id,
          candidatoId: achados[0].id,
          confianca: nivel === 0 ? "EXATA" : "PARCIAL",
          motivo: nivel === 0 ? "nome idêntico" : "nome equivalente — confira antes",
        };
      }
      // Mais de um com o mesmo nome: não dá para escolher sozinho, e escolher
      // o primeiro seria decidir no escuro por quem vai conferir.
      if (achados.length > 1) {
        return {
          alvoId: alvo.id,
          candidatoId: null,
          confianca: "NENHUMA",
          motivo: `${achados.length} com esse mesmo nome`,
        };
      }
    }

    // Último recurso: um nome começa pelo outro. Exige nome longo dos dois
    // lados — "GIN" casaria com GIN TANQUERAY, GIN BOMBAY e mais oito.
    const chave = chaves[0];
    const parciais = candidatos.filter((c) => {
      const k = chaveSemAcento(c.nome);
      return k.length > 6 && chave.length > 6 && (k.startsWith(chave) || chave.startsWith(k));
    });
    if (parciais.length === 1) {
      return {
        alvoId: alvo.id,
        candidatoId: parciais[0].id,
        confianca: "PARCIAL",
        motivo: "nome parecido — confira antes",
      };
    }
    return {
      alvoId: alvo.id,
      candidatoId: null,
      confianca: "NENHUMA",
      motivo: parciais.length > 1 ? `${parciais.length} nomes parecidos` : "nenhum nome parecido",
    };
  });
}

/** Os que podem ser aplicados de uma vez, sem ninguém olhar linha a linha. */
export const casamentosSegurosPuros = (c: Casamento[]) =>
  c.filter((x) => x.confianca === "EXATA" && x.candidatoId);
