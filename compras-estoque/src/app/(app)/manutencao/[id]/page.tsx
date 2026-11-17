import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { ehAgente, podeAprovarServico, podeTriarChamado, podeVerChamado } from "@/lib/permissions";
import { BotaoAceitar, FormConcluir } from "@/components/manutencao/AcoesColaborador";
import {
  PRAZO_PADRAO_HORAS,
  URGENCIA_LABEL,
  rotuloCategoria,
  type StatusChamado,
  type Urgencia,
} from "@/lib/manutencao/constantes";
import { estaAtrasado, fmtDataHora, fmtDuracao, possiveisDuplicados } from "@/lib/manutencao/regras";
import {
  INCLUDE_MENSAGEM,
  destinatariosDoModelo,
  linkColaborador,
  textoMensagem,
} from "@/lib/manutencao/notificar";
import { CHAMADA_DO_MODELO, whatsappConfigurado, type NomeTemplate } from "@/lib/manutencao/whatsapp";
import EnvioWhatsapp from "@/components/manutencao/EnvioWhatsapp";
import {
  aprovarServico,
  cancelarChamado,
  encaminharChamado,
  marcarDuplicado,
  recusarChamado,
  reenviarWhatsapp,
  reprovarServico,
} from "@/actions/manutencao";
import TagStatus from "@/components/manutencao/TagStatus";
import FormAcao from "@/components/manutencao/FormAcao";
import ActionButton from "@/components/ActionButton";

const MODELO_DA_ETAPA: Partial<Record<StatusChamado, NomeTemplate>> = {
  ABERTO: "chamado_novo",
  ENCAMINHADO: "chamado_encaminhado",
  AGUARDANDO_APROVACAO: "chamado_para_aprovacao",
  RECUSADO: "chamado_recusado",
  FINALIZADO: "chamado_aprovado",
};

export default async function ChamadoPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { novo?: string };
}) {
  const user = await requireSession();
  const c = await prisma.chamadoManutencao.findUnique({
    where: { id: params.id },
    include: {
      ...INCLUDE_MENSAGEM,
      colaborador: true,
      abertoPor: { select: { nome: true } },
      triadoPor: { select: { nome: true } },
      aprovadoPor: { select: { nome: true } },
      duplicadoDe: { select: { id: true, numero: true } },
      duplicatas: { select: { id: true, numero: true } },
      fotos: { select: { id: true, etapa: true }, orderBy: { criadoEm: "asc" } },
      eventos: { orderBy: { criadoEm: "asc" } },
    },
  });
  if (!c) notFound();
  const visivel = podeVerChamado(
    { id: user.id, papel: user.papel, unidadeId: user.unidadeId ?? null },
    { unidadeId: c.unidadeId, colaboradorUsuarioId: c.colaborador?.usuarioId ?? null }
  );
  if (!visivel) redirect("/manutencao");
  // O agente logado atende pelo app: as mesmas ações da página do link.
  const souOAgente = ehAgente(user.papel) && c.colaborador?.usuarioId === user.id;

  const agora = new Date();
  const atrasado = estaAtrasado(c, agora);
  const triador = podeTriarChamado(user.papel);
  const aprovador = podeAprovarServico(user.papel);
  const status = c.status as StatusChamado;

  const [colaboradores, outrosAbertos, historicoLocal] = await Promise.all([
    triador
      ? prisma.colaboradorManutencao.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } })
      : Promise.resolve([]),
    triador && status === "ABERTO"
      ? prisma.chamadoManutencao.findMany({
          where: { unidadeId: c.unidadeId, categoria: c.categoria, id: { not: c.id }, abertoEm: { lte: c.abertoEm } },
          select: { id: true, numero: true, unidadeId: true, categoria: true, titulo: true, descricao: true, localChave: true, status: true },
        })
      : Promise.resolve([]),
    c.localChave
      ? prisma.chamadoManutencao.findMany({
          where: {
            unidadeId: c.unidadeId,
            localChave: c.localChave,
            id: { not: c.id },
            abertoEm: { gte: new Date(c.abertoEm.getTime() - 180 * 86_400_000) },
            duplicadoDeId: null,
          },
          select: { id: true, numero: true, titulo: true, status: true, abertoEm: true },
          orderBy: { abertoEm: "desc" },
          take: 10,
        })
      : Promise.resolve([]),
  ]);
  const duplicadosProvaveis = possiveisDuplicados(c, outrosAbertos);
  const daCategoria = colaboradores.filter((k) => k.categorias.includes(c.categoria));
  const outros = colaboradores.filter((k) => !k.categorias.includes(c.categoria));

  // A mensagem da etapa e QUEM a manda no modo manual: quem vive a etapa.
  // A casa avisa a manutenção; a manutenção avisa o colaborador e a casa; quem
  // reprovou avisa o colaborador. (O aviso de serviço concluído é mandado pelo
  // próprio colaborador, na página dele — aqui fica de reserva.)
  const modelo: NomeTemplate | undefined =
    status === "EM_ANDAMENTO" ? (c.reprovacoes > 0 ? "chamado_reprovado" : undefined) : MODELO_DA_ETAPA[status];
  const quemEnvia: Record<NomeTemplate, boolean> = {
    chamado_novo: !triador || c.abertoPorId === user.id,
    chamado_encaminhado: triador,
    chamado_reprovado: aprovador || triador,
    chamado_para_aprovacao: triador || souOAgente,
    chamado_aprovado: aprovador || triador,
    chamado_recusado: triador,
    relatorio_semanal_manutencao: false,
  };
  const mostrarEnvioManual = modelo && quemEnvia[modelo];
  const manual = !whatsappConfigurado();
  const destinos = mostrarEnvioManual ? await destinatariosDoModelo(modelo!, c) : [];
  const textoManual = mostrarEnvioManual ? textoMensagem(modelo!, c) : "";

  const envio = mostrarEnvioManual ? (
    <EnvioWhatsapp
      titulo={manual ? CHAMADA_DO_MODELO[modelo!] : "WhatsApp desta etapa"}
      texto={textoManual}
      destinos={destinos}
      destaque={manual}
      rodape={
        <>
          {destinos.length === 0 && (
            <p className="hint" style={{ marginTop: 10 }}>
              Ninguém com WhatsApp cadastrado para esta etapa — use “Escolher contato ou grupo”.
              {triador && (
                <>
                  {" "}
                  <Link href="/manutencao/contatos">Cadastrar telefones</Link>
                </>
              )}
            </p>
          )}
          {!manual && (
            <div style={{ marginTop: 10 }}>
              <ActionButton action={reenviarWhatsapp.bind(null, c.id)} className="btn small">
                Reenviar automático
              </ActionButton>
            </div>
          )}
          {triador && c.tokenAcesso && (status === "ENCAMINHADO" || status === "EM_ANDAMENTO") && (
            <p className="hint" style={{ marginTop: 10 }}>
              Link do colaborador: <code>{linkColaborador(c)}</code>
            </p>
          )}
        </>
      }
    />
  ) : null;

  const fotosAbertura = c.fotos.filter((f) => f.etapa === "ABERTURA");
  const fotosConclusao = c.fotos.filter((f) => f.etapa === "CONCLUSAO");

  const linhaTempo: [string, Date | null, string | null][] = [
    ["Abertura", c.abertoEm, c.abertoPor.nome],
    ["Triagem", c.triadoEm, c.triadoPor?.nome ?? null],
    ["Encaminhado ao colaborador", c.encaminhadoEm, c.colaborador?.nome ?? null],
    ["OK do colaborador (início do prazo)", c.aceitoEm, null],
    ["Prazo final", c.prazoFinal, c.prazoHoras ? `${c.prazoHoras} h` : null],
    ["Serviço concluído", c.concluidoEm, null],
    ["Aprovado pela casa", c.finalizadoEm, c.aprovadoPor?.nome ?? null],
  ];

  return (
    <div style={{ maxWidth: 980 }}>
      <div className="page-header">
        <p className="eyebrow">
          <Link href="/manutencao">Manutenção</Link> · {c.unidade.nome}
        </p>
        <h1>
          Nº {c.numero} — {c.titulo}
        </h1>
        <div style={{ marginTop: 10 }}>
          <TagStatus status={c.status} atrasado={atrasado} />
        </div>
      </div>

      {searchParams.novo && (
        <p className="ok-msg" style={{ marginBottom: 14 }}>
          Chamado nº {c.numero} aberto.{manual ? " Agora avise a manutenção pelo WhatsApp:" : " A manutenção foi avisada pelo WhatsApp."}
        </p>
      )}
      {manual && envio}

      <div className="resumo-chamado">
        <div>
          <span className="lbl">Categoria</span>
          <strong>{rotuloCategoria(c.categoria)}</strong>
        </div>
        <div>
          <span className="lbl">Urgência</span>
          <strong>{URGENCIA_LABEL[c.urgencia as Urgencia] ?? c.urgencia}</strong>
        </div>
        <div>
          <span className="lbl">Local</span>
          <strong>{c.local ?? "—"}</strong>
        </div>
        <div>
          <span className="lbl">Quem atende</span>
          <strong>{c.colaborador ? `${c.colaborador.nome}${c.colaborador.interno ? " (agente)" : ""}` : "—"}</strong>
        </div>
      </div>

      {/* ---------------- Ações ---------------- */}
      {souOAgente && c.tokenAcesso && status === "ENCAMINHADO" && (
        <div className="card destaque-aprovacao">
          <p style={{ marginBottom: 12 }}>
            Confirme que vai atender. O prazo de <strong>{c.prazoHoras} horas</strong> começa a contar a partir do
            seu OK.
          </p>
          <BotaoAceitar token={c.tokenAcesso} />
        </div>
      )}
      {souOAgente && c.tokenAcesso && status === "EM_ANDAMENTO" && (
        <div className="card destaque-aprovacao">
          {c.prazoFinal && (
            <p className={atrasado ? "error-msg" : "hint"} style={{ marginBottom: 12, fontSize: 14 }}>
              {atrasado
                ? `Prazo vencido há ${fmtDuracao(agora.getTime() - c.prazoFinal.getTime())}.`
                : `Prazo: até ${fmtDataHora(c.prazoFinal)} (faltam ${fmtDuracao(c.prazoFinal.getTime() - agora.getTime())}).`}
            </p>
          )}
          {c.reprovacoes > 0 && (
            <p className="aviso-duplicado" style={{ marginBottom: 12 }}>
              A casa pediu correção: {c.motivoReprovacao}
            </p>
          )}
          <h2 className="titulo-secao">Terminou? Registre o serviço</h2>
          <FormConcluir token={c.tokenAcesso} />
        </div>
      )}
      {triador && status === "ABERTO" && (
        <div className="card">
          <h2 className="titulo-secao">Triagem</h2>
          {duplicadosProvaveis.length > 0 && (
            <div className="aviso-duplicado">
              <strong>Possível duplicado de:</strong>{" "}
              {duplicadosProvaveis.map((d) => (
                <Link key={d.id} href={`/manutencao/${d.id}`} style={{ marginRight: 10 }}>
                  nº {d.numero} — {d.titulo}
                </Link>
              ))}
            </div>
          )}
          <FormAcao action={encaminharChamado.bind(null, c.id)} botao="Aceitar e encaminhar">
            <div className="field-row">
              <div className="field-group">
                <label htmlFor="colaboradorId">Quem vai atender</label>
                <select id="colaboradorId" name="colaboradorId" required defaultValue="">
                  <option value="" disabled>
                    Selecione
                  </option>
                  {daCategoria.length > 0 && (
                    <optgroup label={`Atendem ${rotuloCategoria(c.categoria)}`}>
                      {daCategoria.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.nome}
                          {k.interno ? " (agente)" : k.empresa ? ` — ${k.empresa}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {outros.length > 0 && (
                    <optgroup label="Outros colaboradores">
                      {outros.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.nome}
                          {k.interno ? " (agente)" : k.empresa ? ` — ${k.empresa}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                {colaboradores.length === 0 && (
                  <p className="hint">
                    Nenhum colaborador cadastrado. <Link href="/manutencao/colaboradores">Cadastrar</Link>
                  </p>
                )}
              </div>
              <div className="field-group" style={{ maxWidth: 200 }}>
                <label htmlFor="prazoHoras">Prazo após o OK (horas)</label>
                <input
                  id="prazoHoras"
                  name="prazoHoras"
                  type="number"
                  min={1}
                  max={1440}
                  required
                  defaultValue={PRAZO_PADRAO_HORAS[c.urgencia as Urgencia] ?? 72}
                />
              </div>
            </div>
            <div className="field-group">
              <label htmlFor="observacao">Observação para o histórico (opcional)</label>
              <input id="observacao" name="observacao" maxLength={500} />
            </div>
          </FormAcao>
          <div className="btn-row" style={{ marginTop: 14 }}>
            <FormAcao
              action={recusarChamado.bind(null, c.id)}
              abrirCom="Recusar"
              classeAbrir="btn danger"
              botao="Confirmar recusa"
              classeBotao="btn danger"
            >
              <div className="field-group">
                <label htmlFor="motivo">Motivo (vai para a casa)</label>
                <textarea id="motivo" name="motivo" rows={2} required maxLength={500} />
              </div>
            </FormAcao>
            <FormAcao action={marcarDuplicado.bind(null, c.id)} abrirCom="É duplicado" botao="Marcar como duplicado">
              <div className="field-group">
                <label htmlFor="numero">Nº do chamado original</label>
                <input
                  id="numero"
                  name="numero"
                  inputMode="numeric"
                  required
                  defaultValue={duplicadosProvaveis[0]?.numero ?? ""}
                />
              </div>
            </FormAcao>
          </div>
        </div>
      )}

      {triador && (status === "ENCAMINHADO" || status === "EM_ANDAMENTO") && (
        <div className="btn-row" style={{ marginBottom: 18 }}>
          <FormAcao
            action={encaminharChamado.bind(null, c.id)}
            abrirCom="Passar para outro colaborador"
            botao="Reencaminhar"
          >
            <div className="field-row">
              <div className="field-group">
                <label htmlFor="colaboradorId2">Novo colaborador</label>
                <select id="colaboradorId2" name="colaboradorId" required defaultValue="">
                  <option value="" disabled>
                    Selecione
                  </option>
                  {[...daCategoria, ...outros]
                    .filter((k) => k.id !== c.colaboradorId)
                    .map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.nome}
                      </option>
                    ))}
                </select>
              </div>
              <div className="field-group" style={{ maxWidth: 200 }}>
                <label htmlFor="prazoHoras2">Prazo após o OK (horas)</label>
                <input id="prazoHoras2" name="prazoHoras" type="number" min={1} required defaultValue={c.prazoHoras ?? 72} />
              </div>
            </div>
            <p className="hint">O link do colaborador anterior deixa de funcionar.</p>
          </FormAcao>
        </div>
      )}

      {aprovador && status === "AGUARDANDO_APROVACAO" && (
        <div className="card destaque-aprovacao">
          <h2 className="titulo-secao">O serviço foi bem feito?</h2>
          <p className="hint" style={{ marginBottom: 12 }}>
            Confira a descrição e as fotos do serviço abaixo antes de aprovar.
          </p>
          <div className="btn-row">
            <FormAcao
              action={aprovarServico.bind(null, c.id)}
              botao="Aprovar e finalizar"
              confirmar="Aprovar o serviço e finalizar o chamado?"
            />
            <FormAcao
              action={reprovarServico.bind(null, c.id)}
              abrirCom="Reprovar"
              classeAbrir="btn danger"
              botao="Confirmar reprovação"
              classeBotao="btn danger"
            >
              <div className="field-group">
                <label htmlFor="motivoReprov">O que ficou faltando (vai para o colaborador)</label>
                <textarea id="motivoReprov" name="motivo" rows={2} required maxLength={500} />
              </div>
            </FormAcao>
          </div>
        </div>
      )}

      {status === "ABERTO" && (c.abertoPorId === user.id || user.papel === "ADMIN") && (
        <div style={{ marginBottom: 18 }}>
          <ActionButton
            action={cancelarChamado.bind(null, c.id)}
            className="btn small"
            confirmMsg="Cancelar este chamado?"
          >
            Cancelar chamado
          </ActionButton>
        </div>
      )}

      {/* ---------------- Conteúdo ---------------- */}
      <div className="duas-colunas">
        <div className="card">
          <h2 className="titulo-secao">Problema relatado</h2>
          <p className="texto-livre">{c.descricao}</p>
          <p className="hint" style={{ marginTop: 8 }}>
            Aberto por {c.abertoPor.nome} em {fmtDataHora(c.abertoEm)}
          </p>
          {fotosAbertura.length > 0 && <Fotos ids={fotosAbertura.map((f) => f.id)} />}
          {c.motivoRecusa && (
            <p className="aviso-duplicado" style={{ marginTop: 12 }}>
              <strong>{c.duplicadoDe ? "Duplicado" : "Recusado"}:</strong> {c.motivoRecusa}{" "}
              {c.duplicadoDe && <Link href={`/manutencao/${c.duplicadoDe.id}`}>ver nº {c.duplicadoDe.numero}</Link>}
            </p>
          )}
          {c.duplicatas.length > 0 && (
            <p className="hint" style={{ marginTop: 8 }}>
              Também aberto como: {c.duplicatas.map((d) => `nº ${d.numero}`).join(", ")}
            </p>
          )}
        </div>
        <div className="card">
          <h2 className="titulo-secao">Serviço executado</h2>
          {c.servicoExecutado ? (
            <>
              <p className="texto-livre">{c.servicoExecutado}</p>
              {fotosConclusao.length > 0 && <Fotos ids={fotosConclusao.map((f) => f.id)} />}
            </>
          ) : (
            <p className="hint">Ainda não concluído.</p>
          )}
          {c.reprovacoes > 0 && (
            <p className="aviso-duplicado" style={{ marginTop: 12 }}>
              Reprovado {c.reprovacoes}× pela casa. Último motivo: {c.motivoReprovacao}
            </p>
          )}
        </div>
      </div>

      <div className="duas-colunas">
        <div>
          <h2 className="titulo-secao">Datas</h2>
          <table>
            <tbody>
              {linhaTempo.map(([rotulo, data, quem]) => (
                <tr key={rotulo}>
                  <td>{rotulo}</td>
                  <td className="num sem-quebra">{fmtDataHora(data)}</td>
                  <td className="cat">{quem ?? ""}</td>
                </tr>
              ))}
              <tr>
                <td>
                  <strong>Tempo total</strong>
                </td>
                <td className="num">
                  <strong>
                    {fmtDuracao((c.finalizadoEm ?? agora).getTime() - c.abertoEm.getTime())}
                    {c.finalizadoEm ? "" : " (em curso)"}
                  </strong>
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <h2 className="titulo-secao">Histórico</h2>
          <ul className="linha-do-tempo">
            {c.eventos.map((e) => (
              <li key={e.id} className={e.tipo === "WHATSAPP_FALHOU" ? "falha" : e.tipo.startsWith("WHATSAPP") ? "whats" : ""}>
                <span className="cat">{fmtDataHora(e.criadoEm)}</span> {e.descricao}
                {e.autor ? <span className="cat"> — {e.autor}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {historicoLocal.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <h2 className="titulo-secao">Este local já teve {historicoLocal.length} chamado(s) nos últimos 6 meses</h2>
          <ul>
            {historicoLocal.map((h) => (
              <li key={h.id}>
                <Link href={`/manutencao/${h.id}`}>
                  nº {h.numero} — {h.titulo}
                </Link>{" "}
                <span className="cat">({fmtDataHora(h.abertoEm)})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!manual && envio}
    </div>
  );
}

function Fotos({ ids }: { ids: string[] }) {
  return (
    <div className="fotos-grade" style={{ marginTop: 12 }}>
      {ids.map((id) => (
        <a key={id} href={`/api/manutencao/fotos/${id}`} target="_blank" rel="noreferrer" className="foto-previa">
          <img src={`/api/manutencao/fotos/${id}`} alt="Foto do chamado" loading="lazy" />
        </a>
      ))}
    </div>
  );
}
