"use client";

import { useState } from "react";
import { registrarRecebimento } from "@/actions/recebimentos";

type ItemPendente = {
  itemPedidoId: string;
  produtoNome: string;
  unidadeMedida: string;
  quantidadePedida: number;
  quantidadeJaRecebida: number;
  precoUnitEsperado: number;
};

export default function RecebimentoForm({ pedidoId, itens }: { pedidoId: string; itens: ItemPendente[] }) {
  const [valores, setValores] = useState(
    itens.map((i) => ({
      itemPedidoId: i.itemPedidoId,
      quantidadeRecebida: String(Math.max(i.quantidadePedida - i.quantidadeJaRecebida, 0) || ""),
      precoUnitRecebido: String(i.precoUnitEsperado || ""),
    }))
  );
  const [erro, setErro] = useState<string | null>(null);

  function atualizar(idx: number, campo: "quantidadeRecebida" | "precoUnitRecebido", valor: string) {
    setValores((prev) => prev.map((v, i) => (i === idx ? { ...v, [campo]: valor } : v)));
  }

  async function handleSubmit(formData: FormData) {
    setErro(null);
    const itensPayload = valores
      .filter((v) => Number(v.quantidadeRecebida) > 0)
      .map((v) => ({
        itemPedidoId: v.itemPedidoId,
        quantidadeRecebida: Number(v.quantidadeRecebida),
        precoUnitRecebido: Number(v.precoUnitRecebido) || 0,
      }));
    if (itensPayload.length === 0) {
      setErro("Informe a quantidade recebida de ao menos um item.");
      return;
    }
    formData.set("itens", JSON.stringify(itensPayload));
    try {
      await registrarRecebimento(pedidoId, formData);
    } catch (e: any) {
      if (e?.digest?.includes("NEXT_REDIRECT")) throw e;
      setErro(e?.message || "Não foi possível registrar o recebimento.");
    }
  }

  return (
    <form action={handleSubmit}>
      <table style={{ marginBottom: 16 }}>
        <thead>
          <tr>
            <th>Produto</th>
            <th className="num">Pedido</th>
            <th className="num">Já recebido</th>
            <th className="num">Recebendo agora</th>
            <th className="num">Preço unit. recebido</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item, idx) => (
            <tr key={item.itemPedidoId}>
              <td>{item.produtoNome}</td>
              <td className="num">
                {item.quantidadePedida} {item.unidadeMedida}
              </td>
              <td className="num">
                {item.quantidadeJaRecebida} {item.unidadeMedida}
              </td>
              <td className="num">
                <input
                  type="number"
                  step="any"
                  min="0"
                  style={{ width: 100, textAlign: "right" }}
                  value={valores[idx].quantidadeRecebida}
                  onChange={(e) => atualizar(idx, "quantidadeRecebida", e.target.value)}
                />
              </td>
              <td className="num">
                <input
                  type="number"
                  step="any"
                  min="0"
                  style={{ width: 110, textAlign: "right" }}
                  value={valores[idx].precoUnitRecebido}
                  onChange={(e) => atualizar(idx, "precoUnitRecebido", e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="field-group" style={{ marginBottom: 18 }}>
        <label htmlFor="observacao">Observação (opcional)</label>
        <textarea id="observacao" name="observacao" rows={2} />
      </div>

      {erro && <p className="error-msg">{erro}</p>}

      <button className="btn primary" type="submit">
        Confirmar recebimento
      </button>
    </form>
  );
}
