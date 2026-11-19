"use client";

import { useMemo, useState } from "react";
import { vincularRevendaDireta, vincularEmLote, desfazerRevendaDireta } from "@/actions/revenda";
import { fmtCurrency } from "@/lib/format";

type Produto = { produtoId: string; nome: string; unidadeMedida: string };

export type ItemNaTela = {
  itemVendaId: string;
  nome: string;
  tipo: string;
  categoria: string | null;
  faturamento: number;
  quantidadeVendida: number;
  /** Já vinculado? Então mostra o produto e o botão de desfazer. */
  produtoVinculado: string | null;
  sugestaoProdutoId: string | null;
  confianca: "EXATA" | "PARCIAL" | "NENHUMA";
  motivo: string;
  temFicha: boolean;
};

/**
 * Ligar item de cardápio a produto de despensa — a revenda direta.
 *
 * ORDENADO POR FATURAMENTO, não alfabético: cada vínculo compra exatidão, e a
 * água mais vendida da casa compra muito mais que o licor que saiu duas vezes.
 * Quem para no meio da lista parou no lugar certo.
 */
export default function RevendaDiretaForm({
  itens,
  produtos,
}: {
  itens: ItemNaTela[];
  produtos: Produto[];
}) {
  const [escolha, setEscolha] = useState<Record<string, string>>(
    Object.fromEntries(itens.map((i) => [i.itemVendaId, i.sugestaoProdutoId ?? ""]))
  );
  const [quantidade, setQuantidade] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const exatas = useMemo(
    () => itens.filter((i) => !i.produtoVinculado && i.confianca === "EXATA" && i.sugestaoProdutoId),
    [itens]
  );
  const termo = busca.trim().toLowerCase();
  const visiveis = termo ? itens.filter((i) => i.nome.toLowerCase().includes(termo)) : itens;

  async function vincular(item: ItemNaTela) {
    const produtoId = escolha[item.itemVendaId];
    if (!produtoId) {
      setErro(`Escolha o produto de "${item.nome}".`);
      return;
    }
    setErro(null);
    setOcupado(item.itemVendaId);
    try {
      const r = await vincularRevendaDireta(
        item.itemVendaId,
        produtoId,
        Number(quantidade[item.itemVendaId] ?? "1") || 1
      );
      if ("erro" in r) setErro(r.erro);
    } finally {
      setOcupado(null);
    }
  }

  async function desfazer(item: ItemNaTela) {
    setOcupado(item.itemVendaId);
    try {
      const r = await desfazerRevendaDireta(item.itemVendaId);
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
            {exatas.length} {exatas.length === 1 ? "item casa" : "itens casam"} por nome idêntico
          </h2>
          <p className="hint" style={{ marginBottom: 12 }}>
            Mesmo nome dos dois lados, uma unidade vendida para uma unidade do estoque. Os
            parecidos ficam de fora deste botão de propósito: &ldquo;COCA COLA ZERO&rdquo; e
            &ldquo;COCA COLA ZERO 310ML LATA&rdquo; podem ser a mesma coisa ou podem ser lata e
            garrafa, e a diferença é o dobro do estoque descontado.
          </p>
          <button
            type="button"
            className="btn primary"
            disabled={ocupado !== null}
            onClick={async () => {
              setOcupado("lote");
              try {
                await vincularEmLote(
                  exatas.map((i) => ({ itemVendaId: i.itemVendaId, produtoId: i.sugestaoProdutoId! }))
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
        <label htmlFor="busca">Procurar item</label>
        <input id="busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="parte do nome" />
      </div>

      {erro && <p className="error-msg">{erro}</p>}

      <table>
        <thead>
          <tr>
            <th>Item do cardápio</th>
            <th className="num">Vendidos</th>
            <th className="num">Faturou</th>
            <th>Produto da despensa</th>
            <th className="num" style={{ width: 90 }}>Por unidade</th>
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
              <td className="num">{i.quantidadeVendida.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
              <td className="num">{fmtCurrency(i.faturamento)}</td>
              <td>
                {i.produtoVinculado ? (
                  <>
                    {i.produtoVinculado}
                    <span className="tag ok" style={{ marginLeft: 6 }}>vinculado</span>
                  </>
                ) : (
                  <>
                    <select
                      value={escolha[i.itemVendaId] ?? ""}
                      disabled={ocupado !== null}
                      onChange={(e) => setEscolha((p) => ({ ...p, [i.itemVendaId]: e.target.value }))}
                      style={{ width: "100%" }}
                    >
                      <option value="">— escolha o produto —</option>
                      {produtos.map((p) => (
                        <option key={p.produtoId} value={p.produtoId}>
                          {p.nome} ({p.unidadeMedida})
                        </option>
                      ))}
                    </select>
                    <span className={`cat bloco${i.confianca === "PARCIAL" ? " aviso" : ""}`}>{i.motivo}</span>
                  </>
                )}
              </td>
              <td className="num">
                {i.produtoVinculado ? (
                  "—"
                ) : (
                  <input
                    type="number"
                    step="any"
                    min="0"
                    style={{ width: 70, textAlign: "right" }}
                    placeholder="1"
                    value={quantidade[i.itemVendaId] ?? ""}
                    onChange={(e) => setQuantidade((p) => ({ ...p, [i.itemVendaId]: e.target.value }))}
                  />
                )}
              </td>
              <td>
                {i.produtoVinculado ? (
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
