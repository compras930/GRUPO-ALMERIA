import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="shell">
      <Sidebar
        papel={session.user.papel}
        unidadeNome={session.user.unidadeNome}
        userName={session.user.name ?? null}
      />
      <main className="main">{children}</main>
    </div>
  );
}
