"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Papel } from "@/lib/constants";
import { PAPEL_LABEL } from "@/lib/constants";

const NAV: Array<{ href: string; label: string; papeis?: Papel[] }> = [
  { href: "/dashboard", label: "Painel" },
  { href: "/pedidos", label: "Pedidos de compra" },
  { href: "/estoque", label: "Estoque" },
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
      <div className="brand">
        Grupo <em>Almeria</em>
      </div>
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
