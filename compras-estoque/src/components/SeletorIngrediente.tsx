"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { criarProdutoInline } from "@/actions/produtos";
import { chaveComparacao } from "@/lib/nome-normalizado";
import { UNIDADES_MEDIDA } from "@/lib/constants";

// Seletor de ingrediente de ficha técnica: escolhe um Produto (insumo) ou uma
// Receita (sub-receita) e devolve o ID escolhido pra quem chamou.
//
// Existe porque o <input list={datalist}> que ficava aqui antes é
// estruturalmente incapaz de separar "texto que aparece" de "id que é gravado":
// quando o usuário escolhe uma sugestão, o valor do input passa a ser
// exatamente o texto da opção, e era esse texto que a Server Action usava pra
// procurar o ingrediente no banco. Com nomes homônimos no catálogo (produção
// tem "BURRATA" e "Burrata", as duas em KG), essa busca por nome era ambígua e
// gravava o ingrediente errado sem avisar ninguém.
//
// É um combobox escrito na mão (~1 input + 1 lista filtrada) em vez de
// biblioteca porque o projeto não tem nenhuma dependência de UI, e em vez de
// <select> nativo porque a busca nativa só casa prefixo (procurar "burrata" não
// acharia "QUEIJO BURRATA").

export type OpcaoProduto = { id: string; nome: string; unidadeMedida: string };
export type OpcaoSubReceita = { id: string; nome: string; rendimentoUnidade: string | null };

/** O que a linha do formulário guarda depois de uma escolha. */
export type Selecao = { id: string; nome: string; unidadeMedida: string | null };

type Props = {
  tipo: "INSUMO" | "SUBRECEITA";
  opcoesProduto: OpcaoProduto[];
  opcoesSubReceita: OpcaoSubReceita[];
  /** Valor atual da linha (null = linha nova, ainda sem ingrediente escolhido). */
  selecionado: Selecao | null;
  onSelecionar: (selecao: Selecao) => void;
};

export default function SeletorIngrediente({ tipo, opcoesProduto, opcoesSubReceita, selecionado, onSelecionar }: Props) {
  const [buscando, setBuscando] = useState(selecionado === null);
  const [termo, setTermo] = useState("");
  const [criando, setCriando] = useState(false);
  const [nomeNovo, setNomeNovo] = useState("");
  const [unidadeNova, setUnidadeNova] = useState<string>(UNIDADES_MEDIDA[0]);
  const [salvandoProduto, setSalvandoProduto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Clicar fora fecha a busca (só se já existe algo escolhido — numa linha nova
  // fechar deixaria a linha sem como ser preenchida).
  useEffect(() => {
    if (!buscando && !criando) return;
    function aoClicarFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setCriando(false);
        if (selecionado) setBuscando(false);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [buscando, criando, selecionado]);

  const filtradas = useMemo(() => {
    const chave = chaveComparacao(termo);
    const base: Selecao[] =
      tipo === "INSUMO"
        ? opcoesProduto.map((p) => ({ id: p.id, nome: p.nome, unidadeMedida: p.unidadeMedida }))
        : opcoesSubReceita.map((r) => ({ id: r.id, nome: r.nome, unidadeMedida: r.rendimentoUnidade }));
    const encontradas = chave ? base.filter((o) => chaveComparacao(o.nome).includes(chave)) : base;
    return encontradas.slice(0, 50); // lista longa não trava o render; refinar a busca reduz
  }, [termo, tipo, opcoesProduto, opcoesSubReceita]);

  function escolher(opcao: Selecao) {
    onSelecionar(opcao);
    setBuscando(false);
    setCriando(false);
    setTermo("");
    setErro(null);
    setAviso(null);
  }

  async function cadastrarProduto() {
    if (salvandoProduto) return;
    setErro(null);
    setAviso(null);
    setSalvandoProduto(true);
    try {
      const produto = await criarProdutoInline(nomeNovo, unidadeNova);
      if (produto.jaExistia) {
        // Não é erro: o dedupe case-insensitive achou o mesmo produto com outra
        // grafia e reaproveitou, em vez de criar uma duplicata nova. O usuário
        // precisa VER isso (foi a duplicação silenciosa que causou o bug).
        setAviso(`Já existia um produto "${produto.nome}" (${produto.unidadeMedida}) — usamos o cadastro existente em vez de criar outro.`);
      }
      onSelecionar({ id: produto.id, nome: produto.nome, unidadeMedida: produto.unidadeMedida });
      setCriando(false);
      setBuscando(false);
      setTermo("");
      setNomeNovo("");
    } catch (e: any) {
      setErro(e?.message || "Não foi possível cadastrar o produto.");
    } finally {
      setSalvandoProduto(false);
    }
  }

  // Estado "resolvido": mostra o que está escolhido + botão pra trocar. Fica
  // visualmente claro que a linha aponta pra um cadastro específico, não pra um
  // texto digitado.
  if (!buscando && selecionado) {
    return (
      <div className="combobox" ref={containerRef}>
        <div className="combobox-escolhido">
          <span title={selecionado.nome}>{selecionado.nome}</span>
          <button
            type="button"
            className="btn small"
            onClick={() => {
              setBuscando(true);
              setTermo("");
            }}
          >
            Trocar
          </button>
        </div>
        {aviso && <p className="combobox-aviso">{aviso}</p>}
      </div>
    );
  }

  return (
    <div className="combobox" ref={containerRef}>
      <input
        autoFocus={selecionado !== null}
        value={termo}
        placeholder={tipo === "INSUMO" ? "Buscar insumo cadastrado..." : "Buscar sub-receita desta unidade..."}
        onChange={(e) => setTermo(e.target.value)}
        style={{ width: "100%" }}
      />

      {criando ? (
        <div className="combobox-dropdown combobox-criar">
          <p className="combobox-titulo">Cadastrar novo produto</p>
          <input value={nomeNovo} placeholder="Nome do produto" onChange={(e) => setNomeNovo(e.target.value)} />
          <select value={unidadeNova} onChange={(e) => setUnidadeNova(e.target.value)}>
            {UNIDADES_MEDIDA.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className="btn small primary" disabled={salvandoProduto} onClick={cadastrarProduto}>
              {salvandoProduto ? "Cadastrando..." : "Cadastrar e usar"}
            </button>
            <button type="button" className="btn small" onClick={() => setCriando(false)}>
              Cancelar
            </button>
          </div>
          {erro && <p className="combobox-erro">{erro}</p>}
        </div>
      ) : (
        <div className="combobox-dropdown">
          {filtradas.length === 0 && <p className="combobox-vazio">Nenhum resultado para "{termo}".</p>}
          <ul role="listbox">
            {filtradas.map((o) => (
              <li key={o.id}>
                <button type="button" className="combobox-item" onClick={() => escolher(o)}>
                  <span>{o.nome}</span>
                  {o.unidadeMedida && <span className="combobox-unidade">{o.unidadeMedida}</span>}
                </button>
              </li>
            ))}
          </ul>
          {tipo === "INSUMO" ? (
            <button
              type="button"
              className="combobox-novo"
              onClick={() => {
                setNomeNovo(termo);
                setCriando(true);
              }}
            >
              + Cadastrar novo produto
            </button>
          ) : (
            <p className="combobox-vazio">
              Sub-receita precisa existir antes — cadastre em Sub-receitas e volte aqui.
            </p>
          )}
          {selecionado && (
            <button type="button" className="combobox-novo" onClick={() => setBuscando(false)}>
              Cancelar (manter "{selecionado.nome}")
            </button>
          )}
        </div>
      )}
    </div>
  );
}
