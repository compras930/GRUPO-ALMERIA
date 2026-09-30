"use client";

import Link from "next/link";
import { useState } from "react";
import { alternarItemVenda, excluirItemVenda } from "@/actions/cmv";

/**
 * A célula de ações de uma linha da lista de CMV: editar a ficha, tirar do
 * cardápio (ou devolver) e, só para item já fora, excluir.
 *
 * Client component pelos dois motivos de sempre neste projeto:
 *
 * 1. A recusa de excluir é uma instrução — "tem 12 semanas de venda
 *    registradas, use Tirar do cardápio" — e precisa ser lida. Num
 *    `<form action={...}>` de server component ela virava "Application error".
 *
 * 2. Excluir é irreversível e fica a um clique de "Voltar ao cardápio". O
 *    confirm() é barato e o engano não é.
 *
 * O link de ficha mora aqui, e não na página, porque a célula inteira é uma
 * coisa só: os botões ficam numa linha que NÃO quebra, e a mensagem de erro
 * cai embaixo dela. Com o link fora, a página aninhava dois flex e os três
 * botões viravam três linhas — apareceu na primeira captura da tela.
 */
export default function AcoesItemVenda({
  id,
  nome,
  fora,
  semFicha,
}: {
  id: string;
  nome: string;
  fora: boolean;
  semFicha: boolean;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function rodar(fn: () => Promise<void>) {
    if (ocupado) return;
    setErro(null);
    setOcupado(true);
    try {
      await fn();
    } catch (e: any) {
      setErro(e?.message || "Não foi possível concluir.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="acoes-celula">
      <div className="acoes-linha">
        <Link href={`/cmv/${id}`} className="btn small">
          {semFicha ? "Criar ficha" : "Editar"}
        </Link>

        <button
          className="btn small"
          type="button"
          disabled={ocupado}
          onClick={() => rodar(() => alternarItemVenda(id, fora))}
        >
          {fora ? "Voltar ao cardápio" : "Tirar do cardápio"}
        </button>

        {fora && (
          <button
            className="btn small danger"
            type="button"
            disabled={ocupado}
            onClick={() => {
              if (!confirm(`Excluir "${nome}" de vez? Só funciona se ele nunca vendeu.`)) return;
              rodar(() => excluirItemVenda(id));
            }}
          >
            Excluir
          </button>
        )}
      </div>

      {erro && <p className="error-msg linha">{erro}</p>}
    </div>
  );
}
