import type { DefaultSession } from "next-auth";
import type { Papel } from "@/lib/constants";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      papel: Papel;
      unidadeId: string | null;
      unidadeNome: string | null;
    } & DefaultSession["user"];
  }
}
