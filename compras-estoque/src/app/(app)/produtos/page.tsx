import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { alternarProduto } from "@/actions/produtos";
import ProdutoForm from "@/components/ProdutoForm";

export default async function ProdutosPage() {
  await requireAdmin();
  const produtos = await prisma.produto.findMany({ orderBy: { nome: "asc" } });

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">Cadastros</p>
        <h1>Produtos / Insumos</h1>
      </div>

      <div className="card">
        <h2 style={{ fontSize: 15, marginBottom: 14 }}>Novo produto</h2>
        <ProdutoForm />
      </div>

      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Categoria</th>
            <th>Unidade</th>
            <th>Status</th>
            <th className="num">Ação</th>
          </tr>
        </thead>
        <tbody>
          {produtos.map((p) => (
            <tr key={p.id}>
              <td>{p.nome}</td>
              <td>{p.categoria || "—"}</td>
              <td className="num">{p.unidadeMedida}</td>
              <td>
                <span className={`tag ${p.ativo ? "ok" : "bad"}`}>{p.ativo ? "Ativo" : "Inativo"}</span>
              </td>
              <td className="num">
                <form action={alternarProduto.bind(null, p.id, !p.ativo)}>
                  <button className="btn small" type="submit">
                    {p.ativo ? "Desativar" : "Ativar"}
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
