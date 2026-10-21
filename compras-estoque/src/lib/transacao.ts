// Tentar de novo quando o banco desiste por conflito de escrita.
//
// A REDE, NÃO A SOLUÇÃO. O que evita deadlock é todo mundo pegar as linhas na
// mesma ordem — ver ordem-de-bloqueio.ts. Isto aqui cobre o que não depende
// de nós: outra sessão rodando SQL à mão, uma manutenção, um lock de índice.
//
// SÓ REPETE O QUE O BANCO JÁ DESFEZ. Deadlock e falha de serialização abortam
// a transação inteira — não existe meia escrita para limpar antes de tentar
// de novo. Por isso repetir aqui é seguro, e por isso ele NUNCA repete outro
// tipo de erro: uma violação de unique, por exemplo, ia falhar igual nas três
// tentativas e só atrasaria a resposta de erro.
//
// POUCAS TENTATIVAS, DE PROPÓSITO. A transação da carga tolera 60s e a função
// da Vercel corta em 60s. Repetir muito transforma um erro claro num timeout
// mudo, que é pior de diagnosticar do que o erro original.
import { Prisma } from "@prisma/client";

const TENTATIVAS = 3;
const ESPERA_BASE_MS = 120;

/**
 * Deadlock (40P01) e falha de serialização (40001) chegam pelo Prisma como
 * P2034, e às vezes como P2010 com a mensagem crua do Postgres quando a
 * query passou por `$queryRaw`. Olhar os dois evita depender de qual caminho
 * a query tomou.
 */
export function ehConflitoDeEscrita(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2034") return true;
    if (e.code === "P2010") return /deadlock|could not serialize/i.test(String(e.meta?.message ?? e.message));
  }
  return /deadlock detected|could not serialize access/i.test(String((e as Error)?.message ?? ""));
}

export async function comRetentativaDeConflito<T>(fn: () => Promise<T>): Promise<T> {
  let ultimo: unknown;
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    try {
      return await fn();
    } catch (e) {
      if (!ehConflitoDeEscrita(e)) throw e;
      ultimo = e;
      if (tentativa === TENTATIVAS) break;
      // Espera crescente com ruído: duas cargas que colidiram e esperassem o
      // mesmo tanto voltariam a colidir no mesmo instante.
      const espera = ESPERA_BASE_MS * 2 ** (tentativa - 1) * (1 + Math.random());
      await new Promise((r) => setTimeout(r, espera));
    }
  }
  throw ultimo;
}
