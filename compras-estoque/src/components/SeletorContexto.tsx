"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { definirSelecao } from "@/actions/selecao";
import { TODAS } from "@/lib/selecao";

/**
 * A casa e o mês, no menu lateral — e não dentro de cada tela.
 *
 * POR QUE AQUI. Antes cada página tinha o próprio seletor, e trocar de aba
 * perdia a escolha: quem estava em outubro do Beira Lago clicava em Estoque e
 * caía no 104 Sul do mês corrente. O pior não era o clique a mais; era a tela
 * nova mostrar números plausíveis de outra casa, sem avisar.
 *
 * No menu, ele fica onde a pessoa olha para trocar de tela — e vale para todas
 * elas.
 *
 * MUDA NO `onChange`, sem botão de aplicar: seleção de contexto não é
 * formulário, é interruptor. Botão a mais aqui vira tela que não mudou porque
 * alguém esqueceu de confirmar.
 */
export default function SeletorContexto({
  casas,
  meses,
  casaId,
  mes,
  podeVerTodas,
}: {
  casas: { id: string; nome: string }[];
  meses: { chave: string; rotulo: string }[];
  casaId: string | null;
  mes: string;
  podeVerTodas: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function trocar(campo: "casa" | "mes", valor: string) {
    const fd = new FormData();
    fd.set(campo, valor);
    startTransition(async () => {
      await definirSelecao(fd);
      // A URL pode carregar a seleção antiga (?unidadeId=...), e ela ganha do
      // cookie de propósito. Sem tirá-la, trocar no menu não teria efeito na
      // tela aberta — o sintoma seria "cliquei e não mudou".
      router.push(window.location.pathname);
      router.refresh();
    });
  }

  return (
    <div className="seletor-contexto" aria-busy={pending}>
      <label htmlFor="sel-casa">Casa</label>
      <select
        id="sel-casa"
        value={casaId ?? TODAS}
        disabled={pending}
        onChange={(e) => trocar("casa", e.target.value)}
      >
        {podeVerTodas && <option value={TODAS}>Todas as casas</option>}
        {casas.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>

      <label htmlFor="sel-mes">Mês</label>
      <select id="sel-mes" value={mes} disabled={pending} onChange={(e) => trocar("mes", e.target.value)}>
        {meses.map((m) => (
          <option key={m.chave} value={m.chave}>
            {m.rotulo}
          </option>
        ))}
      </select>
    </div>
  );
}
