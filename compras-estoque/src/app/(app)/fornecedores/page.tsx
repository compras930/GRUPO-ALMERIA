import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { criarFornecedor, alternarFornecedor } from "@/actions/fornecedores";

export default async function FornecedoresPage() {
  await requireAdmin();
  const fornecedores = await prisma.fornecedor.findMany({ orderBy: { nome: "asc" } });

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">Cadastros</p>
        <h1>Fornecedores</h1>
      </div>

      <div className="card">
        <h2 style={{ fontSize: 15, marginBottom: 14 }}>Novo fornecedor</h2>
        <form action={criarFornecedor}>
          <div className="field-row">
            <div className="field-group">
              <label htmlFor="nome">Nome</label>
              <input id="nome" name="nome" required />
            </div>
            <div className="field-group">
              <label htmlFor="cnpj">CNPJ</label>
              <input id="cnpj" name="cnpj" />
            </div>
          </div>
          <div className="field-row">
            <div className="field-group">
              <label htmlFor="contato">Contato</label>
              <input id="contato" name="contato" placeholder="Nome do contato" />
            </div>
            <div className="field-group">
              <label htmlFor="telefone">Telefone</label>
              <input id="telefone" name="telefone" />
            </div>
          </div>
          <button className="btn primary" type="submit">
            Adicionar
          </button>
        </form>
      </div>

      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>CNPJ</th>
            <th>Contato</th>
            <th>Telefone</th>
            <th>Status</th>
            <th className="num">Ação</th>
          </tr>
        </thead>
        <tbody>
          {fornecedores.map((f) => (
            <tr key={f.id}>
              <td>{f.nome}</td>
              <td>{f.cnpj || "—"}</td>
              <td>{f.contato || "—"}</td>
              <td>{f.telefone || "—"}</td>
              <td>
                <span className={`tag ${f.ativo ? "ok" : "bad"}`}>{f.ativo ? "Ativo" : "Inativo"}</span>
              </td>
              <td className="num">
                <form action={alternarFornecedor.bind(null, f.id, !f.ativo)}>
                  <button className="btn small" type="submit">
                    {f.ativo ? "Desativar" : "Ativar"}
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
