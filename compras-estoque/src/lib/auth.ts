import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Papel } from "@/lib/constants";

export const authOptions: AuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credenciais",
      credentials: {
        email: { label: "E-mail", type: "email" },
        senha: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.senha) return null;

        const usuario = await prisma.usuario.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
          include: { unidade: true },
        });
        if (!usuario || !usuario.ativo) return null;

        const senhaOk = await bcrypt.compare(credentials.senha, usuario.senhaHash);
        if (!senhaOk) return null;

        return {
          id: usuario.id,
          name: usuario.nome,
          email: usuario.email,
          papel: usuario.papel,
          unidadeId: usuario.unidadeId,
          unidadeNome: usuario.unidade?.nome ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.papel = (user as any).papel;
        token.unidadeId = (user as any).unidadeId;
        token.unidadeNome = (user as any).unidadeNome;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).papel = token.papel as Papel;
        (session.user as any).unidadeId = token.unidadeId as string | null;
        (session.user as any).unidadeNome = token.unidadeNome as string | null;
      }
      return session;
    },
  },
};
