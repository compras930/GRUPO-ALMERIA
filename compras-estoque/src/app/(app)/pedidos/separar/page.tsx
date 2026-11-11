import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { itensDaSemanaParaSeparar } from "@/lib/separacao-db";
import { rotuloCurto, diaEmBrasiliaPura } from "@/lib/regra-de-pedido";
import SepararPedidosForm from "@/components/SepararPedidosForm";

/**
 * Separar o pedido da semana por fornecedor, e mandar.
 *
 * Esta tela é o lugar onde a planilha geral deixa de ser necessária: ela junta
 * o pedido das quatro casas, deixa corrigir de quem vem cada item e entrega a
 * mensagem pronta, no formato que os fornecedores já leem.
 *
 * SÓ ADMIN: decide o que a empresa compra e de quem.
 */
export default async function SepararPage() {
  await requireAdmin();

  const [{ semana, itens, pedidos }, fornecedores] = await Promise.all([
    itensDaSemanaParaSeparar(),
    prisma.fornecedor.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  // Saudação pela hora de Brasília: a mensagem é mandada na hora, e "bom dia"
  // às 16h é o tipo de detalhe que faz o texto parecer automático.
  const horaBrasilia = Number(
    new Date().toLocaleString("pt-BR", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" })
  );
  const saudacao = horaBrasilia < 12 ? "Bom dia" : horaBrasilia < 18 ? "Boa tarde" : "Boa noite";

  const semFornecedor = itens.filter((i) => !i.fornecedorId).length;
  const hoje = diaEmBrasiliaPura(new Date());

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">
          <Link href="/pedidos">← Pedidos de compra</Link>
        </p>
        <h1>Separar por fornecedor</h1>
        <p className="sub-explica">
          O pedido das casas desta semana, junto. Corrija de quem vem cada item e copie a mensagem —
          uma por fornecedor, com as casas dentro, porque é uma entrega só. A troca que você fizer
          aqui vira o <strong>padrão do item</strong>: na semana que vem ele já vem separado.
        </p>
      </div>

      <div className="cards">
        <div className="card">
          <p className="eyebrow">Semana</p>
          <p className="big">{rotuloCurto(semana.inicio)}</p>
          <p className="hint">
            até {rotuloCurto(semana.fim)} · hoje é {rotuloCurto(hoje)}
          </p>
        </div>
        <div className="card">
          <p className="eyebrow">Pedidos</p>
          <p className="big">{pedidos}</p>
          <p className="hint">{itens.length} itens no total</p>
        </div>
        <div className="card">
          <p className="eyebrow">Sem fornecedor</p>
          <p className={`big${semFornecedor > 0 ? " bad" : ""}`}>{semFornecedor}</p>
          <p className="hint">
            {semFornecedor === 0
              ? "tudo separado — é o resultado bom"
              : "ninguém recebe estes até alguém decidir"}
          </p>
        </div>
      </div>

      {itens.length === 0 ? (
        <div className="empty">
          Nenhum pedido aberto nesta semana. Pedido já marcado como enviado ao fornecedor sai desta
          tela: ele virou cobrança, não decisão.
        </div>
      ) : (
        <SepararPedidosForm itens={itens} fornecedores={fornecedores} saudacao={saudacao} />
      )}
    </div>
  );
}
