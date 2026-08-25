import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { criarUnidade, alternarUnidade } from "@/actions/unidades";

export default async function UnidadesPage() {
  await requireAdmin();
  const unidades = await prisma.unidade.findMany({ orderBy: { nome: "asc" } });

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">Cadastros</p>
        <h1>Unidades</h1>
      </div>

      <div className="card">
        <h2 style={{ fontSize: 15, marginBottom: 14 }}>Nova unidade</h2>
        <form action={criarUnidade} className="field-row">
          <div className="field-group">
            <label htmlFor="nome">Nome</label>
            <input id="nome" name="nome" required placeholder="Ex: Beira Lago" />
          </div>
          <div style={{ alignSelf: "flex-end" }}>
            <button className="btn primary" type="submit">
              Adicionar
            </button>
          </div>
        </form>
      </div>

      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Status</th>
            <th className="num">Ação</th>
          </tr>
        </thead>
        <tbody>
          {unidades.map((u) => (
            <tr key={u.id}>
              <td>{u.nome}</td>
              <td>
                <span className={`tag ${u.ativo ? "ok" : "bad"}`}>{u.ativo ? "Ativa" : "Inativa"}</span>
              </td>
              <td className="num">
                <form action={alternarUnidade.bind(null, u.id, !u.ativo)}>
                  <button className="btn small" type="submit">
                    {u.ativo ? "Desativar" : "Ativar"}
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
