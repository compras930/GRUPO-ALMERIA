"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Papel } from "@/lib/constants";
import { PAPEIS, PAPEL_LABEL } from "@/lib/constants";
import { podeVerPedidos } from "@/lib/permissions";

/**
 * O menu em três grupos: o que se OLHA (Painel), o que se OPERA todo dia
 * (Estoque) e o que se CONFIGURA de vez em quando (Ajustes).
 *
 * Eles não têm o mesmo peso de uso, e por isso não têm a mesma forma: o
 * Painel é um link solto no topo, e os outros dois são botões que abrem.
 *
 * O grupo que contém a página aberta JÁ NASCE ABERTO. Fechar o menu em volta
 * de onde a pessoa está obrigaria um clique só pra ver onde ela já está — e
 * tiraria da vista os vizinhos, que é justamente o que um menu serve pra
 * mostrar.
 *
 * `papeis` ausente = todo mundo vê. `daUnidade` = só aparece pra quem tem uma
 * casa; contagem e perda dependem de uma unidade, e o ADMIN sem unidade entra
 * nelas pelo Estoque, escolhendo a casa antes.
 *
 * ISTO É MENU, NÃO SEGURANÇA. Quem decide o que pode é o servidor:
 * `requireAdmin` nas páginas de cadastro e `requireSession` + `unidadeVisivel`
 * nas ações de estoque e pedido. Esconder link só evita que alguém se perca.
 */
type ItemNav = { href: string; label: string; papeis?: Papel[]; daUnidade?: boolean };
type GrupoNav = { titulo: string | null; itens: ItemNav[] };

const NAV: GrupoNav[] = [
  { titulo: null, itens: [{ href: "/dashboard", label: "Painel" }] },
  {
    titulo: "Estoque",
    itens: [
      { href: "/estoque/contagem", label: "Contagem da semana", daUnidade: true },
      { href: "/estoque/perdas", label: "Perdas e baixas", daUnidade: true },
      { href: "/estoque/consumo", label: "Consumo" },
      { href: "/estoque", label: "Saldos" },
      { href: "/cmv", label: "Fichas técnicas", papeis: ["ADMIN"] },
      { href: "/receitas", label: "Sub-receitas", papeis: ["ADMIN"] },
      // Derivado do helper, não repetido à mão: a regra de quem vê pedido mora
      // em um lugar só, e o menu segue ela.
      { href: "/pedidos", label: "Pedidos de compra", papeis: PAPEIS.filter(podeVerPedidos) },
    ],
  },
  {
    titulo: "Ajustes",
    itens: [
      { href: "/produtos", label: "Produtos", papeis: ["ADMIN"] },
      { href: "/fornecedores", label: "Fornecedores", papeis: ["ADMIN"] },
      { href: "/unidades", label: "Unidades", papeis: ["ADMIN"] },
      { href: "/usuarios", label: "Usuários", papeis: ["ADMIN"] },
    ],
  },
];

/**
 * `startsWith` sozinho não serve depois que o menu ganhou irmãos: estando em
 * /estoque/perdas, "/estoque" também casaria, e dois itens ficariam acesos ao
 * mesmo tempo. Casa exato, ou um filho de verdade (com a barra).
 */
function ativo(pathname: string | null, href: string) {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar({
  papel,
  unidadeNome,
  userName,
}: {
  papel: Papel;
  unidadeNome: string | null;
  userName: string | null;
}) {
  const pathname = usePathname();
  // Só guarda o que a pessoa ABRIU ou FECHOU com o clique. O estado inicial de
  // cada grupo é derivado da página atual, não armazenado — assim navegar
  // entre telas reabre o grupo certo sozinho, sem ninguém sincronizar nada.
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const recolhivel = papel === "ADMIN";

  return (
    <nav className="sidebar">
      {/*
        A marca do Grupo, não o nome escrito à mão que havia aqui antes.

        A versão CLARA: o logo original é navy, e navy sobre o vinho do menu
        não se enxerga. O arquivo tem o mesmo desenho recolorido em #f3ead9.

        Servido em 376px e exibido em 170: o dobro da densidade, pra não sair
        borrado em tela retina. `width`/`height` declarados porque sem eles o
        menu "pula" enquanto a imagem carrega.

        `alt` com o nome: é o cabeçalho do app pra quem usa leitor de tela.
      */}
      <img
        className="brand"
        src="/marca-grupo-almeria-claro.png"
        alt="Grupo Almeria"
        width={170}
        height={69}
      />
      <div className="unit">
        {unidadeNome ?? "Todas as unidades"} · {PAPEL_LABEL[papel]}
      </div>
      {NAV.map((grupo) => {
        const itens = grupo.itens.filter(
          (i) => (!i.papeis || i.papeis.includes(papel)) && (!i.daUnidade || unidadeNome !== null)
        );
        // Grupo que ficou sem nenhum item some inteiro — título de seção vazia
        // é promessa de uma tela que a pessoa não tem.
        if (itens.length === 0) return null;
        if (!grupo.titulo) {
          return (
            <div className="nav-grupo" key="topo">
              {itens.map((item) => (
                <Link key={item.href} href={item.href} className={ativo(pathname, item.href) ? "active" : ""}>
                  {item.label}
                </Link>
              ))}
            </div>
          );
        }
        // O menu só RECOLHE para o ADMIN. Ele é quem tem a lista longa — doze
        // telas em três grupos — e quem entra ali de vez em quando. O gerente
        // tem quatro itens e usa dois deles toda semana: esconder atrás de um
        // clique seria friccionar justamente a tarefa que o app existe pra
        // capturar.
        if (!recolhivel) {
          return (
            <div className="nav-grupo" key={grupo.titulo}>
              <p className="nav-titulo">{grupo.titulo}</p>
              <div className="nav-itens">
                {itens.map((item) => (
                  <Link key={item.href} href={item.href} className={ativo(pathname, item.href) ? "active" : ""}>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          );
        }
        const aberto = abertos[grupo.titulo] ?? itens.some((i) => ativo(pathname, i.href));
        return (
          <div className="nav-grupo" key={grupo.titulo}>
            <button
              type="button"
              className={`nav-botao${aberto ? " aberto" : ""}`}
              aria-expanded={aberto}
              onClick={() => setAbertos((a) => ({ ...a, [grupo.titulo!]: !aberto }))}
            >
              <span>{grupo.titulo}</span>
              {/* Seta em texto, não em imagem: ela gira com o estado e não
                  precisa de nada carregado da rede pra aparecer. */}
              <span className="nav-seta" aria-hidden="true">
                ›
              </span>
            </button>
            {aberto && (
              <div className="nav-itens">
                {itens.map((item) => (
                  <Link key={item.href} href={item.href} className={ativo(pathname, item.href) ? "active" : ""}>
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div className="signout">
        <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 8 }}>{userName}</div>
        <a onClick={() => signOut({ callbackUrl: "/login" })} style={{ cursor: "pointer" }}>
          Sair
        </a>
      </div>
    </nav>
  );
}
