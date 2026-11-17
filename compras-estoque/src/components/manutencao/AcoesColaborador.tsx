"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aceitarPorToken, concluirPorToken } from "@/actions/manutencao";
import SeletorFotos from "./SeletorFotos";
import { erroDe } from "@/lib/erro-de-acao";

export function BotaoAceitar({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div>
      <button
        type="button"
        className="btn primary grande"
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              const msg = erroDe(await aceitarPorToken(token));
              if (msg) return setErro(msg);
              router.refresh();
            } catch (e: any) {
              setErro(e?.message || "Erro ao confirmar.");
            }
          })
        }
      >
        {pending ? "…" : "OK, vou atender"}
      </button>
      {erro && <p className="error-msg">{erro}</p>}
    </div>
  );
}

export function FormConcluir({ token }: { token: string }) {
  const [fotos, setFotos] = useState<File[]>([]);
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        for (const f of fotos) fd.append("fotos", f);
        setErro(null);
        start(async () => {
          try {
            const msg = erroDe(await concluirPorToken(token, fd));
            if (msg) return setErro(msg);
            router.refresh();
          } catch (err: any) {
            setErro(err?.message || "Erro ao enviar.");
          }
        });
      }}
    >
      <div className="field-group" style={{ marginBottom: 12 }}>
        <label htmlFor="servico">Serviço executado</label>
        <textarea
          id="servico"
          name="servico"
          rows={4}
          required
          maxLength={2000}
          placeholder="O que foi feito, peças trocadas, recomendações…"
        />
      </div>
      <SeletorFotos fotos={fotos} onChange={setFotos} rotulo="Fotos do serviço pronto" />
      {erro && <p className="error-msg">{erro}</p>}
      <button type="submit" className="btn primary grande" disabled={pending} style={{ marginTop: 14 }}>
        {pending ? "Enviando…" : "Finalizar chamado"}
      </button>
    </form>
  );
}
