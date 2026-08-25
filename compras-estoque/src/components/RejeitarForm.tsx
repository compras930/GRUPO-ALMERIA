"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rejeitarPedido } from "@/actions/pedidos";

export default function RejeitarForm({ pedidoId }: { pedidoId: string }) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!aberto) {
    return (
      <button type="button" className="btn danger" onClick={() => setAberto(true)}>
        Rejeitar pedido
      </button>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="field-group" style={{ marginBottom: 10 }}>
        <label htmlFor="motivo">Motivo da rejeição</label>
        <textarea id="motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </div>
      {erro && <p className="error-msg">{erro}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="btn danger"
          disabled={pending}
          onClick={() => {
            const fd = new FormData();
            fd.set("motivo", motivo);
            startTransition(async () => {
              try {
                await rejeitarPedido(pedidoId, fd);
                router.refresh();
                setAberto(false);
              } catch (e: any) {
                setErro(e?.message || "Erro ao rejeitar.");
              }
            });
          }}
        >
          {pending ? "…" : "Confirmar rejeição"}
        </button>
        <button type="button" className="btn" onClick={() => setAberto(false)}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
