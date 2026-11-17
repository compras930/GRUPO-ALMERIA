import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireGestaoManutencao } from "@/lib/manutencao/guarda";
import { CATEGORIAS_MANUTENCAO, CATEGORIA_LABEL, rotuloCategoria } from "@/lib/manutencao/constantes";
import { fmtTelefone } from "@/lib/manutencao/regras";
import { alternarColaborador, salvarColaborador } from "@/actions/manutencao";
import FormAcao from "@/components/manutencao/FormAcao";
import ActionButton from "@/components/ActionButton";

type Col = Awaited<ReturnType<typeof prisma.colaboradorManutencao.findMany>>[number];

function Campos({ c }: { c?: Col }) {
  const p = c?.id ?? "novo";
  return (
    <>
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="field-row">
        <div className="field-group">
          <label htmlFor={`nome-${p}`}>Nome</label>
          <input id={`nome-${p}`} name="nome" required defaultValue={c?.nome} />
        </div>
        <div className="field-group">
          <label htmlFor={`tel-${p}`}>WhatsApp</label>
          <input
            id={`tel-${p}`}
            name="telefone"
            required
            inputMode="tel"
            placeholder="(61) 99999-1234"
            defaultValue={c ? fmtTelefone(c.telefone) : ""}
          />
        </div>
        <div className="field-group">
          <label htmlFor={`emp-${p}`}>Empresa (se for terceiro)</label>
          <input id={`emp-${p}`} name="empresa" defaultValue={c?.empresa ?? ""} />
        </div>
      </div>
      <div className="field-group" style={{ marginBottom: 12 }}>
        <label>Categorias que atende</label>
        <div className="checks">
          {CATEGORIAS_MANUTENCAO.map((cat) => (
            <label key={cat} className="check">
              <input type="checkbox" name="categorias" value={cat} defaultChecked={c?.categorias.includes(cat)} />
              {CATEGORIA_LABEL[cat]}
            </label>
          ))}
        </div>
      </div>
      <div className="field-row">
        <label className="check">
          <input type="checkbox" name="interno" defaultChecked={c?.interno} /> É Agente de Manutenção do Grupo (interno)
        </label>
      </div>
      <div className="field-group">
        <label htmlFor={`obs-${p}`}>Observação</label>
        <input id={`obs-${p}`} name="observacao" defaultValue={c?.observacao ?? ""} />
      </div>
    </>
  );
}

export default async function ColaboradoresPage() {
  await requireGestaoManutencao();
  const [cols, carga] = await Promise.all([
    prisma.colaboradorManutencao.findMany({ orderBy: [{ ativo: "desc" }, { nome: "asc" }] }),
    prisma.chamadoManutencao.groupBy({
      by: ["colaboradorId"],
      where: { status: { in: ["ENCAMINHADO", "EM_ANDAMENTO"] }, colaboradorId: { not: null } },
      _count: true,
    }),
  ]);
  const emAberto = new Map(carga.map((c) => [c.colaboradorId, c._count]));

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">
          <Link href="/manutencao">Manutenção</Link>
        </p>
        <h1>Colaboradores</h1>
        <p className="hint" style={{ marginTop: 6 }}>
          Quem executa os reparos. Eles recebem o chamado no WhatsApp e respondem por um link, sem precisar de login.
        </p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <FormAcao action={salvarColaborador} abrirCom="+ Novo colaborador" classeAbrir="btn primary" botao="Salvar">
          <Campos />
        </FormAcao>
      </div>

      {cols.length === 0 ? (
        <div className="empty">Nenhum colaborador cadastrado ainda.</div>
      ) : (
        <div className="tabela-rolavel">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>WhatsApp</th>
                <th>Atende</th>
                <th className="num">Em aberto</th>
                <th>Status</th>
                <th className="num">Ações</th>
              </tr>
            </thead>
            <tbody>
              {cols.map((c) => (
                <tr key={c.id} className={c.ativo ? "" : "linha-inativa"}>
                  <td>
                    <strong>{c.nome}</strong>
                    <div className="cat">{c.interno ? "Agente de manutenção" : c.empresa ?? "Prestador"}</div>
                  </td>
                  <td>{fmtTelefone(c.telefone)}</td>
                  <td className="cat">{c.categorias.map(rotuloCategoria).join(", ")}</td>
                  <td className="num">{emAberto.get(c.id) ?? 0}</td>
                  <td>
                    <span className={`tag ${c.ativo ? "ok" : "bad"}`}>{c.ativo ? "Ativo" : "Inativo"}</span>
                  </td>
                  <td className="num">
                    <div className="btn-row" style={{ justifyContent: "flex-end" }}>
                      <FormAcao action={salvarColaborador} abrirCom="Editar" classeAbrir="btn small" botao="Salvar">
                        <Campos c={c} />
                      </FormAcao>
                      <ActionButton action={alternarColaborador.bind(null, c.id, !c.ativo)} className="btn small">
                        {c.ativo ? "Desativar" : "Ativar"}
                      </ActionButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
