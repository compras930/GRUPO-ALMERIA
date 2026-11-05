"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aplicarCurvaAbc } from "@/actions/curva-abc";

/**
 * Botão que grava a curva recalculada.
 *
 * PEDE CONFIRMAÇÃO, e não é cerimônia: isto muda o que outra pessoa vai contar
 * na semana que vem. O clique sozinho é fácil demais para uma mudança que
 * ninguém mais vê acontecer.
 */
export default function AplicarCurvaForm({
  unidadeId,
  quantas,
}: {
  unidadeId: string;
  quantas: number;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (salvo) return <p className="error-msg" style={{ borderColor: "currentColor" }}>{salvo}</p>;

  if (!confirmando) {
    return (
      <>
        {erro && <p className="error-msg">{erro}</p>}
        <button className="btn primary" type="button" onClick={() => setConfirmando(true)}>
          Aplicar a curva recalculada
        </button>
      </>
    );
  }

  return (
    <form
      action={(formData) => {
        setErro(null);
        startTransition(async () => {
          try {
            const r = await aplicarCurvaAbc(formData);
            setSalvo(
              r.mudou === 0
                ? "Nada mudou — a curva gravada já era a da janela."
                : `Pronto: ${r.mudou} ${r.mudou === 1 ? "produto reclassificado" : "produtos reclassificados"}. A próxima folha de contagem já sai com a lista nova.`
            );
            router.refresh();
          } catch (e: any) {
            setErro(e?.message || "Não foi possível aplicar.");
            setConfirmando(false);
          }
        });
      }}
    >
      <input type="hidden" name="unidadeId" value={unidadeId} />
      {erro && <p className="error-msg">{erro}</p>}
      <p className="hint" style={{ marginBottom: 10 }}>
        Confirma? Vai reclassificar <strong>{quantas}</strong>{" "}
        {quantas === 1 ? "produto" : "produtos"} e mudar a folha da próxima contagem.
      </p>
      <div className="btn-row">
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? "Aplicando…" : "Confirmo, pode aplicar"}
        </button>
        <button className="btn" type="button" onClick={() => setConfirmando(false)} disabled={pending}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
