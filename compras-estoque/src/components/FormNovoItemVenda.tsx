"use client";

import { useState } from "react";
import { criarItemVenda } from "@/actions/cmv";
import { TIPO_ITEM_VENDA, TIPO_ITEM_VENDA_LABEL } from "@/lib/constants";

/**
 * Formulário de /cmv/novo.
 *
 * Client component pela recusa: as mensagens de `criarItemVenda` são
 * instruções — "já existe nessa categoria, edite em vez de criar", "existe
 * fora do cardápio, use Voltar ao cardápio pra não perder o histórico", "esse
 * código de PDV já é de outro item". Num `<form action={criarItemVenda}>` de
 * server component, as três viravam a tela genérica do Next, e quem tentou
 * cadastrar ficava sem saber o que fazer.
 *
 * O detalhe que não é óbvio: `criarItemVenda` termina em `redirect()`, e
 * `redirect` funciona LANÇANDO um erro especial (digest NEXT_REDIRECT). Um
 * try/catch em volta engoliria o sucesso e mostraria "Não foi possível" logo
 * depois de gravar. Por isso o catch relança o que for redirect e só trata o
 * resto.
 */
export default function FormNovoItemVenda({
  unidades,
  unidadeInicial,
  tipoInicial,
  categorias,
}: {
  unidades: { id: string; nome: string }[];
  unidadeInicial: string;
  tipoInicial: string;
  categorias: string[];
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(formData: FormData) {
    if (salvando) return;
    setErro(null);
    setSalvando(true);
    try {
      await criarItemVenda(formData);
    } catch (e: any) {
      // Sucesso disfarçado de erro: deixa subir pra navegação acontecer.
      if (typeof e?.digest === "string" && e.digest.startsWith("NEXT_REDIRECT")) throw e;
      setErro(e?.message || "Não foi possível cadastrar o item.");
      setSalvando(false);
    }
  }

  return (
    <form action={handleSubmit}>
      <div className="field-row">
        <div className="field-group">
          <label htmlFor="unidadeId">Casa</label>
          <select id="unidadeId" name="unidadeId" defaultValue={unidadeInicial} required>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="field-group">
          <label htmlFor="tipo">Tipo</label>
          <select id="tipo" name="tipo" defaultValue={tipoInicial} required>
            {TIPO_ITEM_VENDA.map((t) => (
              <option key={t} value={t}>
                {TIPO_ITEM_VENDA_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field-row">
        <div className="field-group" style={{ minWidth: 280 }}>
          <label htmlFor="nome">Nome</label>
          <input id="nome" name="nome" required autoFocus placeholder="Como aparece no cardápio" />
        </div>
        <div className="field-group">
          <label htmlFor="categoria">Categoria</label>
          <input
            id="categoria"
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
      </div>

      <div className="field-row">
        <div className="field-group" style={{ maxWidth: 190 }}>
          <label htmlFor="precoVenda">Preço de venda (R$)</label>
          {/* Texto, não `type=number`: o teclado brasileiro manda vírgula, e a
              action já converte. Com type=number, "84,50" some do campo em
              alguns navegadores em vez de virar 84.50. */}
          <input id="precoVenda" name="precoVenda" required inputMode="decimal" placeholder="0,00" />
        </div>
        <div className="field-group" style={{ maxWidth: 200 }}>
          <label htmlFor="codigoPdv">Código no PDV</label>
          <input id="codigoPdv" name="codigoPdv" placeholder="opcional" />
        </div>
      </div>

      <p className="sub-explica">
        O código do PDV é o que liga este item à venda semanal — sem ele, o casamento é por nome, e nome
        muda quando alguém renomeia o prato. Pode entrar depois.
      </p>

      {erro && <p className="error-msg">{erro}</p>}

      <div className="barra-acao" style={{ marginTop: 16, marginBottom: 0 }}>
        <button className="btn primary" type="submit" disabled={salvando}>
          {salvando ? "Criando..." : "Criar e preencher ficha"}
        </button>
      </div>
    </form>
  );
}
