"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registrarContagem } from "@/actions/estoque";

type Produto = { id: string; nome: string; unidadeMedida: string; saldoSistema: number };

export default function ContagemForm({ unidadeId, produtos }: { unidadeId: string; produtos: Produto[] }) {
  const [produtoId, setProdutoId] = useState("");
  const [quantidadeContada, setQuantidadeContada] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const produtoSelecionado = produtos.find((p) => p.id === produtoId);

  return (
    <form
      action={(formData) => {
        setErro(null);
        startTransition(async () => {
          try {
            await registrarContagem(formData);
            setProdutoId("");
            setQuantidadeContada("");
            router.refresh();
          } catch (e: any) {
            setErro(e?.message || "Não foi possível registrar a contagem.");
          }
        });
      }}
    >
      <input type="hidden" name="unidadeId" value={unidadeId} />
      <div className="field-row">
        <div className="field-group">
          <label htmlFor="produtoId">Produto</label>
          <select
            id="produtoId"
            name="produtoId"
            required
            value={produtoId}
            onChange={(e) => setProdutoId(e.target.value)}
          >
            <option value="">Selecione</option>
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} ({p.unidadeMedida})
              </option>
            ))}
          </select>
        </div>
        <div className="field-group">
          <label htmlFor="quantidadeContada">Quantidade contada</label>
          <input
            id="quantidadeContada"
            name="quantidadeContada"
            type="number"
            step="any"
            min="0"
            required
            value={quantidadeContada}
            onChange={(e) => setQuantidadeContada(e.target.value)}
          />
        </div>
      </div>
      {produtoSelecionado && (
        <p style={{ fontSize: 12.5, color: "#6b6252", marginTop: -6, marginBottom: 14 }}>
          Saldo de sistema hoje: {produtoSelecionado.saldoSistema} {produtoSelecionado.unidadeMedida}
        </p>
      )}
      {erro && <p className="error-msg">{erro}</p>}
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? "Salvando…" : "Registrar contagem"}
      </button>
    </form>
  );
}
