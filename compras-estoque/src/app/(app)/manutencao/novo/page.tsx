import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { podeAbrirChamado, veTodosOsChamados } from "@/lib/permissions";
import AbrirChamadoForm from "@/components/manutencao/AbrirChamadoForm";

export default async function NovoChamadoPage() {
  const user = await requireSession();
  if (!podeAbrirChamado(user.papel)) redirect("/manutencao");
  const casas = veTodosOsChamados(user.papel)
    ? await prisma.unidade.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } })
    : null;
  return (
    <div style={{ maxWidth: 760 }}>
      <div className="page-header">
        <p className="eyebrow">
          <Link href="/manutencao">Manutenção</Link>
        </p>
        <h1>Abrir chamado{user.unidadeNome ? ` — ${user.unidadeNome}` : ""}</h1>
      </div>
      <AbrirChamadoForm casas={casas} />
    </div>
  );
}
