import { fmtTelefone } from "@/lib/manutencao/regras";
import type { Destinatario } from "@/lib/manutencao/notificar";
import { linkWaMe } from "@/lib/manutencao/whatsapp";

/**
 * O envio MANUAL: um botão por destinatário cadastrado, que abre o WhatsApp de
 * quem clica com a mensagem pronta, e um para escolher na hora (contato fora
 * do cadastro, ou o grupo da manutenção).
 */
export default function EnvioWhatsapp({
  titulo,
  texto,
  destinos,
  destaque,
  rodape,
}: {
  titulo: string;
  texto: string;
  destinos: Destinatario[];
  destaque?: boolean;
  rodape?: React.ReactNode;
}) {
  return (
    <div className={`card envio-whats${destaque ? " destaque" : ""}`}>
      <h2 className="titulo-secao">📲 {titulo}</h2>
      <p className="hint" style={{ marginBottom: 10 }}>
        Toque no botão: o WhatsApp abre com a mensagem pronta, é só enviar.
      </p>
      <div className="btn-row">
        {destinos.map((d) => (
          <a
            key={d.telefone}
            className="btn primary small"
            href={linkWaMe(d.telefone, texto)}
            target="_blank"
            rel="noreferrer"
          >
            Enviar para {d.nome} ({fmtTelefone(d.telefone)})
          </a>
        ))}
        <a className="btn small" href={linkWaMe(null, texto)} target="_blank" rel="noreferrer">
          Escolher contato ou grupo
        </a>
      </div>
      {rodape}
    </div>
  );
}
