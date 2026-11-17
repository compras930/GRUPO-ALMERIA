// WhatsApp pela API OFICIAL da Meta (WhatsApp Business Cloud API).
//
// Mensagem que a empresa inicia só pode sair como MODELO (template) aprovado
// pela Meta. Os modelos estão abaixo com o texto exato a cadastrar no
// Gerenciador do WhatsApp — ver docs/manutencao-whatsapp.md.
//
// Enquanto a API não estiver configurada (ou se um envio falhar), nada trava:
// o chamado anda igual, o evento registra que a mensagem não saiu, e a tela do
// chamado oferece o botão "Enviar pelo meu WhatsApp" com o mesmo texto pronto.

export const IDIOMA_TEMPLATE = "pt_BR";

/**
 * Corpo de cada modelo. `{{n}}` são os parâmetros, na ordem.
 *
 * Regras da Meta que estes textos já respeitam: o corpo não começa nem
 * termina em variável, e não há duas variáveis coladas.
 */
export const TEMPLATES = {
  chamado_novo: {
    descricao: "Para o responsável da manutenção, quando uma casa abre chamado",
    corpo:
      "Novo chamado de manutenção nº {{1}} — {{2}}.\n" +
      "Categoria: {{3}}. Urgência: {{4}}.\n" +
      "Problema: {{5}}\n" +
      "Para analisar e encaminhar, acesse: {{6}}\n" +
      "Grupo Almeria · Manutenção",
  },
  chamado_encaminhado: {
    descricao: "Para o colaborador acionado (pedreiro, eletricista, agente...)",
    corpo:
      "Olá, {{1}}! Você foi acionado para o chamado nº {{2}} — {{3}}.\n" +
      "Problema: {{4}}\n" +
      "Prazo para concluir após o seu OK: {{5}}.\n" +
      "Abra o link para dar o OK e, ao terminar, registrar o serviço com fotos: {{6}}\n" +
      "Grupo Almeria · Manutenção",
  },
  chamado_para_aprovacao: {
    descricao: "Para o gerente da casa, quando o colaborador conclui o serviço",
    corpo:
      "O chamado nº {{1}} — {{2}} foi concluído por {{3}}.\n" +
      "Serviço executado: {{4}}\n" +
      "Confira as fotos e aprove ou reprove o serviço em: {{5}}\n" +
      "Grupo Almeria · Manutenção",
  },
  chamado_reprovado: {
    descricao: "Para o colaborador, quando a casa reprova o serviço",
    corpo:
      "O serviço do chamado nº {{1}} — {{2}} não foi aprovado pela casa.\n" +
      "Motivo: {{3}}\n" +
      "Veja os detalhes e registre a correção em: {{4}}\n" +
      "Grupo Almeria · Manutenção",
  },
  chamado_recusado: {
    descricao: "Para o gerente da casa, quando a manutenção recusa o chamado",
    corpo:
      "O chamado nº {{1}} — {{2}} não foi aceito pela manutenção.\n" +
      "Motivo: {{3}}\n" +
      "Detalhes: {{4}}\n" +
      "Grupo Almeria · Manutenção",
  },
  relatorio_semanal_manutencao: {
    descricao: "Resumo semanal, toda segunda-feira",
    corpo:
      "Relatório semanal da manutenção — {{1}}.\n" +
      "Abertos na semana: {{2}}. Finalizados na semana: {{3}}.\n" +
      "Em aberto agora: {{4}}. Em andamento: {{5}}. Atrasados: {{6}}.\n" +
      "Tempo médio de resolução: {{7}}.\n" +
      "Maior demanda: {{8}}.\n" +
      "Relatório completo: {{9}}\n" +
      "Grupo Almeria · Manutenção",
  },
} as const;

export type NomeTemplate = keyof typeof TEMPLATES;

export function qtdParametros(nome: NomeTemplate): number {
  return (TEMPLATES[nome].corpo.match(/\{\{\d+\}\}/g) ?? []).length;
}

/**
 * Parâmetro de modelo não pode ter quebra de linha, tabulação nem mais de 4
 * espaços seguidos (a Meta recusa o envio inteiro), e não pode ser vazio.
 */
export function sanitizarParametro(v: string | number | null | undefined, max = 600): string {
  let s = String(v ?? "")
    .replace(/[\r\n\t]+/g, " · ")
    .replace(/ {2,}/g, " ")
    .trim();
  if (!s) s = "—";
  if (s.length > max) s = `${s.slice(0, max - 1)}…`;
  return s;
}

/** O texto como o destinatário vai ler — usado no envio manual (wa.me). */
export function renderizarTemplate(nome: NomeTemplate, params: (string | number)[]): string {
  return TEMPLATES[nome].corpo.replace(/\{\{(\d+)\}\}/g, (_m, i) => sanitizarParametro(params[Number(i) - 1]));
}

/**
 * Link que abre o WhatsApp de quem clica, com a mensagem pronta. Sem telefone,
 * o próprio WhatsApp pergunta para quem enviar — é assim que se manda para um
 * GRUPO, que não tem número.
 */
export function linkWaMe(telefone: string | null, texto: string): string {
  return `https://wa.me/${telefone ?? ""}?text=${encodeURIComponent(texto)}`;
}

/** O que o botão diz em cada etapa — a ação, não o nome do modelo. */
export const CHAMADA_DO_MODELO: Record<NomeTemplate, string> = {
  chamado_novo: "Avise a manutenção",
  chamado_encaminhado: "Envie o chamado ao colaborador",
  chamado_para_aprovacao: "Avise a casa que o serviço foi concluído",
  chamado_reprovado: "Avise o colaborador da reprovação",
  chamado_recusado: "Avise a casa da recusa",
  relatorio_semanal_manutencao: "Envie o resumo da semana",
};

export function whatsappConfigurado(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export type ResultadoEnvio =
  | { ok: true; id: string | null }
  | { ok: false; motivo: string; naoConfigurado?: boolean };

/** Envia um modelo para um número (só dígitos, com DDI). Nunca lança. */
export async function enviarTemplate(
  telefone: string,
  nome: NomeTemplate,
  params: (string | number)[]
): Promise<ResultadoEnvio> {
  if (!whatsappConfigurado()) {
    return { ok: false, naoConfigurado: true, motivo: "WhatsApp ainda não configurado no sistema." };
  }
  const versao = process.env.WHATSAPP_API_VERSION || "v21.0";
  const url = `https://graph.facebook.com/${versao}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const corpo = {
    messaging_product: "whatsapp",
    to: telefone,
    type: "template",
    template: {
      name: nome,
      language: { code: IDIOMA_TEMPLATE },
      components: [
        {
          type: "body",
          parameters: params.map((p) => ({ type: "text", text: sanitizarParametro(p) })),
        },
      ],
    },
  };
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(10_000),
    });
    const json: any = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = json?.error?.error_data?.details || json?.error?.message || `HTTP ${resp.status}`;
      return { ok: false, motivo: String(msg) };
    }
    return { ok: true, id: json?.messages?.[0]?.id ?? null };
  } catch (e: any) {
    return { ok: false, motivo: e?.message || "Falha de rede ao falar com o WhatsApp." };
  }
}

/** Endereço público do app, para os links das mensagens. */
export function urlBase(): string {
  return (process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/+$/, "");
}
