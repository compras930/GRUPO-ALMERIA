"use client";

import { useState } from "react";
import { criarItemVenda } from "@/actions/cmv";

/**
 * "Novo item" da tela de CMV — o prato que entrou no cardápio.
 *
 * Client component pelo mesmo motivo de ProdutoForm: a recusa precisa ser
 * LIDA. As duas recusas comuns aqui são instruções, não erros — "já existe
 * nessa categoria, edite em vez de criar" e "existe fora do cardápio, use
 * Voltar ao cardápio pra não perder o histórico". Num `<form action={...}>`
 * de server component, as duas viravam a tela genérica do Next.
 *
 * Nasce fechado: a tela de CMV é uma lista de consulta na maior parte dos
 * dias, e um formulário aberto no topo empurra a tabela pra baixo à toa.
 */
export default function NovoItemVenda({
  unidadeId,
  unidadeNome,
  tipo,
  tipoLabel,
  categorias,
}: {
  unidadeId: string;
  unidadeNome: string;
  tipo: string;
  tipoLabel: string;
  categorias: string[];
}) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(formData: FormData) {
    if (salvando) return;
    setErro(null);
    setSalvo(null);
    setSalvando(true);
    try {
      const nome = String(formData.get("nome") || "").trim();
      await criarItemVenda(formData);
      setSalvo(`"${nome}" entrou no cardápio. Abra o item para montar a ficha técnica.`);
    } catch (e: any) {
      setErro(e?.message || "Não foi possível cadastrar o item.");
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return (
      <div className="barra-acao">
        <button className="btn primary" type="button" onClick={() => setAberto(true)}>
          + Novo {tipoLabel.toLowerCase().replace(/s$/, "")}
        </button>
        {salvo && <span className="ok-msg">{salvo}</span>}
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 15, marginBottom: 14 }}>
        Novo item em {unidadeNome} · {tipoLabel}
      </h2>

      <form action={handleSubmit}>
        <input type="hidden" name="unidadeId" value={unidadeId} />
        <input type="hidden" name="tipo" value={tipo} />

        <div className="field-row">
          <div className="field-group" style={{ minWidth: 260 }}>
            <label htmlFor="novo-nome">Nome</label>
            <input id="novo-nome" name="nome" required autoFocus placeholder="Como aparece no cardápio" />
          </div>
          <div className="field-group">
            <label htmlFor="novo-categoria">Categoria</label>
            <input
              id="novo-categoria"
              name="categoria"
              list="categorias-conhecidas"
              placeholder="Ex: Entradas, Principais"
            />
            <datalist id="categorias-conhecidas">
              {categorias.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="field-group" style={{ maxWidth: 150 }}>
            <label htmlFor="novo-preco">Preço de venda</label>
            <input id="novo-preco" name="precoVenda" required inputMode="decimal" placeholder="0,00" />
          </div>
          <div className="field-group" style={{ maxWidth: 170 }}>
            <label htmlFor="novo-codigo">Código no PDV</label>
            <input id="novo-codigo" name="codigoPdv" placeholder="opcional" />
          </div>
        </div>

        <p className="sub-explica" style={{ marginTop: 2 }}>
          O código do PDV é o que liga este item à venda semanal — sem ele, o casamento é por nome, e
          nome muda quando alguém renomeia o prato. Pode entrar depois.
        </p>

        {erro && <p className="error-msg">{erro}</p>}
        {salvo && <p className="ok-msg">{salvo}</p>}

        <div className="barra-acao" style={{ marginTop: 14 }}>
          <button className="btn primary" type="submit" disabled={salvando}>
            {salvando ? "Adicionando..." : "Adicionar ao cardápio"}
          </button>
          <button
            className="btn small"
            type="button"
            onClick={() => {
              setAberto(false);
              setErro(null);
            }}
          >
            Fechar
          </button>
        </div>
      </form>
    </div>
  );
}
