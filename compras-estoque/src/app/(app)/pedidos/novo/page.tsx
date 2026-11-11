import { prisma } from "@/lib/prisma";
import { unidadesComEstoqueProprio } from "@/lib/unidade-fisica";
import { requireSession } from "@/lib/session";
import { podeCriarPedido } from "@/lib/permissions";
import { avaliarPedidoDaCasa } from "@/lib/pedido-semana-db";
import { carregarContexto } from "@/lib/selecao-db";
import NovoPedidoForm from "@/components/NovoPedidoForm";
import PedidoDaListaForm from "@/components/PedidoDaListaForm";
import { listaDaCasa } from "@/lib/lista-pedido-db";

export default async function NovoPedidoPage({
  searchParams,
}: {
  searchParams: { unidadeId?: string };
}) {
  const user = await requireSession();
  if (!podeCriarPedido(user.papel)) {
    return <div className="empty">Seu papel não permite criar pedidos de compra.</div>;
  }

  const ctx = await carregarContexto(
    { papel: user.papel, unidadeId: user.unidadeId ?? null },
    searchParams
  );
  const unidadeDoPedido = user.papel === "ADMIN" ? ctx.casaId : user.unidadeId;

  const [unidades, fornecedores, produtos] = await Promise.all([
    unidadesComEstoqueProprio(),
    prisma.fornecedor.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    // Select explícito: ver o comentário em estoque/contagem/page.tsx.
    prisma.produto.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, unidadeMedida: true },
    }),
  ]);

  // A diretriz da semana — ver src/lib/regra-de-pedido.ts. Avaliada aqui só
  // para a tela já abrir dizendo o que é este pedido; quem decide de verdade é
  // a ação, no momento de gravar.
  const avaliacao = unidadeDoPedido ? await avaliarPedidoDaCasa(unidadeDoPedido) : null;
  // A lista da casa, quando existe, é o caminho principal: é a planilha que o
  // gerente já preenche. O formulário antigo (produto do cadastro, um
  // fornecedor) continua para quem não tem lista e para pedido fora dela.
  const secoes = unidadeDoPedido ? await listaDaCasa(unidadeDoPedido) : [];

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">Pedidos de compra</p>
        <h1>Novo pedido</h1>
        <p className="sub-explica">
          A lista da casa, do jeito que você já preenche na planilha: desça as seções e escreva a
          quantidade só do que precisa. O pedido é <strong>um por semana</strong>, de preferência na
          segunda; pedido a mais sai do mesmo jeito, só precisa dizer <strong>por quê</strong>.
        </p>
      </div>

      {!unidadeDoPedido ? (
        <div className="empty">Escolha uma casa no menu — o pedido é de uma casa.</div>
      ) : secoes.length > 0 ? (
        <div className="card">
          <PedidoDaListaForm
            unidadeId={unidadeDoPedido}
            secoes={secoes}
            diretriz={{
              tipo: avaliacao!.tipo,
              aviso: avaliacao!.aviso,
              jaFeitos: avaliacao!.jaFeitos,
              diaPreferido: avaliacao!.semana.diaPreferido,
              feriado: avaliacao!.semana.feriadoQueEmpurrou,
              numerosDaSemana: avaliacao!.pedidos.map((p) => p.numero),
            }}
          />
        </div>
      ) : (
        <div className="card">
          <NovoPedidoForm
            unidades={unidades}
            fornecedores={fornecedores}
            produtos={produtos}
            unidadeFixaId={unidadeDoPedido}
            diretriz={{
              tipo: avaliacao!.tipo,
              aviso: avaliacao!.aviso,
              jaFeitos: avaliacao!.jaFeitos,
              diaPreferido: avaliacao!.semana.diaPreferido,
              feriado: avaliacao!.semana.feriadoQueEmpurrou,
              numerosDaSemana: avaliacao!.pedidos.map((p) => p.numero),
            }}
          />
        </div>
      )}
    </div>
  );
}
