import { grupoDoStatus, STATUS_CHAMADO_LABEL, type StatusChamado } from "@/lib/manutencao/constantes";

const CLASSE = { ABERTO: "bad", ANDAMENTO: "warn", FINALIZADO: "ok", ENCERRADO: "neutral" } as const;

/** Vermelho / amarelo / verde, com o status exato escrito. */
export default function TagStatus({ status, atrasado }: { status: string; atrasado?: boolean }) {
  return (
    <span className="tag-status">
      <span className={`tag cheia ${CLASSE[grupoDoStatus(status)]}`}>
        {STATUS_CHAMADO_LABEL[status as StatusChamado] ?? status}
      </span>
      {atrasado && <span className="tag bad">Atrasado</span>}
    </span>
  );
}

export function classeGrupo(status: string) {
  return `g-${grupoDoStatus(status).toLowerCase()}`;
}
