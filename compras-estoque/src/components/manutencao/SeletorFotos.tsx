"use client";

import { useEffect, useState } from "react";
import { reduzirFoto } from "./reduzirFoto";

const MAX = 5;

/**
 * Escolher ou tirar fotos. O `capture` não é usado de propósito: com ele o
 * celular só abre a câmera, e muitas vezes a foto do defeito já está na
 * galeria (tirada antes de lembrar do chamado).
 */
export default function SeletorFotos({
  fotos,
  onChange,
  rotulo = "Fotos",
}: {
  fotos: File[];
  onChange: (f: File[]) => void;
  rotulo?: string;
}) {
  const [previas, setPrevias] = useState<string[]>([]);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const urls = fotos.map((f) => URL.createObjectURL(f));
    setPrevias(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [fotos]);

  return (
    <div className="field-group">
      <label>
        {rotulo} ({fotos.length}/{MAX})
      </label>
      <div className="fotos-grade">
        {previas.map((u, i) => (
          <div key={u} className="foto-previa">
            <img src={u} alt={`Foto ${i + 1}`} />
            <button type="button" aria-label="Remover foto" onClick={() => onChange(fotos.filter((_, j) => j !== i))}>
              ×
            </button>
          </div>
        ))}
        {fotos.length < MAX && (
          <label className="foto-adicionar">
            {processando ? "Preparando…" : "+ Foto"}
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              disabled={processando}
              onChange={async (e) => {
                const lista = Array.from(e.target.files ?? []).slice(0, MAX - fotos.length);
                e.target.value = "";
                if (!lista.length) return;
                setErro(null);
                setProcessando(true);
                try {
                  const reduzidas = await Promise.all(lista.map((f) => reduzirFoto(f)));
                  onChange([...fotos, ...reduzidas]);
                } catch (err: any) {
                  setErro(err?.message || "Não consegui preparar a foto.");
                } finally {
                  setProcessando(false);
                }
              }}
            />
          </label>
        )}
      </div>
      {erro && <p className="error-msg">{erro}</p>}
    </div>
  );
}
