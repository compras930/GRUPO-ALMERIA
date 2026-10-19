"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { chaveComparacao } from "@/lib/nome-normalizado";

/**
 * Escolhe UM produto do catálogo e devolve o id — nada mais.
 *
 * É o primo enxuto de SeletorIngrediente. Não reusei aquele por uma razão de
 * permissão, não de código: ele oferece "cadastrar produto novo" ali mesmo, o
 * que é certo na ficha técnica (quem monta ficha é quem conhece o catálogo) e
 * errado no lançamento de perda. O gerente lançando o que jogou fora às onze da
 * noite não deve poder criar cadastro — é assim que catálogo vira colcha de
 * retalhos, e esse projeto já pagou esse preço com "BURRATA"/"Burrata".
 *
 * Busca por `chaveComparacao` (ignora caixa e acento sobrando) e por
 * CONTÉM, não por prefixo: procurar "burrata" tem que achar "QUEIJO BURRATA".
 * É exatamente o que o <select> nativo não faz.
 */
export type ProdutoOpcao = { id: string; nome: string; unidadeMedida: string };

export default function SeletorProduto({
  opcoes,
  selecionado,
  onSelecionar,
  autoFocus,
}: {
  opcoes: ProdutoOpcao[];
  selecionado: ProdutoOpcao | null;
  onSelecionar: (p: ProdutoOpcao) => void;
  autoFocus?: boolean;
}) {
  const [buscando, setBuscando] = useState(selecionado === null);
  const [termo, setTermo] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!buscando) return;
    function aoClicarFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (selecionado) setBuscando(false);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [buscando, selecionado]);

  const filtradas = useMemo(() => {
    const chave = chaveComparacao(termo);
    const achadas = chave ? opcoes.filter((o) => chaveComparacao(o.nome).includes(chave)) : opcoes;
    // Lista longa não trava o render; refinar a busca reduz.
    return achadas.slice(0, 50);
  }, [termo, opcoes]);

  if (!buscando && selecionado) {
    return (
      <div className="combobox" ref={containerRef}>
        <div className="combobox-escolhido">
          <span title={selecionado.nome}>
            {selecionado.nome} · {selecionado.unidadeMedida}
          </span>
          <button
            type="button"
            className="btn small"
            onClick={() => {
              setBuscando(true);
              setTermo("");
            }}
          >
            trocar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="combobox" ref={containerRef}>
      <input
        value={termo}
        autoFocus={autoFocus}
        placeholder="Digite parte do nome"
        onChange={(e) => setTermo(e.target.value)}
        onKeyDown={(e) => {
          // Enter com um resultado só escolhe direto: quem lança perda no fim
          // do expediente digita e sai, não navega com o mouse.
          if (e.key === "Enter") {
            e.preventDefault();
            if (filtradas.length === 1) onSelecionar(filtradas[0]);
          }
          if (e.key === "Escape" && selecionado) setBuscando(false);
        }}
      />
      {(termo || !selecionado) && (
        <div className="combobox-dropdown">
          <ul>
            {filtradas.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className="combobox-item"
                  onClick={() => {
                    onSelecionar(o);
                    setBuscando(false);
                    setTermo("");
                  }}
                >
                  <span>{o.nome}</span>
                  <span className="combobox-unidade">{o.unidadeMedida}</span>
                </button>
              </li>
            ))}
            {filtradas.length === 0 && (
              <li>
                <p className="combobox-vazio">
                  Nenhum produto com esse nome. Produto que falta no catálogo é cadastro, não perda —
                  fale com quem administra.
                </p>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
