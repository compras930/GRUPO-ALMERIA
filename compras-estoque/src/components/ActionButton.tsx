"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { erroDe } from "@/lib/erro-de-acao";

export default function ActionButton({
  action,
  children,
  className = "btn",
  confirmMsg,
}: {
  // `unknown`: ações que devolvem `{ erro }` em vez de lançar (ver erroDe).
  action: () => Promise<unknown>;
  children: React.ReactNode;
  className?: string;
  confirmMsg?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div style={{ display: "inline-block" }}>
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() => {
          if (confirmMsg && !confirm(confirmMsg)) return;
          setErro(null);
          startTransition(async () => {
            try {
              const msg = erroDe(await action());
              if (msg) return setErro(msg);
              router.refresh();
            } catch (e: any) {
              setErro(e?.message || "Ocorreu um erro.");
            }
          });
        }}
      >
        {pending ? "…" : children}
      </button>
      {erro && <p className="error-msg">{erro}</p>}
    </div>
  );
}
