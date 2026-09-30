"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Papel } from "@/lib/constants";
import { PAPEL_LABEL } from "@/lib/constants";

const NAV: Array<{ href: string; label: string; papeis?: Papel[] }> = [
  { href: "/dashboard", label: "Painel" },
  { href: "/cmv", label: "CMV", papeis: ["ADMIN"] },
  { href: "/receitas", label: "Sub-receitas", papeis: ["ADMIN"] },
  { href: "/pedidos", label: "Pedidos de compra" },
  { href: "/estoque", label: "Estoque" },
  { href: "/estoque/consumo", label: "Consumo" },
  { href: "/fornecedores", label: "Fornecedores", papeis: ["ADMIN"] },
  { href: "/produtos", label: "Produtos", papeis: ["ADMIN"] },
  { href: "/unidades", label: "Unidades", papeis: ["ADMIN"] },
  { href: "/usuarios", label: "Usuários", papeis: ["ADMIN"] },
];

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
      {NAV.filter((item) => !item.papeis || item.papeis.includes(papel)).map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={pathname?.startsWith(item.href) ? "active" : ""}
        >
          {item.label}
        </Link>
      ))}
      <div className="signout">
        <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 8 }}>{userName}</div>
        <a onClick={() => signOut({ callbackUrl: "/login" })} style={{ cursor: "pointer" }}>
          Sair
        </a>
      </div>
    </nav>
  );
}
