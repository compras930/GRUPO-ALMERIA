"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registrarPerdaDeItemVendido } from "@/actions/estoque";
import { TIPO_PERDA, TIPO_PERDA_LABEL, type TipoPerda } from "@/lib/constants";
import SeletorProduto, { type ProdutoOpcao } from "@/components/SeletorProduto";

/**
 * Baixa de PRATO ou DRINK — o que voltou do salão.
 *
 * Irmão do PerdaForm, e existe separado por uma razão de uso, não de código:
 * quem lança isto está com um prato devolvido na mão e sabe o nome do PRATO.
 * Não sabe — nem deveria — que aquilo são 180 g de atum e 20 g de cebolete. A
 * ficha faz a tradução no servidor.
 *
 * SÓ APARECE ITEM COM FICHA. Um prato sem ficha seria recusado pela ação, e
 * oferecê-lo na lista para depois dizer "não dá" é fazer a pessoa digitar duas
 * vezes para ouvir não. A tela abaixo diz quantos ficaram de fora e por quê,
 * que é informação útil: é a fila de fichas a escrever.
 *
 * O MOTIVO NÃO LIMPA depois de salvar, igual ao PerdaForm: três devoluções da
 * mesma noite são três lançamentos seguidos do mesmo motivo.
 */
export default function PerdaItemVendidoForm({
  unidadeId,
  itens,
}: {
  unidadeId: string;
  itens: ProdutoOpcao[];
}) {
  const [item, setItem] = useState<ProdutoOpcao | null>(null);
  const [tipo, setTipo] = useState<TipoPerda | "">("PERDA_DEVOLUCAO");
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState<string | null>(null);
  const [chaveSeletor, setChaveSeletor] = useState(0);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (itens.length === 0) {
    return (
      <div className="empty">
        Nenhum prato ou drink desta casa tem ficha técnica ainda. Sem ficha não há como saber o que
        sai da despensa quando um prato volta — escreva as fichas em Fichas técnicas e esta tela
        passa a funcionar.
      </div>
    );
  }

  return (
    <form
      action={(formData) => {
        setErro(null);
        setSalvo(null);
        const nome = item?.nome ?? "";
        const qtd = quantidade;
        startTransition(async () => {
          try {
            const r = await registrarPerdaDeItemVendido(formData);
            setSalvo(
              `Baixa de ${qtd} × ${nome} registrada — ${r.insumos} ${r.insumos === 1 ? "insumo saiu" : "insumos saíram"} da despensa.`
            );
            setItem(null);
            setQuantidade("");
            setObservacao("");
            setChaveSeletor((k) => k + 1);
            router.refresh();
          } catch (e: any) {
            setErro(e?.message || "Não foi possível registrar a baixa.");
          }
        });
      }}
    >
      <input type="hidden" name="unidadeId" value={unidadeId} />
      <input type="hidden" name="itemVendaId" value={item?.id ?? ""} />

      <div className="field-row">
        <div className="field-group" style={{ minWidth: 300 }}>
          <label>Prato ou drink</label>
          <SeletorProduto
            key={chaveSeletor}
            opcoes={itens}
            selecionado={item}
            onSelecionar={setItem}
            autoFocus
          />
        </div>

        <div className="field-group" style={{ maxWidth: 140 }}>
          <label htmlFor="qtd-item">Quantas porções</label>
          <input
            id="qtd-item"
            name="quantidade"
            required
            inputMode="decimal"
            placeholder="1"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
          />
        </div>

        <div className="field-group" style={{ minWidth: 250 }}>
          <label htmlFor="tipo-item">Motivo</label>
          <select
            id="tipo-item"
            name="tipo"
            required
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoPerda)}
          >
            {TIPO_PERDA.map((t) => (
              <option key={t} value={t}>
                {TIPO_PERDA_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field-row">
        <div className="field-group">
          <label htmlFor="obs-item">Observação (opcional)</label>
          <input
            id="obs-item"
            name="observacao"
            placeholder="Por que voltou — ajuda a entender daqui a um mês"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </div>
      </div>

      {erro && <p className="error-msg">{erro}</p>}
      {salvo && (
        <p className="error-msg" style={{ borderColor: "currentColor" }}>
          {salvo}
        </p>
      )}

      <button className="btn primary" type="submit" disabled={pending || !item}>
        {pending ? "Registrando…" : "Registrar baixa do prato"}
      </button>
    </form>
  );
}
