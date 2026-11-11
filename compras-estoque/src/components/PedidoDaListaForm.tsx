"use client";

import { useMemo, useState } from "react";
import { criarPedidoDaLista } from "@/actions/pedidos";
import { MOTIVOS_EXTRA, rotuloCurto } from "@/lib/regra-de-pedido";
import type { DiretrizDoPedido } from "@/components/NovoPedidoForm";

type Item = { id: string; nome: string; unidadeCompra: string };
type Secao = { secao: string; itens: Item[] };

/**
 * A lista da casa, do jeito que ela já é preenchida na planilha: desce seção
 * por seção e escreve a quantidade só no que precisa.
 *
 * SEM CAIXA DE SELEÇÃO. Marcar e depois digitar seria dois gestos para a mesma
 * decisão — quantidade preenchida já diz "quero este". Quem errou apaga.
 *
 * NADA DE AUTOFOCO e nada de rolagem automática: a pessoa percorre a lista com
 * os olhos, não com o cursor, e um campo que rouba o foco atrapalha a consulta.
 */
export default function PedidoDaListaForm({
  unidadeId,
  secoes,
  diretriz,
}: {
  unidadeId: string;
  secoes: Secao[];
  diretriz: DiretrizDoPedido;
}) {
  const [qtd, setQtd] = useState<Record<string, string>>({});
  // Itens fora da lista: produto novo para teste, pedido do chef. Começa
  // fechado — é a exceção, e aberto empurraria a lista para baixo toda vez.
  const [fora, setFora] = useState<{ nome: string; unidade: string; quantidade: string }[]>([]);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const extra = diretriz.tipo === "EXTRA";
  const preenchidos = useMemo(
    () =>
      Object.entries(qtd).filter(([, v]) => Number(v) > 0).length +
      fora.filter((f) => f.nome.trim() && Number(f.quantidade) > 0).length,
    [qtd, fora]
  );
  const termo = busca.trim().toLowerCase();

  async function enviar(formData: FormData) {
    setErro(null);
    const itens = Object.entries(qtd)
      .map(([listaItemId, v]) => ({ listaItemId, quantidade: Number(v) }))
      .filter((i) => i.quantidade > 0);
    const extras = fora
      .filter((f) => f.nome.trim() && Number(f.quantidade) > 0)
      .map((f) => ({ nome: f.nome.trim(), unidade: f.unidade.trim(), quantidade: Number(f.quantidade) }));
    if (itens.length === 0 && extras.length === 0) {
      setErro("Preencha a quantidade de pelo menos um item.");
      return;
    }
    formData.set("itens", JSON.stringify(itens));
    formData.set("foraDaLista", JSON.stringify(extras));
    try {
      const r = await criarPedidoDaLista(formData);
      if (r?.erro) {
        setErro(r.erro);
        return;
      }
    } catch (e: any) {
      if (e?.digest?.includes("NEXT_REDIRECT")) throw e;
      setErro(e?.message || "Não foi possível enviar o pedido.");
    }
  }

  return (
    <form action={enviar}>
      <input type="hidden" name="unidadeId" value={unidadeId} />

      <div className={`aviso-diretriz${extra ? " extra" : ""}`}>
        {extra ? (
          <>
            <strong>Pedido extra.</strong> Esta casa já fez o pedido desta semana
            {diretriz.numerosDaSemana.length > 0 ? ` (nº ${diretriz.numerosDaSemana.join(", ")})` : ""}.
            Extra não é proibido — é caro. Diga o motivo e siga.
          </>
        ) : (
          <>
            <strong>Pedido da semana.</strong>{" "}
            {diretriz.aviso ??
              `Hoje é o dia combinado (${rotuloCurto(diretriz.diaPreferido)}${
                diretriz.feriado ? `, porque a segunda caiu em ${diretriz.feriado.nome}` : ""
              }).`}
          </>
        )}
      </div>

      {extra && (
        <div className="field-row">
          <div className="field-group">
            <label htmlFor="motivoExtra">Motivo do pedido extra</label>
            <select id="motivoExtra" name="motivoExtra" required value={motivo} onChange={(e) => setMotivo(e.target.value)}>
              <option value="" disabled>Selecione</option>
              {MOTIVOS_EXTRA.map((m) => (
                <option key={m.valor} value={m.valor}>{m.rotulo}</option>
              ))}
            </select>
          </div>
          <div className="field-group" style={{ flex: 2 }}>
            <label htmlFor="motivoDetalhe">Detalhe {motivo === "OUTRO" ? "(obrigatório)" : "(opcional)"}</label>
            <input id="motivoDetalhe" name="motivoDetalhe" placeholder="o que aconteceu, em uma linha" required={motivo === "OUTRO"} />
          </div>
        </div>
      )}

      <div className="field-row">
        <div className="field-group" style={{ flex: 2 }}>
          <label htmlFor="busca">Procurar na lista</label>
          <input
            id="busca"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="parte do nome — ex.: burrata"
          />
        </div>
        <div className="field-group" style={{ flex: 3 }}>
          <label htmlFor="observacao">Observação (opcional)</label>
          <input id="observacao" name="observacao" placeholder="algo que quem compra precisa saber" />
        </div>
      </div>

      {secoes.map(({ secao, itens }) => {
        const visiveis = termo ? itens.filter((i) => i.nome.toLowerCase().includes(termo)) : itens;
        if (visiveis.length === 0) return null;
        const marcados = itens.filter((i) => Number(qtd[i.id]) > 0).length;
        return (
          <div key={secao} style={{ marginTop: 22 }}>
            <p className="eyebrow" style={{ marginBottom: 6 }}>
              {secao} · {visiveis.length} itens
              {marcados > 0 ? ` · ${marcados} pedido${marcados > 1 ? "s" : ""}` : ""}
            </p>
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th style={{ width: 70 }}>Un.</th>
                  <th className="num" style={{ width: 120 }}>Quantidade</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((i) => {
                  const pedido = Number(qtd[i.id]) > 0;
                  return (
                    <tr key={i.id} className={pedido ? "linha-pedida" : undefined}>
                      <td>{i.nome}</td>
                      <td className="cat">{i.unidadeCompra}</td>
                      <td className="num">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          inputMode="decimal"
                          style={{ width: 100, textAlign: "right" }}
                          value={qtd[i.id] ?? ""}
                          onChange={(e) => setQtd((p) => ({ ...p, [i.id]: e.target.value }))}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      {/* FORA DA LISTA — produto novo, teste, pedido do chef.
          Fica no fim porque é a exceção; no topo, empurraria a lista para
          baixo toda semana para um caso que acontece de vez em quando. */}
      <div style={{ marginTop: 28 }}>
        <p className="eyebrow" style={{ marginBottom: 6 }}>
          Fora da lista {fora.length > 0 ? `· ${fora.length}` : ""}
        </p>
        <p className="hint" style={{ marginBottom: 10 }}>
          Produto novo, teste, pedido do chef — o que ainda não está na lista da casa. Escreva o nome
          como você falaria com o fornecedor. Quem compra decide de quem vem, e se o item vira
          rotina, ele entra na lista depois.
        </p>
        {fora.length > 0 && (
          <table style={{ marginBottom: 10 }}>
            <thead>
              <tr>
                <th>Produto</th>
                <th style={{ width: 110 }}>Unidade</th>
                <th className="num" style={{ width: 120 }}>Quantidade</th>
                <th style={{ width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {fora.map((f, idx) => (
                <tr key={idx}>
                  <td>
                    <input
                      value={f.nome}
                      placeholder="ex.: BURRATA DEFUMADA 250G"
                      style={{ width: "100%" }}
                      onChange={(e) =>
                        setFora((p) => p.map((x, i) => (i === idx ? { ...x, nome: e.target.value } : x)))
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={f.unidade}
                      placeholder="KG, UND…"
                      style={{ width: "100%" }}
                      onChange={(e) =>
                        setFora((p) => p.map((x, i) => (i === idx ? { ...x, unidade: e.target.value } : x)))
                      }
                    />
                  </td>
                  <td className="num">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      inputMode="decimal"
                      style={{ width: 100, textAlign: "right" }}
                      value={f.quantidade}
                      onChange={(e) =>
                        setFora((p) => p.map((x, i) => (i === idx ? { ...x, quantidade: e.target.value } : x)))
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn small danger"
                      onClick={() => setFora((p) => p.filter((_, i) => i !== idx))}
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button
          type="button"
          className="btn small"
          onClick={() => setFora((p) => [...p, { nome: "", unidade: "", quantidade: "" }])}
        >
          + Item fora da lista
        </button>
      </div>

      {erro && <p className="error-msg" style={{ marginTop: 16 }}>{erro}</p>}

      {/* A barra fica fixa no rodapé: a lista tem centenas de linhas, e um
          botão só no fim obrigaria a rolar tudo de volta para enviar. */}
      <div className="barra-envio">
        <span>
          {preenchidos === 0
            ? "Nenhum item preenchido ainda"
            : `${preenchidos} ${preenchidos === 1 ? "item" : "itens"} neste pedido`}
        </span>
        <button className="btn primary" type="submit" disabled={preenchidos === 0}>
          Enviar para aprovação
        </button>
      </div>
    </form>
  );
}
