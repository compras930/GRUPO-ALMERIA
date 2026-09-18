// Node "Code" do workflow "Compras Teknisa" do n8n.
//
// Entra: as linhas da planilha "Base Compras Almeria" (Google Sheets), uma
// linha por item de nota. Colunas usadas: chave, unidade, data, codigoProduto,
// produto, un, quantidade, valorUnitario, valorTotal.
//
// Sai: um item por casa, no formato que POST /api/n8n/precos espera —
// { unidade, arquivoNome, aprenderCodigos, itens: [...] }.
//
// Fica versionado aqui porque o node vive dentro do n8n, onde não tem
// histórico nem revisão: quando alguém mexer e quebrar, este arquivo é o que
// diz como era.
//
// QUATRO COISAS QUE ESTE NODE FAZ DE PROPÓSITO:
//
// 1. Manda `codigo` (o codigoProduto do Teknisa). É o que faz a API casar por
//    identificador em vez de por nome — ver src/lib/resolucao-produto-compra.ts.
//    Sem este campo, a carga volta a reconhecer 41% das linhas em vez de todas.
//
// 2. Manda `chave`, `quantidade` e `valorTotal`, e por isso manda NOTA POR
//    NOTA, sem agrupar por produto.
//
//    A versão anterior mandava uma linha por produto, a compra mais recente —
//    o suficiente pra preço. Estoque precisa de todas: o saldo é a soma do que
//    entrou, não o último preço praticado. E cada linha precisa da própria
//    `chave` (a coluna que o Teknisa monta como empresa|data|documento|
//    produto|sequência), porque é ela que permite rodar o workflow de novo sem
//    somar a mesma mercadoria duas vezes. Preço aguenta recarga; estoque não.
//
// 3. Não engole casa desconhecida em silêncio. Toda casa que aparece na
//    planilha é contada em `_unidadesNaPlanilha`, mapeada ou não. Foi assim
//    que ficou visível que o Wine Garden não estava na base — e não que o
//    workflow o estivesse perdendo.
//
// 4. `aprenderCodigos: true` deixa a API gravar o código do Teknisa no produto
//    quando a linha casou por nome+unidade exatos. Sem isso, cada produto novo
//    do Teknisa exigiria um UPDATE colado à mão.

const MAPA_CASA = {
  "104 SUL": "104 Sul",
  "CASA NORO": "Noroeste",
  // Conferir no `_unidadesNaPlanilha` da saída como a casa aparece escrita na
  // planilha e completar aqui. O nome da direita tem que ser EXATAMENTE o
  // Unidade.nome cadastrado no app.
  // "WINE GARDEN": "Wine Garden",
  // "BEIRA LAGO": "Beira Lago",
};

const norm = (v) => String(v ?? "").trim().toUpperCase();

// A planilha traz número com vírgula decimal ("74,9"). Quando tem vírgula, o
// ponto é separador de milhar; quando não tem, o ponto é o decimal.
const numero = (v) => {
  if (typeof v === "number") return v;
  let s = String(v ?? "").trim();
  if (s === "") return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const unidadesNaPlanilha = {};
const porCasa = new Map();

for (const item of $input.all()) {
  const r = item.json;

  const chaveCasa = norm(r.unidade);
  unidadesNaPlanilha[chaveCasa] = (unidadesNaPlanilha[chaveCasa] ?? 0) + 1;

  const casa = MAPA_CASA[chaveCasa];
  if (!casa) continue; // aparece no diagnóstico, não some calado

  const preco = numero(r.valorUnitario);
  if (preco === null || preco <= 0) continue;

  const linha = {
    nome: String(r.produto ?? "").trim(),
    unidadeMedida: String(r.un ?? "").trim(),
    preco,
    dataCompra: String(r.data ?? "").slice(0, 10),
    codigo: String(r.codigoProduto ?? "").trim(),
    quantidade: numero(r.quantidade),
    valorTotal: numero(r.valorTotal),
    chave: String(r.chave ?? "").trim(),
  };
  if (!linha.nome || !linha.unidadeMedida || !linha.dataCompra) continue;

  porCasa.set(casa, [...(porCasa.get(casa) ?? []), linha]);
}

const saida = [...porCasa.entries()].map(([unidade, itens]) => ({
  json: {
    unidade,
    arquivoNome: "Base Compras Almeria",
    aprenderCodigos: true,
    itens,
    // A API ignora campo que não conhece; isto existe só pra aparecer na tela
    // do n8n. Se uma casa não estiver no MAPA_CASA, é aqui que ela aparece.
    _unidadesNaPlanilha: unidadesNaPlanilha,
  },
}));

// Nenhuma casa mapeada: devolve só o diagnóstico, em vez de devolver nada e
// deixar a pessoa olhando pra uma saída vazia sem explicação.
if (saida.length === 0) return [{ json: { _erro: "Nenhuma casa do MAPA_CASA apareceu na planilha", _unidadesNaPlanilha: unidadesNaPlanilha } }];

return saida;
