import { prisma } from "@/lib/prisma";
import { rotuloCategoria, URGENCIA_LABEL, type Urgencia } from "@/lib/manutencao/constantes";
import { estaAtrasado, fmtDataHora, fmtDuracao } from "@/lib/manutencao/regras";
import { BotaoAceitar, FormConcluir } from "@/components/manutencao/AcoesColaborador";
import EnvioWhatsapp from "@/components/manutencao/EnvioWhatsapp";
import { INCLUDE_MENSAGEM, destinatariosDaCasa, textoMensagem, type Destinatario } from "@/lib/manutencao/notificar";
import { whatsappConfigurado } from "@/lib/manutencao/whatsapp";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chamado de manutenção — Grupo Almeria", robots: { index: false } };

/**
 * A página do COLABORADOR (pedreiro, eletricista, técnico, agente). Ele não
 * tem login: chega pelo link do WhatsApp, e o segredo do link é a
 * autorização. Feita para o celular, com um botão grande por etapa.
 */
export default async function PaginaColaborador({ params }: { params: { token: string } }) {
  const c = await prisma.chamadoManutencao.findUnique({
    where: { tokenAcesso: params.token },
    include: {
      unidade: { select: { nome: true, nomeFiscal: true } },
      colaborador: { select: { nome: true } },
      fotos: { select: { id: true, etapa: true }, orderBy: { criadoEm: "asc" } },
    },
  });

  return (
    <div className="pagina-colaborador">
      <img src="/marca-grupo-almeria.png" alt="Grupo Almeria" className="marca-colaborador" />
      {!c ? (
        <div className="card">
          <h1>Link inválido</h1>
          <p className="hint">
            Este link não vale mais. O chamado pode ter sido passado para outra pessoa. Fale com o responsável da
            manutenção.
          </p>
        </div>
      ) : (
        <Conteudo c={c} token={params.token} avisoCasa={await avisoParaCasa(c.id, c.status)} />
      )}
    </div>
  );
}

/**
 * Sem envio automático, o aviso de "serviço concluído" sai do celular do
 * próprio colaborador — ele é quem está com o chamado na mão nessa hora.
 */
async function avisoParaCasa(id: string, status: string) {
  if (status !== "AGUARDANDO_APROVACAO" || whatsappConfigurado()) return null;
  const c = await prisma.chamadoManutencao.findUnique({ where: { id }, include: INCLUDE_MENSAGEM });
  if (!c) return null;
  return { texto: textoMensagem("chamado_para_aprovacao", c), destinos: await destinatariosDaCasa(c.unidadeId, c.abertoPorId) };
}

function Conteudo({
  c,
  token,
  avisoCasa,
}: {
  c: any;
  token: string;
  avisoCasa: { texto: string; destinos: Destinatario[] } | null;
}) {
  const agora = new Date();
  const atrasado = estaAtrasado(c, agora);
  const fotosAbertura = c.fotos.filter((f: any) => f.etapa === "ABERTURA");
  const fotosConclusao = c.fotos.filter((f: any) => f.etapa === "CONCLUSAO");
  return (
    <>
      <div className="card">
        <p className="eyebrow">
          Chamado nº {c.numero} · {c.unidade.nome}
        </p>
        <h1 style={{ fontSize: 22, margin: "6px 0 10px" }}>{c.titulo}</h1>
        <p className="cat">
          {rotuloCategoria(c.categoria)} · {URGENCIA_LABEL[c.urgencia as Urgencia] ?? c.urgencia}
          {c.local ? ` · ${c.local}` : ""}
        </p>
        <p className="texto-livre" style={{ marginTop: 12 }}>
          {c.descricao}
        </p>
        {fotosAbertura.length > 0 && (
          <div className="fotos-grade" style={{ marginTop: 12 }}>
            {fotosAbertura.map((f: any) => (
              <a key={f.id} href={`/m/${token}/foto/${f.id}`} target="_blank" rel="noreferrer" className="foto-previa">
                <img src={`/m/${token}/foto/${f.id}`} alt="Foto do problema" />
              </a>
            ))}
          </div>
        )}
      </div>

      {c.status === "ENCAMINHADO" && (
        <div className="card">
          <p style={{ marginBottom: 12 }}>
            Olá, {c.colaborador?.nome?.split(" ")[0]}! Confirme que vai atender. O prazo de{" "}
            <strong>{c.prazoHoras} horas</strong> começa a contar a partir do seu OK.
          </p>
          <BotaoAceitar token={token} />
        </div>
      )}

      {c.status === "EM_ANDAMENTO" && (
        <div className="card">
          <p className={atrasado ? "error-msg" : "hint"} style={{ marginBottom: 12, fontSize: 14 }}>
            {atrasado
              ? `Prazo vencido há ${fmtDuracao(agora.getTime() - c.prazoFinal.getTime())}.`
              : `Prazo: até ${fmtDataHora(c.prazoFinal)} (faltam ${fmtDuracao(c.prazoFinal.getTime() - agora.getTime())}).`}
          </p>
          {c.reprovacoes > 0 && (
            <p className="aviso-duplicado" style={{ marginBottom: 12 }}>
              A casa pediu correção: {c.motivoReprovacao}
            </p>
          )}
          <h2 className="titulo-secao">Terminou? Registre o serviço</h2>
          <FormConcluir token={token} />
        </div>
      )}

      {avisoCasa && (
        <EnvioWhatsapp
          titulo="Último passo: avise a casa"
          texto={avisoCasa.texto}
          destinos={avisoCasa.destinos}
          destaque
        />
      )}

      {c.status === "AGUARDANDO_APROVACAO" && (
        <div className="card">
          <h2 className="titulo-secao">Serviço enviado ✔</h2>
          <p className="hint">Aguardando a casa conferir e aprovar. Se reprovarem, você recebe uma mensagem.</p>
          <p className="texto-livre" style={{ marginTop: 10 }}>
            {c.servicoExecutado}
          </p>
          <div className="fotos-grade" style={{ marginTop: 12 }}>
            {fotosConclusao.map((f: any) => (
              <span key={f.id} className="foto-previa">
                <img src={`/m/${token}/foto/${f.id}`} alt="Foto do serviço" />
              </span>
            ))}
          </div>
        </div>
      )}

      {c.status === "FINALIZADO" && (
        <div className="card">
          <h2 className="titulo-secao">Chamado finalizado ✔</h2>
          <p className="hint">A casa aprovou o serviço em {fmtDataHora(c.finalizadoEm)}. Obrigado!</p>
        </div>
      )}
    </>
  );
}
