import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { criarUsuario, alternarUsuario } from "@/actions/usuarios";
import { PAPEIS, PAPEL_LABEL } from "@/lib/constants";

export default async function UsuariosPage() {
  await requireAdmin();
  const [usuarios, unidades] = await Promise.all([
    prisma.usuario.findMany({ orderBy: { nome: "asc" }, include: { unidade: true } }),
    prisma.unidade.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">Cadastros</p>
        <h1>Usuários</h1>
      </div>

      <div className="card">
        <h2 style={{ fontSize: 15, marginBottom: 14 }}>Novo usuário</h2>
        <form action={criarUsuario}>
          <div className="field-row">
            <div className="field-group">
              <label htmlFor="nome">Nome</label>
              <input id="nome" name="nome" required />
            </div>
            <div className="field-group">
              <label htmlFor="email">E-mail</label>
              <input id="email" name="email" type="email" required />
            </div>
            <div className="field-group">
              <label htmlFor="senha">Senha provisória</label>
              <input id="senha" name="senha" type="password" required minLength={6} />
            </div>
          </div>
          <div className="field-row">
            <div className="field-group">
              <label htmlFor="papel">Papel</label>
              <select id="papel" name="papel" required defaultValue="">
                <option value="" disabled>
                  Selecione
                </option>
                {PAPEIS.map((p) => (
                  <option key={p} value={p}>
                    {PAPEL_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label htmlFor="unidadeId">Unidade</label>
              <select id="unidadeId" name="unidadeId" defaultValue="">
                <option value="">Todas (admin)</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
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
            <th>E-mail</th>
            <th>Papel</th>
            <th>Unidade</th>
            <th>Status</th>
            <th className="num">Ação</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.id}>
              <td>{u.nome}</td>
              <td>{u.email}</td>
              <td className="cat">{PAPEL_LABEL[u.papel as keyof typeof PAPEL_LABEL]}</td>
              <td>{u.unidade?.nome || "Todas"}</td>
              <td>
                <span className={`tag ${u.ativo ? "ok" : "bad"}`}>{u.ativo ? "Ativo" : "Inativo"}</span>
              </td>
              <td className="num">
                <form action={alternarUsuario.bind(null, u.id, !u.ativo)}>
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
