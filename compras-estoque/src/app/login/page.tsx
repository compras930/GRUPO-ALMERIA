"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      senha,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setErro("E-mail ou senha inválidos.");
      return;
    }
    router.push(searchParams.get("callbackUrl") || "/dashboard");
  }

  return (
    <div className="login-wrap">
      <div className="login-box">
        {/*
          A marca em vez do nome escrito. Aqui é a versão NAVY, a cor original
          do logo: o cartão de login é claro, ao contrário do menu lateral.

          O middleware precisa deixar `marca-` passar — esta tela, por
          definição, não tem sessão. Ver src/middleware.ts.
        */}
        <img
          className="login-marca"
          src="/marca-grupo-almeria.png"
          alt="Grupo Almeria"
          width={188}
          height={76}
        />
        <h1 style={{ fontSize: 22, marginBottom: 22 }}>Compras &amp; Estoque</h1>
        <form onSubmit={handleSubmit}>
          <div className="field-group" style={{ marginBottom: 14 }}>
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>
          <div className="field-group" style={{ marginBottom: 18 }}>
            <label htmlFor="senha">Senha</label>
            <input
              id="senha"
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>
          {erro && <p className="error-msg">{erro}</p>}
          <button className="btn primary" type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
