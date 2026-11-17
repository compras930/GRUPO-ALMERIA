"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { erroDe } from "@/lib/erro-de-acao";

/**
 * Formulário de uma ação do chamado (encaminhar, recusar, reprovar...). Pode
 * nascer fechado atrás de um botão — `abrirCom` — para a tela não virar uma
 * parede de campos que a pessoa não vai usar.
 */
export default function FormAcao({
  action,
  children,
  botao,
  classeBotao = "btn primary",
  abrirCom,
  classeAbrir = "btn",
  confirmar,
}: {
  action: (fd: FormData) => Promise<unknown>;
  children?: React.ReactNode;
  botao: string;
  classeBotao?: string;
  abrirCom?: string;
  classeAbrir?: string;
  confirmar?: string;
}) {
  const [aberto, setAberto] = useState(!abrirCom);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!aberto) {
    return (
      <button type="button" className={classeAbrir} onClick={() => setAberto(true)}>
        {abrirCom}
      </button>
    );
  }

  return (
    <form
      className={abrirCom ? "card acao-aberta" : undefined}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirmar && !window.confirm(confirmar)) return;
        const fd = new FormData(e.currentTarget);
        setErro(null);
        start(async () => {
          try {
            const msg = erroDe(await action(fd));
            if (msg) return setErro(msg);
            router.refresh();
            if (abrirCom) setAberto(false);
          } catch (err: any) {
            setErro(err?.message || "Ocorreu um erro.");
          }
        });
      }}
    >
      {children}
      {erro && <p className="error-msg">{erro}</p>}
      <div className="btn-row" style={{ marginTop: 10 }}>
        <button type="submit" className={classeBotao} disabled={pending}>
          {pending ? "…" : botao}
        </button>
        {abrirCom && (
          <button type="button" className="btn" onClick={() => setAberto(false)}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
