import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireGestaoManutencao } from "@/lib/manutencao/guarda";
import { PAPEL_LABEL, type Papel } from "@/lib/constants";
import { fmtTelefone } from "@/lib/manutencao/regras";
import { TEMPLATES, whatsappConfigurado, type NomeTemplate } from "@/lib/manutencao/whatsapp";
import { salvarContato } from "@/actions/manutencao";
import FormAcao from "@/components/manutencao/FormAcao";

const O_QUE_RECEBE: Partial<Record<Papel, string>> = {
  MANUTENCAO: "Chamado novo de qualquer casa",
  GERENTE: "Serviço concluído para aprovar, chamado recusado",
  ADMIN: "Chamado novo, se nenhum responsável da manutenção tiver WhatsApp",
};

export default async function ContatosPage() {
  await requireGestaoManutencao();
  const usuarios = await prisma.usuario.findMany({
    where: { ativo: true, papel: { in: ["MANUTENCAO", "GERENTE", "ADMIN", "APROVADOR"] } },
    include: { unidade: { select: { nome: true } }, contatoWhatsapp: true },
    orderBy: [{ papel: "asc" }, { nome: "asc" }],
  });
  const configurado = whatsappConfigurado();

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">
          <Link href="/manutencao">Manutenção</Link>
        </p>
        <h1>WhatsApp da equipe</h1>
        <p className="hint" style={{ marginTop: 6 }}>
          O telefone de quem tem login no sistema. O gerente também recebe aviso dos chamados que ele mesmo abriu.
        </p>
      </div>

      <div className={`card ${configurado ? "" : "aviso-duplicado"}`}>
        <strong>Envio automático: {configurado ? "ligado ✔" : "ainda não configurado"}</strong>
        <p className="hint" style={{ marginTop: 6 }}>
          {configurado
            ? "As mensagens saem pela API oficial do WhatsApp (Meta). Cada envio fica registrado no histórico do chamado."
            : "Enquanto a API oficial não estiver ligada, cada chamado mostra um botão para enviar a mensagem pronta pelo seu WhatsApp."}{" "}
          Modelos usados: {(Object.keys(TEMPLATES) as NomeTemplate[]).map((n) => <code key={n} style={{ marginRight: 6 }}>{n}</code>)}
        </p>
      </div>

      <div className="tabela-rolavel">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Papel</th>
              <th>Recebe</th>
              <th>WhatsApp</th>
              <th>Relatório semanal</th>
              <th className="num">Editar</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.nome}</strong>
                  {u.unidade && <div className="cat">{u.unidade.nome}</div>}
                </td>
                <td className="cat">{PAPEL_LABEL[u.papel as Papel] ?? u.papel}</td>
                <td className="cat">{O_QUE_RECEBE[u.papel as Papel] ?? "—"}</td>
                <td>{u.contatoWhatsapp ? fmtTelefone(u.contatoWhatsapp.telefone) : <span className="cat">não cadastrado</span>}</td>
                <td>{u.contatoWhatsapp?.recebeRelatorioSemanal ? <span className="tag ok">Sim</span> : <span className="cat">Não</span>}</td>
                <td className="num">
                  <FormAcao action={salvarContato.bind(null, u.id)} abrirCom="Editar" classeAbrir="btn small" botao="Salvar">
                    <div className="field-group" style={{ marginBottom: 8 }}>
                      <label htmlFor={`tel-${u.id}`}>WhatsApp (vazio = remover)</label>
                      <input
                        id={`tel-${u.id}`}
                        name="telefone"
                        inputMode="tel"
                        placeholder="(61) 99999-1234"
                        defaultValue={u.contatoWhatsapp ? fmtTelefone(u.contatoWhatsapp.telefone) : ""}
                      />
                    </div>
                    <label className="check">
                      <input type="checkbox" name="relatorio" defaultChecked={u.contatoWhatsapp?.recebeRelatorioSemanal} />
                      Recebe o relatório semanal
                    </label>
                  </FormAcao>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint" style={{ marginTop: 12 }}>
        Para criar o login do responsável da manutenção, vá em Ajustes → Usuários e escolha o papel “Responsável da
        manutenção” (não precisa de casa).
      </p>
    </div>
  );
}
