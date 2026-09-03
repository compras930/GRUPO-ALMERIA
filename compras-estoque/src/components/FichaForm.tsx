"use client";

import { useState } from "react";
import { salvarFicha } from "@/actions/cmv";
import SeletorIngrediente, { type OpcaoProduto, type OpcaoSubReceita, type Selecao } from "./SeletorIngrediente";

type IngredienteExistente = {
  tipo: "INSUMO" | "SUBRECEITA";
  produtoId: string | null;
  subReceitaId: string | null;
  nome: string;
  unidadeMedida: string;
  quantidade: number;
};

// Cada linha guarda o ID do ingrediente escolhido (não o nome digitado): é isso
// que a Server Action usa pra gravar. `nomeExibicao` é só pra desenhar a linha.
// `ingredienteId` null = linha nova, ainda sem ingrediente escolhido.
type Linha = {
  tipo: "INSUMO" | "SUBRECEITA";
  ingredienteId: string | null;
  nomeExibicao: string;
  unidadeMedida: string;
  quantidade: string;
};

export default function FichaForm({
  itemVendaId,
  nomeInicial,
  categoriaInicial,
  precoVendaInicial,
  modoPreparoInicial,
  rendimentoQtdInicial,
  rendimentoUnidadeInicial,
  ingredientesIniciais,
  opcoesProduto,
  opcoesSubReceita,
  categoriasConhecidas,
}: {
  itemVendaId: string;
  nomeInicial: string;
  categoriaInicial: string;
  precoVendaInicial: number;
  modoPreparoInicial: string;
  rendimentoQtdInicial: number | null;
  rendimentoUnidadeInicial: string;
  ingredientesIniciais: IngredienteExistente[];
  opcoesProduto: OpcaoProduto[];
  opcoesSubReceita: OpcaoSubReceita[];
  categoriasConhecidas: string[];
}) {
  const [nome, setNome] = useState(nomeInicial);
  const [categoria, setCategoria] = useState(categoriaInicial);
  const [precoVenda, setPrecoVenda] = useState(String(precoVendaInicial || ""));
  const [modoPreparo, setModoPreparo] = useState(modoPreparoInicial);
  const [rendimentoQtd, setRendimentoQtd] = useState(rendimentoQtdInicial ? String(rendimentoQtdInicial) : "");
  const [rendimentoUnidade, setRendimentoUnidade] = useState(rendimentoUnidadeInicial);
  const [linhas, setLinhas] = useState<Linha[]>(
    ingredientesIniciais.length ? ingredientesIniciais.map(linhaDeExistente) : [linhaVazia()]
  );
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  function atualizarLinha(idx: number, patch: Partial<Linha>) {
    setLinhas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
    setSalvo(false);
  }
  function trocarTipo(idx: number, tipo: "INSUMO" | "SUBRECEITA") {
    // Id de produto não vale como id de receita (e vice-versa): trocar o tipo
    // zera a escolha, em vez de manter um id que resolveria pra nada.
    atualizarLinha(idx, { tipo, ingredienteId: null, nomeExibicao: "", unidadeMedida: "" });
  }
  function selecionarIngrediente(idx: number, selecao: Selecao) {
    // A unidade vem do próprio cadastro escolhido (produto, ou rendimento da
    // sub-receita) — nunca é digitada. O custo é calculado como quantidade x
    // preço-por-unidade-do-produto, sem conversão nenhuma, então unidade
    // divergente aqui daria custo errado por ordem de grandeza.
    atualizarLinha(idx, {
      ingredienteId: selecao.id,
      nomeExibicao: selecao.nome,
      unidadeMedida: selecao.unidadeMedida ?? "",
    });
  }
  function adicionarLinha() {
    setLinhas((prev) => [...prev, linhaVazia()]);
    setSalvo(false);
  }
  function removerLinha(idx: number) {
    setLinhas((prev) => prev.filter((_, i) => i !== idx));
    setSalvo(false);
  }

  async function handleSubmit(formData: FormData) {
    setErro(null);
    setSalvo(false);
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

    setSalvando(true);
    try {
      await salvarFicha(itemVendaId, formData);
      setSalvo(true);
    } catch (e: any) {
      setErro(e?.message || "Não foi possível salvar a ficha.");
    } finally {
      // Esta tela não navega pra outro lugar depois de salvar, então o botão
      // precisa voltar do estado "Salvando..." aqui — sem isso ele ficava
      // travado pra sempre depois de um salvamento bem-sucedido.
      setSalvando(false);
    }
  }

  return (
    <form action={handleSubmit}>
      <datalist id="lista-categorias">
        {categoriasConhecidas.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <div className="field-row">
        <div className="field-group">
          <label htmlFor="nome">Nome</label>
          <input id="nome" name="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
        </div>
        <div className="field-group">
          <label htmlFor="categoria">Categoria</label>
          <input
            id="categoria"
            name="categoria"
            list="lista-categorias"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          />
        </div>
        <div className="field-group">
          <label htmlFor="precoVenda">Preço de venda (R$)</label>
          <input
            id="precoVenda"
            name="precoVenda"
            type="number"
            step="any"
            min="0"
            value={precoVenda}
            onChange={(e) => setPrecoVenda(e.target.value)}
          />
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
                {/* Insumo: unidade travada na do produto. Sub-receita sem
                    rendimento definido não tem unidade canônica — aí sim é
                    digitada (limitação de quem não preencheu o rendimento). */}
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
          <label htmlFor="rendimentoQtd">Rendimento da receita (opcional)</label>
          <input
            id="rendimentoQtd"
            name="rendimentoQtd"
            type="number"
            step="any"
            min="0"
            placeholder="Ex: 0.5"
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
        Só preencha se essa ficha é uma sub-receita que rende um lote (ex.: "essa manteiga
        temperada rende 0,5kg"). Deixe em branco pra fichas de prato/bebida/vinho vendidas direto.
      </p>

      <div className="field-group" style={{ marginBottom: 18 }}>
        <label htmlFor="modoPreparo">Modo de preparo (opcional)</label>
        <textarea
          id="modoPreparo"
          name="modoPreparo"
          rows={4}
          value={modoPreparo}
          onChange={(e) => setModoPreparo(e.target.value)}
        />
      </div>

      {erro && <p className="error-msg">{erro}</p>}
      {salvo && <p className="sub" style={{ color: "var(--ok)" }}>Ficha salva.</p>}

      <button className="btn primary" type="submit" disabled={salvando}>
        {salvando ? "Salvando..." : "Salvar ficha"}
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
