"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registrarPerda } from "@/actions/estoque";
import { TIPO_PERDA, TIPO_PERDA_LABEL, type TipoPerda } from "@/lib/constants";
import SeletorProduto, { type ProdutoOpcao } from "@/components/SeletorProduto";

/**
 * Lançamento de baixa declarada — o gerente, todo dia, no momento em que
 * acontece.
 *
 * O FORMULÁRIO NÃO LIMPA O MOTIVO depois de salvar, só o produto e a
 * quantidade. Quem está lançando perda está quase sempre lançando a MESMA
 * espécie de perda em sequência — fecha a cozinha, joga fora três coisas que
 * venceram. Reescolher "Vencimento" três vezes é o tipo de atrito que faz a
 * rotina ser abandonada na terceira semana.
 *
 * O foco volta pro seletor de produto pelo mesmo motivo: o próximo gesto é
 * sempre procurar o próximo item.
 */
export default function PerdaForm({
  unidadeId,
  produtos,
}: {
  unidadeId: string;
  produtos: ProdutoOpcao[];
}) {
  const [produto, setProduto] = useState<ProdutoOpcao | null>(null);
  const [tipo, setTipo] = useState<TipoPerda | "">("");
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState<string | null>(null);
  const [chaveSeletor, setChaveSeletor] = useState(0);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      action={(formData) => {
        setErro(null);
        setSalvo(null);
        const nomeLancado = produto?.nome ?? "";
        const qtdLancada = quantidade;
        startTransition(async () => {
          try {
            await registrarPerda(formData);
            setSalvo(`Baixa de ${qtdLancada} ${produto?.unidadeMedida ?? ""} de ${nomeLancado} registrada.`);
            setProduto(null);
            setQuantidade("");
            setObservacao("");
            // O motivo FICA. Ver o comentário no topo.
            setChaveSeletor((k) => k + 1);
            router.refresh();
          } catch (e: any) {
            setErro(e?.message || "Não foi possível registrar a baixa.");
          }
        });
      }}
    >
      <input type="hidden" name="unidadeId" value={unidadeId} />
      <input type="hidden" name="produtoId" value={produto?.id ?? ""} />

      <div className="field-row">
        <div className="field-group" style={{ minWidth: 300 }}>
          <label>Produto</label>
          <SeletorProduto
            key={chaveSeletor}
            opcoes={produtos}
            selecionado={produto}
            onSelecionar={setProduto}
            autoFocus
          />
        </div>

        <div className="field-group" style={{ maxWidth: 140 }}>
          <label htmlFor="quantidade">
            Quantidade{produto ? ` (${produto.unidadeMedida})` : ""}
          </label>
          <input
            id="quantidade"
            name="quantidade"
            required
            inputMode="decimal"
            placeholder="0"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
          />
        </div>

        <div className="field-group" style={{ minWidth: 250 }}>
          <label htmlFor="tipo">Motivo</label>
          <select
            id="tipo"
            name="tipo"
            required
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoPerda)}
          >
            <option value="" disabled>
              Selecione
            </option>
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
          <label htmlFor="observacao">Observação (opcional)</label>
          <input
            id="observacao"
            name="observacao"
            placeholder="O que ajudaria a entender daqui a um mês"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </div>
      </div>

      {erro && <p className="error-msg">{erro}</p>}
      {salvo && <p className="ok-msg">{salvo}</p>}

      <div className="barra-acao" style={{ marginTop: 14, marginBottom: 0 }}>
        <button className="btn primary" type="submit" disabled={pending || !produto}>
          {pending ? "Registrando..." : "Registrar baixa"}
        </button>
        {!produto && <span className="sub" style={{ margin: 0 }}>Escolha o produto para liberar.</span>}
      </div>
    </form>
  );
}
