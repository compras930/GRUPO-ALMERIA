// Lê a seleção (casa + mês) juntando cookie, URL e o que o usuário pode ver.
//
// O núcleo da decisão é puro e testado — ver src/lib/selecao.ts. Aqui só se
// busca o que ele precisa: as casas visíveis para este papel e os meses que o
// app tem dado.
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { unidadeVisivel } from "@/lib/permissions";
import { mesDaData, mesesDisponiveis, PRIMEIRO_MES_COM_DADO } from "@/lib/mes";
import { resolverSelecaoPura, type CasaOpcao, type Selecao } from "@/lib/selecao";
import type { Papel } from "@/lib/constants";

export const COOKIE_CASA = "ga_casa";
export const COOKIE_MES = "ga_mes";

export type ContextoDeSelecao = Selecao & {
  casas: CasaOpcao[];
  meses: { chave: string; rotulo: string }[];
};

export async function carregarContexto(
  usuario: { papel: Papel; unidadeId: string | null },
  searchParams?: { unidadeId?: string; mes?: string }
): Promise<ContextoDeSelecao> {
  const todas = await prisma.unidade.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });
  // Quem pode ver o quê é decidido pelo mesmo helper do resto do app.
  const casas = todas.filter((u) => unidadeVisivel(usuario.papel, usuario.unidadeId, u.id));

  const meses = mesesDisponiveis(new Date(), 14, PRIMEIRO_MES_COM_DADO);
  const c = cookies();

  const selecao = resolverSelecaoPura(
    casas,
    meses.map((m) => m.chave),
    {
      casaSp: searchParams?.unidadeId,
      mesSp: searchParams?.mes,
      casaCookie: c.get(COOKIE_CASA)?.value,
      mesCookie: c.get(COOKIE_MES)?.value,
    },
    mesDaData(new Date()).chave
  );

  return { ...selecao, casas, meses: meses.map((m) => ({ chave: m.chave, rotulo: m.rotulo })) };
}
