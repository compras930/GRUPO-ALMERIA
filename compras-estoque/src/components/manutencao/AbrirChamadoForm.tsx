"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { abrirChamado, type ResultadoAbertura } from "@/actions/manutencao";
import {
  CATEGORIAS_MANUTENCAO,
  CATEGORIA_LABEL,
  STATUS_CHAMADO_LABEL,
  URGENCIAS,
  URGENCIA_LABEL,
  type StatusChamado,
} from "@/lib/manutencao/constantes";
import SeletorFotos from "./SeletorFotos";

type Dup = Extract<ResultadoAbertura, { ok: false }>["duplicados"];

export default function AbrirChamadoForm({ casas }: { casas: { id: string; nome: string }[] | null }) {
  const [fotos, setFotos] = useState<File[]>([]);
  const [duplicados, setDuplicados] = useState<Dup | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function enviar(form: HTMLFormElement, mesmoAssim: boolean) {
    const fd = new FormData(form);
    fd.delete("fotos");
    for (const f of fotos) fd.append("fotos", f);
    if (mesmoAssim) fd.set("confirmarMesmoAssim", "1");
    setErro(null);
    start(async () => {
      try {
        const r = await abrirChamado(fd);
        if (r.ok) router.push(`/manutencao/${r.id}?novo=1`);
        else setDuplicados(r.duplicados);
      } catch (e: any) {
        setErro(e?.message || "Não foi possível abrir o chamado.");
      }
    });
  }

  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        enviar(e.currentTarget, false);
      }}
    >
      {casas && (
        <div className="field-row">
          <div className="field-group">
            <label htmlFor="unidadeId">Casa</label>
            <select id="unidadeId" name="unidadeId" required defaultValue="">
              <option value="" disabled>
                Selecione
              </option>
              {casas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      <div className="field-row">
        <div className="field-group">
          <label htmlFor="categoria">Tipo de problema</label>
          <select id="categoria" name="categoria" required defaultValue="">
            <option value="" disabled>
              Selecione
            </option>
            {CATEGORIAS_MANUTENCAO.map((c) => (
              <option key={c} value={c}>
                {CATEGORIA_LABEL[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="field-group">
          <label htmlFor="urgencia">Urgência</label>
          <select id="urgencia" name="urgencia" required defaultValue="NORMAL">
            {URGENCIAS.map((u) => (
              <option key={u} value={u}>
                {URGENCIA_LABEL[u]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field-row">
        <div className="field-group">
          <label htmlFor="titulo">O que aconteceu (resumo)</label>
          <input id="titulo" name="titulo" required maxLength={120} placeholder="Ex.: Câmara fria não está gelando" />
        </div>
        <div className="field-group">
          <label htmlFor="local">Onde / qual equipamento</label>
          <input id="local" name="local" maxLength={120} placeholder="Ex.: Câmara fria de carnes" />
        </div>
      </div>
      <div className="field-row">
        <div className="field-group">
          <label htmlFor="descricao">Descrição</label>
          <textarea
            id="descricao"
            name="descricao"
            required
            rows={4}
            maxLength={2000}
            placeholder="Desde quando, o que já foi tentado, se está atrapalhando o serviço…"
          />
        </div>
      </div>
      <SeletorFotos fotos={fotos} onChange={setFotos} rotulo="Fotos do problema" />

      {duplicados && duplicados.length > 0 && (
        <div className="aviso-duplicado">
          <strong>Já existe chamado em aberto parecido nesta casa:</strong>
          <ul>
            {duplicados.map((d) => (
              <li key={d.id}>
                <Link href={`/manutencao/${d.id}`} target="_blank">
                  nº {d.numero} — {d.titulo}
                </Link>{" "}
                <span className="cat">({STATUS_CHAMADO_LABEL[d.status as StatusChamado] ?? d.status})</span>
              </li>
            ))}
          </ul>
          <p className="hint">Se for o mesmo problema, não precisa abrir outro. Se for diferente, confirme abaixo.</p>
          <button
            type="button"
            className="btn"
            disabled={pending}
            onClick={(e) => enviar(e.currentTarget.closest("form")!, true)}
          >
            É outro problema — abrir mesmo assim
          </button>
        </div>
      )}

      {erro && <p className="error-msg">{erro}</p>}
      <div className="btn-row" style={{ marginTop: 16 }}>
        <button type="submit" className="btn primary" disabled={pending}>
          {pending ? "Enviando…" : "Abrir chamado"}
        </button>
      </div>
    </form>
  );
}
