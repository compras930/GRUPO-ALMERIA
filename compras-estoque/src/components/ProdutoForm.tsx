"use client";

import { useState } from "react";
import { criarProduto } from "@/actions/produtos";
import { UNIDADES_MEDIDA } from "@/lib/constants";

/**
 * Formulário de novo produto da tela /produtos.
 *
 * Existe como client component só por causa da mensagem de erro: com
 * `<form action={criarProduto}>` direto num server component, um throw da action
 * virava a tela de erro genérica do Next ("Application error"), sem dizer o
 * motivo. E motivo agora é comum: tentar cadastrar uma grafia de um produto que
 * já existe é barrado de propósito (é o que gerou "BURRATA" e "Burrata"
 * conviverem em produção), e a pessoa precisa LER isso pra saber que deve usar o
 * cadastro existente. Mesmo padrão de erro visível que FichaForm/ReceitaForm.
 */
export default function ProdutoForm() {
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(formData: FormData) {
    if (salvando) return;
    setErro(null);
    setSalvo(false);
    setSalvando(true);
    try {
      await criarProduto(formData);
      setSalvo(true);
    } catch (e: any) {
      setErro(e?.message || "Não foi possível cadastrar o produto.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form action={handleSubmit}>
      <div className="field-row">
        <div className="field-group">
          <label htmlFor="nome">Nome</label>
          <input id="nome" name="nome" required />
        </div>
        <div className="field-group">
          <label htmlFor="categoria">Categoria</label>
          <input id="categoria" name="categoria" placeholder="Ex: Carnes, Hortifruti, Bebidas" />
        </div>
        <div className="field-group">
          <label htmlFor="unidadeMedida">Unidade de medida</label>
          <select id="unidadeMedida" name="unidadeMedida" required defaultValue="">
            <option value="" disabled>
              Selecione
            </option>
            {UNIDADES_MEDIDA.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      {erro && <p className="error-msg">{erro}</p>}
      {salvo && <p className="sub" style={{ color: "var(--ok)" }}>Produto cadastrado.</p>}

      <button className="btn primary" type="submit" disabled={salvando}>
        {salvando ? "Cadastrando..." : "Adicionar"}
      </button>
    </form>
  );
}
