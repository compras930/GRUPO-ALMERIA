"use client";

import { useMemo, useState } from "react";

/**
 * Tabela ordenável por qualquer coluna — clique no cabeçalho.
 *
 * ORDENAR É LER. A tela abre na ordem que importa (maior falta primeiro), mas
 * as perguntas seguintes são outras: "quem comprou mais nesta janela?", "o que
 * sobrou?". Sem ordenação, cada uma delas vira exportar para planilha, e a
 * conferência passa a acontecer fora do app, sem as marcas de sem-ficha.
 *
 * SÓ DADOS, NUNCA FUNÇÕES. Este é um componente de cliente, e função passada
 * de um componente de servidor para um de cliente é recusada pelo Next em
 * produção — a tela inteira morre com "An error occurred in the Server
 * Components render". Já aconteceu uma vez, na tela de pedido. Por isso a
 * célula chega pronta: `valor` ordena, `texto` aparece.
 *
 * A PRIMEIRA CLICADA É DESCENDENTE nas colunas de número: quem clica em
 * "Comprado" quer ver o maior, e começar pelo menor custa um clique em toda
 * pergunta que alguém faz.
 */
export type ColunaTabela = { chave: string; rotulo: string; num?: boolean };

export type CelulaTabela = {
  /** O que ordena. */
  valor: number | string;
  /** O que aparece. */
  texto: string;
  /** "bad" pinta de vermelho; "muted" apaga. */
  classe?: string;
  /** Segunda linha, menor — a data da contagem, por exemplo. */
  nota?: string;
  /** Etiqueta ao lado do texto, como "sem ficha". */
  tag?: string;
  /** Texto do title, para o que não cabe na célula. */
  titulo?: string;
};

export type LinhaTabela = { chave: string; celulas: CelulaTabela[] };

export default function TabelaConferencia({
  colunas,
  linhas,
  ordemInicial,
}: {
  colunas: ColunaTabela[];
  linhas: LinhaTabela[];
  /** Índice da coluna em que a tabela abre; sem ele, mantém a ordem recebida. */
  ordemInicial?: number;
}) {
  const [ordem, setOrdem] = useState<{ indice: number; desc: boolean } | null>(
    ordemInicial === undefined ? null : { indice: ordemInicial, desc: false }
  );

  const ordenadas = useMemo(() => {
    if (!ordem) return linhas;
    const sinal = ordem.desc ? -1 : 1;
    return [...linhas].sort((a, b) => {
      const va = a.celulas[ordem.indice]?.valor ?? 0;
      const vb = b.celulas[ordem.indice]?.valor ?? 0;
      if (typeof va === "string" || typeof vb === "string") {
        return sinal * String(va).localeCompare(String(vb), "pt-BR");
      }
      return sinal * (va - vb);
    });
  }, [linhas, ordem]);

  return (
    <table>
      <thead>
        <tr>
          {colunas.map((c, i) => {
            const ativa = ordem?.indice === i;
            return (
              <th
                key={c.chave}
                className={`${c.num ? "num " : ""}ordenavel${ativa ? " ativa" : ""}`}
                onClick={() =>
                  setOrdem((atual) =>
                    atual?.indice === i
                      ? { indice: i, desc: !atual.desc }
                      : { indice: i, desc: Boolean(c.num) }
                  )
                }
                title="Clique para ordenar"
              >
                {c.rotulo}
                <span className="seta">{ativa ? (ordem!.desc ? " ▼" : " ▲") : " ⇅"}</span>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {ordenadas.map((l) => (
          <tr key={l.chave}>
            {l.celulas.map((c, i) => (
              <td key={colunas[i]?.chave ?? i} className={colunas[i]?.num ? "num" : undefined} title={c.titulo}>
                <span className={c.classe}>{c.texto}</span>
                {c.tag ? <span className="tag"> {c.tag}</span> : null}
                {c.nota ? <span className="cat bloco">{c.nota}</span> : null}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
