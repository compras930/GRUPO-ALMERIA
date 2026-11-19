"use client";

import { useMemo, useState } from "react";
import {
  vincularFichaAoItem,
  vincularFichasEmLote,
  desfazerVinculoFicha,
} from "@/actions/vinculo-ficha";
import { fmtCurrency } from "@/lib/format";

export type FichaNaLista = {
  receitaId: string;
  nome: string;
  ingredientes: number;
  temRendimento: boolean;
};

export type ItemNaTela = {
  itemVendaId: string;
  nome: string;
  tipo: string;
  categoria: string | null;
  faturamento: number;
  quantidadeVendida: number;
  /** Já ligado? Então mostra a ficha e o botão de desfazer. */
  fichaVinculada: string | null;
  sugestaoReceitaId: string | null;
  confianca: "EXATA" | "PARCIAL" | "NENHUMA";
  motivo: string;
};

/**
 * Ligar item do cardápio à ficha técnica que o descreve.
 *
 * ORDENADO POR FATURAMENTO, não alfabético: cada vínculo compra exatidão, e o
 * prato que faturou 40 mil compra muito mais que a entrada que saiu duas
 * vezes. Quem parar no meio da lista parou no lugar certo.
 */
export default function VincularFichaForm({
  itens,
  fichas,
}: {
  itens: ItemNaTela[];
  fichas: FichaNaLista[];
}) {
  const [escolha, setEscolha] = useState<Record<string, string>>(
    Object.fromEntries(itens.map((i) => [i.itemVendaId, i.sugestaoReceitaId ?? ""]))
  );
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const exatas = useMemo(
    () => itens.filter((i) => !i.fichaVinculada && i.confianca === "EXATA" && i.sugestaoReceitaId),
    [itens]
  );
  const termo = busca.trim().toLowerCase();
  const visiveis = termo ? itens.filter((i) => i.nome.toLowerCase().includes(termo)) : itens;

  async function vincular(item: ItemNaTela) {
    const receitaId = escolha[item.itemVendaId];
    if (!receitaId) {
      setErro(`Escolha a ficha de "${item.nome}".`);
      return;
    }
    setErro(null);
    setOcupado(item.itemVendaId);
    try {
      const r = await vincularFichaAoItem(item.itemVendaId, receitaId);
      if ("erro" in r) setErro(r.erro);
    } finally {
      setOcupado(null);
    }
  }

  async function desfazer(item: ItemNaTela) {
    setOcupado(item.itemVendaId);
    try {
      const r = await desfazerVinculoFicha(item.itemVendaId);
      if (r.erro) setErro(r.erro);
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div>
      {exatas.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: 15, marginBottom: 4 }}>
            {exatas.length} {exatas.length === 1 ? "prato casa" : "pratos casam"} por nome idêntico
          </h2>
          <p className="hint" style={{ marginBottom: 12 }}>
            Mesmo nome dos dois lados. Os equivalentes ficam de fora deste botão de propósito:
            &ldquo;Tartar de Atum&rdquo; e &ldquo;MONTAGEM - TARTAR DE ATUM&rdquo; quase certamente
            são o mesmo prato, e <strong>quase certamente</strong> não é critério para gravar tudo
            de uma vez.
          </p>
          <button
            type="button"
            className="btn primary"
            disabled={ocupado !== null}
            onClick={async () => {
              setOcupado("lote");
              setErro(null);
              try {
                const r = await vincularFichasEmLote(
                  exatas.map((i) => ({ itemVendaId: i.itemVendaId, receitaId: i.sugestaoReceitaId! }))
                );
                setAviso(
                  r.erros > 0
                    ? `${r.vinculados} ligados, ${r.erros} recusados — o primeiro: ${r.primeiroErro}`
                    : `${r.vinculados} pratos ligados à ficha.`
                );
              } finally {
                setOcupado(null);
              }
            }}
          >
            {ocupado === "lote" ? "Vinculando…" : `Vincular os ${exatas.length} de nome idêntico`}
          </button>
        </div>
      )}

      <div className="field-group" style={{ maxWidth: 420, marginBottom: 14 }}>
        <label htmlFor="busca">Procurar prato</label>
        <input
          id="busca"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="parte do nome"
        />
      </div>

      {erro && <p className="error-msg">{erro}</p>}
      {aviso && <p className="hint">{aviso}</p>}

      <table>
        <thead>
          <tr>
            <th>Item do cardápio</th>
            <th className="num">Vendidos</th>
            <th className="num">Faturou</th>
            <th>Ficha técnica</th>
            <th style={{ width: 110 }}></th>
          </tr>
        </thead>
        <tbody>
          {visiveis.map((i) => (
            <tr key={i.itemVendaId}>
              <td>
                {i.nome}
                <span className="cat bloco">
                  {i.tipo}
                  {i.categoria ? ` · ${i.categoria}` : ""}
                </span>
              </td>
              <td className="num">
                {i.quantidadeVendida.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
              </td>
              <td className="num">{fmtCurrency(i.faturamento)}</td>
              <td>
                {i.fichaVinculada ? (
                  <>
                    {i.fichaVinculada}
                    <span className="tag ok" style={{ marginLeft: 6 }}>
                      vinculado
                    </span>
                  </>
                ) : (
                  <>
                    <select
                      value={escolha[i.itemVendaId] ?? ""}
                      disabled={ocupado !== null}
                      onChange={(e) =>
                        setEscolha((p) => ({ ...p, [i.itemVendaId]: e.target.value }))
                      }
                      style={{ width: "100%" }}
                    >
                      <option value="">— escolha a ficha —</option>
                      {fichas.map((f) => (
                        <option key={f.receitaId} value={f.receitaId}>
                          {f.nome} ({f.ingredientes} ingr.
                          {f.temRendimento ? "" : ", SEM RENDIMENTO"})
                        </option>
                      ))}
                    </select>
                    <span
                      className={`cat bloco${i.confianca === "PARCIAL" ? " aviso" : ""}`}
                    >
                      {i.motivo}
                    </span>
                  </>
                )}
              </td>
              <td>
                {i.fichaVinculada ? (
                  <button
                    type="button"
                    className="btn small"
                    disabled={ocupado !== null}
                    onClick={() => desfazer(i)}
                  >
                    Desfazer
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn small primary"
                    disabled={ocupado !== null}
                    onClick={() => vincular(i)}
                  >
                    {ocupado === i.itemVendaId ? "…" : "Vincular"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
