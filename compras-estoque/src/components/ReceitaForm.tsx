"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { salvarSubReceita } from "@/actions/receitas";

type IngredienteExistente = {
  tipo: "INSUMO" | "SUBRECEITA";
  nome: string;
  unidadeMedida: string;
  quantidade: number;
};

type Linha = { tipo: "INSUMO" | "SUBRECEITA"; nome: string; unidadeMedida: string; quantidade: string };

export default function ReceitaForm({
  receitaId,
  unidadeId,
  nomeInicial,
  modoPreparoInicial,
  rendimentoQtdInicial,
  rendimentoUnidadeInicial,
  ingredientesIniciais,
  nomesInsumos,
  nomesSubReceitas,
}: {
  receitaId: string | null;
  unidadeId: string;
  nomeInicial: string;
  modoPreparoInicial: string;
  rendimentoQtdInicial: number | null;
  rendimentoUnidadeInicial: string;
  ingredientesIniciais: IngredienteExistente[];
  nomesInsumos: string[];
  nomesSubReceitas: string[];
}) {
  const router = useRouter();
  const [nome, setNome] = useState(nomeInicial);
  const [modoPreparo, setModoPreparo] = useState(modoPreparoInicial);
  const [rendimentoQtd, setRendimentoQtd] = useState(rendimentoQtdInicial ? String(rendimentoQtdInicial) : "");
  const [rendimentoUnidade, setRendimentoUnidade] = useState(rendimentoUnidadeInicial);
  const [linhas, setLinhas] = useState<Linha[]>(
    ingredientesIniciais.length
      ? ingredientesIniciais.map((i) => ({ tipo: i.tipo, nome: i.nome, unidadeMedida: i.unidadeMedida, quantidade: String(i.quantidade) }))
      : [{ tipo: "INSUMO", nome: "", unidadeMedida: "", quantidade: "" }]
  );
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function atualizarLinha(idx: number, campo: keyof Linha, valor: string) {
    setLinhas((prev) => prev.map((l, i) => (i === idx ? { ...l, [campo]: valor } : l)));
  }
  function adicionarLinha() {
    setLinhas((prev) => [...prev, { tipo: "INSUMO", nome: "", unidadeMedida: "", quantidade: "" }]);
  }
  function removerLinha(idx: number) {
    setLinhas((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(formData: FormData) {
    setErro(null);
    if (salvando) return;
    const ingredientesValidos = linhas
      .filter((l) => l.nome.trim() && Number(l.quantidade) > 0)
      .map((l) => ({ tipo: l.tipo, nome: l.nome.trim(), unidadeMedida: l.unidadeMedida.trim() || "UN", quantidade: Number(l.quantidade) }));
    formData.set("ingredientes", JSON.stringify(ingredientesValidos));
    formData.set("unidadeId", unidadeId);
    setSalvando(true);
    try {
      await salvarSubReceita(receitaId, formData);
      router.push(`/receitas?unidade=${unidadeId}`);
    } catch (e: any) {
      setSalvando(false);
      setErro(e?.message || "Não foi possível salvar a sub-receita.");
    }
  }

  return (
    <form action={handleSubmit}>
      <datalist id="lista-insumos">
        {nomesInsumos.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <datalist id="lista-subreceitas">
        {nomesSubReceitas.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <div className="field-row">
        <div className="field-group">
          <label htmlFor="nome">Nome</label>
          <input id="nome" name="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
        </div>
      </div>

      <table style={{ marginBottom: 12 }}>
        <thead>
          <tr>
            <th style={{ width: 110 }}>Tipo</th>
            <th>Ingrediente</th>
            <th className="num" style={{ width: 90 }}>
              Unid.
            </th>
            <th className="num" style={{ width: 100 }}>
              Qtd.
            </th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, idx) => (
            <tr key={idx}>
              <td>
                <select value={linha.tipo} onChange={(e) => atualizarLinha(idx, "tipo", e.target.value)}>
                  <option value="INSUMO">Insumo</option>
                  <option value="SUBRECEITA">Sub-receita</option>
                </select>
              </td>
              <td>
                <input
                  list={linha.tipo === "INSUMO" ? "lista-insumos" : "lista-subreceitas"}
                  value={linha.nome}
                  placeholder={linha.tipo === "INSUMO" ? "Nome do insumo" : "Nome da sub-receita (já cadastrada)"}
                  onChange={(e) => atualizarLinha(idx, "nome", e.target.value)}
                  style={{ width: "100%" }}
                />
              </td>
              <td className="num">
                <input
                  style={{ width: 70 }}
                  value={linha.unidadeMedida}
                  placeholder="KG"
                  onChange={(e) => atualizarLinha(idx, "unidadeMedida", e.target.value)}
                />
              </td>
              <td className="num">
                <input
                  type="number"
                  step="any"
                  min="0"
                  style={{ width: 90, textAlign: "right" }}
                  value={linha.quantidade}
                  onChange={(e) => atualizarLinha(idx, "quantidade", e.target.value)}
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
        + Adicionar ingrediente
      </button>

      <div className="field-row">
        <div className="field-group">
          <label htmlFor="rendimentoQtd">Rendimento do lote (opcional)</label>
          <input
            id="rendimentoQtd"
            name="rendimentoQtd"
            type="number"
            step="any"
            min="0"
            placeholder="Ex: 1"
            value={rendimentoQtd}
            onChange={(e) => setRendimentoQtd(e.target.value)}
          />
        </div>
        <div className="field-group">
          <label htmlFor="rendimentoUnidade">Unidade do rendimento</label>
          <input
            id="rendimentoUnidade"
            name="rendimentoUnidade"
            placeholder="Ex: KG"
            value={rendimentoUnidade}
            onChange={(e) => setRendimentoUnidade(e.target.value)}
          />
        </div>
      </div>
      <p className="sub" style={{ marginTop: -8, marginBottom: 18 }}>
        Ex.: "essa manteiga temperada rende 0,5kg" — deixa quem for usar essa sub-receita em outra
        ficha saber quanto do lote está usando (não precisa preencher se não souber ainda).
      </p>

      <div className="field-group" style={{ marginBottom: 18 }}>
        <label htmlFor="modoPreparo">Modo de preparo (opcional)</label>
        <textarea id="modoPreparo" name="modoPreparo" rows={4} value={modoPreparo} onChange={(e) => setModoPreparo(e.target.value)} />
      </div>

      {erro && <p className="error-msg">{erro}</p>}

      <button className="btn primary" type="submit" disabled={salvando}>
        {salvando ? "Salvando..." : "Salvar sub-receita"}
      </button>
    </form>
  );
}
