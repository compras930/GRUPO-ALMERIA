"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registrarContagemEmLote } from "@/actions/estoque";

type Item = { id: string; nome: string; unidadeMedida: string; classeAbc: string | null };

export default function ContagemLoteForm({
  unidadeId,
  rotulo,
  itens,
}: {
  unidadeId: string;
  /** O que o botão promete gravar — "contagem da semana 3", "contagem inicial". */
  rotulo: string;
  itens: Item[];
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<number | null>(null);
  const [preenchidos, setPreenchidos] = useState(0);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // O saldo do sistema NÃO aparece aqui, de propósito: quem conta olhando o
  // número esperado confirma o número esperado. A diferença entre o contado e
  // o sistema é o produto inteiro deste trabalho — mostrar a resposta antes
  // destrói a medida. Ela aparece depois, no relatório de consumo.
  return (
    <form
      action={(formData) => {
        setErro(null);
        setOk(null);
        startTransition(async () => {
          try {
            const r = await registrarContagemEmLote(formData);
            setOk(r.registradas);
            router.refresh();
          } catch (e: any) {
            setErro(e?.message || "Não foi possível registrar a contagem.");
          }
        });
      }}
      onChange={(e) => {
        const form = (e.currentTarget as HTMLFormElement).elements;
        let n = 0;
        for (const el of Array.from(form)) {
          const input = el as HTMLInputElement;
          if (input.name?.startsWith("qtd_") && input.value.trim() !== "") n++;
        }
        setPreenchidos(n);
      }}
    >
      <input type="hidden" name="unidadeId" value={unidadeId} />

      <table>
        <thead>
          <tr>
            <th style={{ width: 36 }}>#</th>
            <th>produto</th>
            <th style={{ width: 70 }}>un</th>
            <th style={{ width: 160 }}>quantidade contada</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((p, i) => (
            <tr key={p.id}>
              <td style={{ opacity: 0.5 }}>{i + 1}</td>
              <td>
                {p.nome} {p.classeAbc && <span className="tag">{p.classeAbc}</span>}
              </td>
              <td style={{ opacity: 0.75 }}>{p.unidadeMedida}</td>
              <td>
                <input
                  name={`qtd_${p.id}`}
                  type="number"
                  step="any"
                  min="0"
                  inputMode="decimal"
                  placeholder="—"
                  style={{ width: "100%" }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {erro && <p className="error-msg">{erro}</p>}
      {ok !== null && (
        <p className="error-msg" style={{ borderColor: "currentColor" }}>
          {ok} {ok === 1 ? "contagem registrada" : "contagens registradas"}.
        </p>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 14 }}>
        <button className="btn primary" type="submit" disabled={pending || preenchidos === 0}>
          {pending ? "Salvando…" : `Registrar ${rotulo}`}
        </button>
        <span style={{ opacity: 0.7 }}>
          {preenchidos} de {itens.length} preenchidos
        </span>
      </div>
      <p style={{ opacity: 0.7, marginTop: 8 }}>
        Item que você não conseguiu contar: deixe em branco. Em branco é pulado; zero significa &ldquo;conferi e
        não tem nenhum&rdquo;, que é outra coisa — e entraria no consumo como se o estoque tivesse sumido.
      </p>
    </form>
  );
}
