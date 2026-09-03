"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { salvarSubReceita } from "@/actions/receitas";
import SeletorIngrediente, { type OpcaoProduto, type OpcaoSubReceita, type Selecao } from "./SeletorIngrediente";

type IngredienteExistente = {
  tipo: "INSUMO" | "SUBRECEITA";
  produtoId: string | null;
  subReceitaId: string | null;
  nome: string;
  unidadeMedida: string;
  quantidade: number;
};

// Mesma convenção do FichaForm: a linha guarda o ID do ingrediente escolhido,
// nunca o nome digitado (nome digitado era ambíguo no catálogo de produção).
type Linha = {
  tipo: "INSUMO" | "SUBRECEITA";
  ingredienteId: string | null;
  nomeExibicao: string;
  unidadeMedida: string;
  quantidade: string;
};

export default function ReceitaForm({
  receitaId,
  unidadeId,
  nomeInicial,
  modoPreparoInicial,
  rendimentoQtdInicial,
  rendimentoUnidadeInicial,
  ingredientesIniciais,
  opcoesProduto,
  opcoesSubReceita,
}: {
  receitaId: string | null;
  unidadeId: string;
  nomeInicial: string;
  modoPreparoInicial: string;
  rendimentoQtdInicial: number | null;
  rendimentoUnidadeInicial: string;
  ingredientesIniciais: IngredienteExistente[];
  opcoesProduto: OpcaoProduto[];
  opcoesSubReceita: OpcaoSubReceita[];
}) {
  const router = useRouter();
  const [nome, setNome] = useState(nomeInicial);
  const [modoPreparo, setModoPreparo] = useState(modoPreparoInicial);
  const [rendimentoQtd, setRendimentoQtd] = useState(rendimentoQtdInicial ? String(rendimentoQtdInicial) : "");
  const [rendimentoUnidade, setRendimentoUnidade] = useState(rendimentoUnidadeInicial);
  const [linhas, setLinhas] = useState<Linha[]>(
    ingredientesIniciais.length ? ingredientesIniciais.map(linhaDeExistente) : [linhaVazia()]
  );
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function atualizarLinha(idx: number, patch: Partial<Linha>) {
    setLinhas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function trocarTipo(idx: number, tipo: "INSUMO" | "SUBRECEITA") {
    atualizarLinha(idx, { tipo, ingredienteId: null, nomeExibicao: "", unidadeMedida: "" });
  }
  function selecionarIngrediente(idx: number, selecao: Selecao) {
    atualizarLinha(idx, {
      ingredienteId: selecao.id,
      nomeExibicao: selecao.nome,
      unidadeMedida: selecao.unidadeMedida ?? "",
    });
  }
  function adicionarLinha() {
    setLinhas((prev) => [...prev, linhaVazia()]);
  }
  function removerLinha(idx: number) {
    setLinhas((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(formData: FormData) {
    setErro(null);
    if (salvando) return;

    const semIngrediente = linhas.filter((l) => !l.ingredienteId && Number(l.quantidade) > 0).length;
    if (semIngrediente) {
      setErro(
        `${semIngrediente} linha(s) têm quantidade mas nenhum ingrediente escolhido — escolha o ingrediente ou remova a linha.`
      );
      return;
    }
    const ingredientes = linhas
      .filter((l) => l.ingredienteId && Number(l.quantidade) > 0)
      .map((l) =>
        l.tipo === "INSUMO"
          ? { tipo: "INSUMO" as const, produtoId: l.ingredienteId!, unidadeMedida: l.unidadeMedida, quantidade: Number(l.quantidade) }
          : { tipo: "SUBRECEITA" as const, subReceitaId: l.ingredienteId!, unidadeMedida: l.unidadeMedida, quantidade: Number(l.quantidade) }
      );
    formData.set("ingredientes", JSON.stringify(ingredientes));
    formData.set("unidadeId", unidadeId);

    setSalvando(true);
    try {
      await salvarSubReceita(receitaId, formData);
      router.push(`/receitas?unidade=${unidadeId}`);
    } catch (e: any) {
      setErro(e?.message || "Não foi possível salvar a sub-receita.");
    } finally {
      // No caminho de sucesso o router.push desmonta este componente logo em
      // seguida; o reset aqui cobre o caso do push demorar/falhar, pra o botão
      // nunca ficar preso em "Salvando...".
      setSalvando(false);
    }
  }

  return (
    <form action={handleSubmit}>
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
                <select
                  value={linha.tipo}
                  onChange={(e) => trocarTipo(idx, e.target.value as "INSUMO" | "SUBRECEITA")}
                >
                  <option value="INSUMO">Insumo</option>
                  <option value="SUBRECEITA">Sub-receita</option>
                </select>
              </td>
              <td>
                <SeletorIngrediente
                  tipo={linha.tipo}
                  opcoesProduto={opcoesProduto}
                  opcoesSubReceita={opcoesSubReceita}
                  selecionado={
                    linha.ingredienteId
                      ? { id: linha.ingredienteId, nome: linha.nomeExibicao, unidadeMedida: linha.unidadeMedida || null }
                      : null
                  }
                  onSelecionar={(selecao) => selecionarIngrediente(idx, selecao)}
                />
              </td>
              <td className="num">
                {linha.tipo === "INSUMO" || linha.unidadeMedida ? (
                  <span className="combobox-unidade">{linha.unidadeMedida || "—"}</span>
                ) : (
                  <input
                    style={{ width: 70 }}
                    value={linha.unidadeMedida}
                    placeholder="KG"
                    onChange={(e) => atualizarLinha(idx, { unidadeMedida: e.target.value.toUpperCase() })}
                  />
                )}
              </td>
              <td className="num">
                <input
                  type="number"
                  step="any"
                  min="0"
                  style={{ width: 90, textAlign: "right" }}
                  value={linha.quantidade}
                  onChange={(e) => atualizarLinha(idx, { quantidade: e.target.value })}
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
        ficha saber quanto do lote está usando. Quando preenchido, a unidade do rendimento passa a
        ser a unidade exigida de quem usar essa sub-receita como ingrediente.
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

function linhaVazia(): Linha {
  return { tipo: "INSUMO", ingredienteId: null, nomeExibicao: "", unidadeMedida: "", quantidade: "" };
}

function linhaDeExistente(i: IngredienteExistente): Linha {
  return {
    tipo: i.tipo,
    ingredienteId: i.produtoId ?? i.subReceitaId,
    nomeExibicao: i.nome,
    unidadeMedida: i.unidadeMedida,
    quantidade: String(i.quantidade),
  };
}
