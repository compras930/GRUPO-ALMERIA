import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { comRetentativaDeConflito, ehConflitoDeEscrita } from "@/lib/transacao";
import { emOrdemDeBloqueio } from "@/lib/ordem-de-bloqueio";

const deadlock = () =>
  new Prisma.PrismaClientKnownRequestError("deadlock detected", { code: "P2034", clientVersion: "5" });

describe("ehConflitoDeEscrita", () => {
  it("reconhece deadlock do Prisma e a mensagem crua do Postgres", () => {
    expect(ehConflitoDeEscrita(deadlock())).toBe(true);
    expect(ehConflitoDeEscrita(new Error("deadlock detected"))).toBe(true);
    expect(ehConflitoDeEscrita(new Error("could not serialize access due to concurrent update"))).toBe(true);
  });

  it("NÃO trata outros erros como conflito", () => {
    // Violação de unique falharia igual nas três tentativas; repetir só
    // atrasaria a resposta de erro.
    const unique = new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "5" });
    expect(ehConflitoDeEscrita(unique)).toBe(false);
    expect(ehConflitoDeEscrita(new Error("Unidade não encontrada"))).toBe(false);
  });
});

describe("comRetentativaDeConflito", () => {
  it("repete o deadlock e devolve o resultado quando a segunda passa", async () => {
    let n = 0;
    const r = await comRetentativaDeConflito(async () => {
      n++;
      if (n === 1) throw deadlock();
      return "ok";
    });
    expect(r).toBe("ok");
    expect(n).toBe(2);
  });

  it("desiste depois de 3 e propaga o erro original", async () => {
    let n = 0;
    await expect(
      comRetentativaDeConflito(async () => {
        n++;
        throw deadlock();
      })
    ).rejects.toThrow(/deadlock/i);
    expect(n).toBe(3);
  });

  it("erro que não é conflito sobe na hora, sem repetir", async () => {
    let n = 0;
    await expect(
      comRetentativaDeConflito(async () => {
        n++;
        throw new Error("Unidade não encontrada");
      })
    ).rejects.toThrow("Unidade não encontrada");
    expect(n).toBe(1);
  });
});

describe("emOrdemDeBloqueio", () => {
  it("devolve sempre a mesma ordem, qualquer que tenha sido a de inserção", () => {
    // É isto que impede a espera em cruz: duas cargas percorrem o mesmo caminho.
    const a = new Map([["p3", 1], ["p1", 2], ["p2", 3]]);
    const b = new Map([["p2", 3], ["p3", 1], ["p1", 2]]);
    expect(emOrdemDeBloqueio(a).map(([k]) => k)).toEqual(["p1", "p2", "p3"]);
    expect(emOrdemDeBloqueio(a)).toEqual(emOrdemDeBloqueio(b));
  });

  it("não perde nem duplica nada", () => {
    const m = new Map([["z", 1], ["a", 2]]);
    expect(emOrdemDeBloqueio(m)).toHaveLength(2);
    expect(Object.fromEntries(emOrdemDeBloqueio(m))).toEqual({ a: 2, z: 1 });
  });
});
