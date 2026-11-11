"use client";

import { useMemo, useState } from "react";
import { definirFornecedorDoItem } from "@/actions/separacao";
import { mensagemDoFornecedorPura, SEM_FORNECEDOR } from "@/lib/pedido-por-fornecedor";

type Item = {
  id: string;
  nome: string;
  unidade: string;
  quantidade: number;
  fornecedorId: string | null;
  casa: string;
  casaFiscal: string;
  casaCnpj: string | null;
  pedidoNumero: number;
  tipo: string;
};

/**
 * A separação por fornecedor e a mensagem pronta.
 *
 * O FORNECEDOR SALVA NA HORA, sem botão de salvar: cada troca é uma decisão
 * independente, e um botão no fim de trezentas linhas significaria perder tudo
 * ao fechar a aba sem querer. A tela também guarda a escolha como padrão do
 * item para a semana seguinte.
 *
 * A MENSAGEM É GERADA NO NAVEGADOR, a partir do que está na tela. Assim ela
 * acompanha a troca de fornecedor na hora, sem recarregar — e o que você copia
 * é exatamente o que está vendo.
 */
export default function SepararPedidosForm({
  itens,
  fornecedores,
  saudacao,
}: {
  itens: Item[];
  fornecedores: { id: string; nome: string }[];
  saudacao: string;
}) {
  const [escolha, setEscolha] = useState<Record<string, string>>(
    Object.fromEntries(itens.map((i) => [i.id, i.fornecedorId ?? ""]))
  );
  const [salvando, setSalvando] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const nomeDoFornecedor = useMemo(
    () => new Map(fornecedores.map((f) => [f.id, f.nome])),
    [fornecedores]
  );

  // Agrupa por fornecedor e, dentro dele, por casa: é o desenho da mensagem.
  const grupos = useMemo(() => {
    const porFornecedor = new Map<string, Map<string, Item[]>>();
    for (const i of itens) {
      const f = nomeDoFornecedor.get(escolha[i.id]) ?? SEM_FORNECEDOR;
      if (!porFornecedor.has(f)) porFornecedor.set(f, new Map());
      const porCasa = porFornecedor.get(f)!;
      if (!porCasa.has(i.casa)) porCasa.set(i.casa, []);
      porCasa.get(i.casa)!.push(i);
    }
    return [...porFornecedor]
      .map(([fornecedor, porCasa]) => ({
        fornecedor,
        casas: [...porCasa].map(([casa, itens]) => ({
          casa,
          fiscal: itens[0].casaFiscal,
          cnpj: itens[0].casaCnpj,
          itens: [...itens].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
        })),
        total: [...porCasa.values()].reduce((s, v) => s + v.length, 0),
      }))
      .sort((a, b) => {
        if (a.fornecedor === SEM_FORNECEDOR) return -1; // primeiro: é o que falta decidir
        if (b.fornecedor === SEM_FORNECEDOR) return 1;
        return a.fornecedor.localeCompare(b.fornecedor, "pt-BR");
      });
  }, [itens, escolha, nomeDoFornecedor]);

  async function trocar(itemId: string, valor: string) {
    setEscolha((p) => ({ ...p, [itemId]: valor }));
    setSalvando(itemId);
    try {
      await definirFornecedorDoItem(itemId, valor || null);
    } finally {
      setSalvando(null);
    }
  }

  async function copiar(texto: string, fornecedor: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(fornecedor);
      setTimeout(() => setCopiado(null), 2500);
    } catch {
      // Clipboard bloqueado (http, permissão): o texto está na tela, dá para
      // selecionar à mão. Melhor isso que um erro que não ajuda em nada.
      setCopiado("falhou");
    }
  }

  return (
    <div>
      {grupos.map((g) => {
        const texto = mensagemDoFornecedorPura({
          fornecedor: g.fornecedor,
          saudacao,
          casas: g.casas.map((c) => ({
            nome: c.fiscal,
            cnpj: c.cnpj,
            itens: c.itens.map((i) => ({ quantidade: i.quantidade, unidade: i.unidade, nome: i.nome })),
          })),
        });
        const aDefinir = g.fornecedor === SEM_FORNECEDOR;
        return (
          <div className="card" key={g.fornecedor}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: 15, margin: 0 }}>{g.fornecedor}</h2>
              <span className="cat">
                {g.total} {g.total === 1 ? "item" : "itens"} · {g.casas.length}{" "}
                {g.casas.length === 1 ? "casa" : "casas"}
              </span>
              <span style={{ flex: 1 }} />
              {!aDefinir && (
                <button type="button" className="btn small" onClick={() => copiar(texto, g.fornecedor)}>
                  {copiado === g.fornecedor ? "Copiado!" : "Copiar mensagem"}
                </button>
              )}
            </div>

            {aDefinir && (
              <p className="hint" style={{ marginTop: 6 }}>
                <strong>Decida estes primeiro.</strong> Enquanto estiverem aqui, não há para quem
                mandar — e eles somem da conta sem ninguém perceber.
              </p>
            )}

            <table style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th style={{ width: 60 }}>Un.</th>
                  <th className="num" style={{ width: 70 }}>Qtd.</th>
                  <th style={{ width: 150 }}>Casa</th>
                  <th style={{ width: 220 }}>Fornecedor</th>
                </tr>
              </thead>
              <tbody>
                {g.casas.flatMap((c) =>
                  c.itens.map((i) => (
                    <tr key={i.id}>
                      <td>{i.nome}</td>
                      <td className="cat">{i.unidade}</td>
                      <td className="num">{i.quantidade}</td>
                      <td className="cat">
                        {c.casa}
                        {i.tipo === "EXTRA" ? <span className="tag warn"> extra</span> : null}
                      </td>
                      <td>
                        <select
                          value={escolha[i.id] ?? ""}
                          disabled={salvando === i.id}
                          onChange={(e) => trocar(i.id, e.target.value)}
                          style={{ width: "100%" }}
                        >
                          <option value="">— a definir —</option>
                          {fornecedores.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.nome}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {!aDefinir && (
              <details style={{ marginTop: 12 }}>
                <summary className="cat" style={{ cursor: "pointer" }}>
                  Ver a mensagem
                </summary>
                <pre className="mensagem-fornecedor">{texto}</pre>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}
