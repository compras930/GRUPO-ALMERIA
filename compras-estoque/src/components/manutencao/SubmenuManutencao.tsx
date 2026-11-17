import Link from "next/link";
import type { Papel } from "@/lib/constants";
import { podeGerenciarManutencao } from "@/lib/permissions";

export default function SubmenuManutencao({ papel }: { papel: Papel }) {
  if (!podeGerenciarManutencao(papel)) return null;
  return (
    <div className="btn-row" style={{ marginBottom: 18 }}>
      <Link href="/manutencao/relatorio" className="btn small">
        Relatório
      </Link>
      <Link href="/manutencao/colaboradores" className="btn small">
        Colaboradores
      </Link>
      <Link href="/manutencao/contatos" className="btn small">
        WhatsApp da equipe
      </Link>
    </div>
  );
}
