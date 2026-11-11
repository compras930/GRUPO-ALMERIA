"use client";

import { useState } from "react";
import { criarPedido } from "@/actions/pedidos";
import { MOTIVOS_EXTRA, rotuloCurto } from "@/lib/regra-de-pedido";

type Opcao = { id: string; nome: string };

export type DiretrizDoPedido = {
  tipo: "NORMAL" | "EXTRA";
  aviso: string | null;
  jaFeitos: number;
  diaPreferido: string;
  feriado: { dia: string; nome: string } | null;
  numerosDaSemana: number[];
};
type Produto = { id: string; nome: string; unidadeMedida: string };

type Item = { produtoId: string; quantidade: string; precoUnitEsperado: string };

export default function NovoPedidoForm({
  unidades,
  fornecedores,
  produtos,
  unidadeFixaId,
  diretriz,
}: {
  unidades: Opcao[];
  fornecedores: Opcao[];
  produtos: Produto[];
  unidadeFixaId: string | null;
  diretriz?: DiretrizDoPedido;
}) {
  const [motivo, setMotivo] = useState("");
  const extra = diretriz?.tipo === "EXTRA";
  const [itens, setItens] = useState<Item[]>([{ produtoId: "", quantidade: "", precoUnitEsperado: "" }]);
  const [erro, setErro] = useState<string | null>(null);

  function atualizarItem(idx: number, campo: keyof Item, valor: string) {
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, [campo]: valor } : it)));
  }

  function adicionarLinha() {
    setItens((prev) => [...prev, { produtoId: "", quantidade: "", precoUnitEsperado: "" }]);
  }

  function removerLinha(idx: number) {
    setItens((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(formData: FormData) {
    setErro(null);
    const itensValidos = itens
      .filter((i) => i.produtoId && Number(i.quantidade) > 0)
      .map((i) => ({
        produtoId: i.produtoId,
        quantidade: Number(i.quantidade),
        precoUnitEsperado: Number(i.precoUnitEsperado) || 0,
      }));
    if (itensValidos.length === 0) {
      setErro("Adicione ao menos um item com quantidade.");
      return;
    }
    formData.set("itens", JSON.stringify(itensValidos));
    try {
      // A ação DEVOLVE a recusa de regra (ver src/actions/pedidos.ts): em
      // produção, erro lançado chega aqui como texto de framework.
      const r = await criarPedido(formData);
      if (r?.erro) {
        setErro(r.erro);
        return;
      }
    } catch (e: any) {
      // criarPedido faz redirect() em sucesso — chegar aqui num catch normalmente é erro real,
      // mas o redirect do Next lança uma exceção especial internamente; se for ela, deixa propagar.
      if (e?.digest?.includes("NEXT_REDIRECT")) throw e;
      setErro(e?.message || "Não foi possível criar o pedido.");
    }
  }

  return (
    <form action={handleSubmit}>
      {diretriz && (
        <div className={`aviso-diretriz${extra ? " extra" : ""}`}>
          {extra ? (
            <>
              <strong>Pedido extra.</strong> Esta casa já fez o pedido desta semana
              {diretriz.numerosDaSemana.length > 0
                ? ` (nº ${diretriz.numerosDaSemana.join(", ")})`
                : ""}
              . Extra não é proibido — é caro: frete avulso, preço de emergência, alguém parando o
              serviço para receber. Diga o motivo e siga.
            </>
          ) : (
            <>
              {/* O aviso já nomeia o dia e o feriado — repetir a frase aqui
                  dizia a mesma coisa duas vezes na mesma linha. */}
              <strong>Pedido da semana.</strong>{" "}
              {diretriz.aviso ??
                `Hoje é o dia combinado (${rotuloCurto(diretriz.diaPreferido)}${
                  diretriz.feriado ? `, porque a segunda caiu em ${diretriz.feriado.nome}` : ""
                }).`}
            </>
          )}
        </div>
      )}

      {extra && (
        <div className="field-row">
          <div className="field-group">
            <label htmlFor="motivoExtra">Motivo do pedido extra</label>
            <select
              id="motivoExtra"
              name="motivoExtra"
              required
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            >
              <option value="" disabled>
                Selecione
              </option>
              {MOTIVOS_EXTRA.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.rotulo}
                </option>
              ))}
            </select>
          </div>
          <div className="field-group" style={{ flex: 2 }}>
            <label htmlFor="motivoDetalhe">
              Detalhe {motivo === "OUTRO" ? "(obrigatório)" : "(opcional)"}
            </label>
            <input
              id="motivoDetalhe"
              name="motivoDetalhe"
              placeholder="o que aconteceu, em uma linha"
              required={motivo === "OUTRO"}
            />
          </div>
        </div>
      )}

      <div className="field-row">
        <div className="field-group">
          <label htmlFor="unidadeId">Unidade</label>
          {unidadeFixaId ? (
            <>
              <input type="hidden" name="unidadeId" value={unidadeFixaId} />
              <input disabled value={unidades.find((u) => u.id === unidadeFixaId)?.nome ?? ""} />
            </>
          ) : (
            <select id="unidadeId" name="unidadeId" required defaultValue="">
              <option value="" disabled>
                Selecione
              </option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="field-group">
          <label htmlFor="fornecedorId">Fornecedor</label>
          <select id="fornecedorId" name="fornecedorId" required defaultValue="">
            <option value="" disabled>
              Selecione
            </option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field-group" style={{ marginBottom: 18 }}>
        <label htmlFor="observacao">Observação (opcional)</label>
        <textarea id="observacao" name="observacao" rows={2} />
      </div>

      <table style={{ marginBottom: 12 }}>
        <thead>
          <tr>
            <th>Produto</th>
            <th className="num">Qtd.</th>
            <th className="num">Preço unit. esperado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item, idx) => (
            <tr key={idx}>
              <td>
                <select
                  value={item.produtoId}
                  onChange={(e) => atualizarItem(idx, "produtoId", e.target.value)}
                  required
                >
                  <option value="">Selecione o produto</option>
                  {produtos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} ({p.unidadeMedida})
                    </option>
                  ))}
                </select>
              </td>
              <td className="num">
                <input
                  type="number"
                  step="any"
                  min="0"
                  style={{ width: 90, textAlign: "right" }}
                  value={item.quantidade}
                  onChange={(e) => atualizarItem(idx, "quantidade", e.target.value)}
                />
              </td>
              <td className="num">
                <input
                  type="number"
                  step="any"
                  min="0"
                  style={{ width: 110, textAlign: "right" }}
                  value={item.precoUnitEsperado}
                  onChange={(e) => atualizarItem(idx, "precoUnitEsperado", e.target.value)}
                />
              </td>
              <td>
                <button type="button" className="btn small danger" onClick={() => removerLinha(idx)}>
                  Remover
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button type="button" className="btn small" onClick={adicionarLinha} style={{ marginBottom: 20 }}>
        + Adicionar item
      </button>

      {erro && <p className="error-msg">{erro}</p>}

      <div>
        <button className="btn primary" type="submit">
          Enviar para aprovação
        </button>
      </div>
    </form>
  );
}
