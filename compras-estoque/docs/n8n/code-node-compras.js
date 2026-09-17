// Node "Code" do workflow "Compras Teknisa" do n8n.
//
// Entra: as linhas da planilha "Base Compras Almeria" (Google Sheets), uma
// linha por item de nota. Colunas usadas: unidade, data, codigoProduto,
// produto, un, valorUnitario.
//
// Sai: um item por casa, no formato que POST /api/n8n/precos espera —
// { unidade, arquivoNome, itens: [{ nome, unidadeMedida, preco, dataCompra,
// codigo }] }.
//
// Fica versionado aqui porque o node vive dentro do n8n, onde não tem
// histórico nem revisão: quando alguém mexer e quebrar, este arquivo é o que
// diz como era.
//
// TRÊS COISAS QUE ESTE NODE FAZ DE PROPÓSITO:
//
// 1. Manda `codigo` (o codigoProduto do Teknisa). É o que faz a API casar por
//    identificador em vez de por nome — ver src/lib/resolucao-produto-compra.ts.
//    Sem este campo, a carga volta a reconhecer só 41% das linhas.
//
// 2. Não engole casa desconhecida em silêncio. Toda casa que aparece na
//    planilha é contada em `_unidadesNaPlanilha`, mapeada ou não. Foi assim
//    que ficou visível que o Wine Garden estava sumindo aqui dentro, e não na
//    origem.
//
// 3. Manda uma linha por produto, a compra mais recente. A planilha tem ~2200
//    linhas de nota; mandar todas estoura o tempo da função da Vercel, e a API
//    descartaria as antigas de qualquer jeito (só sobrescreve preço se a data
//    for mais recente). A escolha de qual fica é feita aqui, pelo código do
//    produto quando ele existe.

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
const porCasa = new Map(); // casa -> Map(chaveProduto -> linha)

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
  };
  if (!linha.nome || !linha.unidadeMedida || !linha.dataCompra) continue;

  // Chave por código quando ele existe: é o que identifica o produto de
  // verdade. Nome+unidade só como reserva, pra linha velha sem código.
  const chaveProduto = linha.codigo || `${norm(linha.nome)}|||${norm(linha.unidadeMedida)}`;

  const daCasa = porCasa.get(casa) ?? new Map();
  const anterior = daCasa.get(chaveProduto);
  if (!anterior || linha.dataCompra > anterior.dataCompra) daCasa.set(chaveProduto, linha);
  porCasa.set(casa, daCasa);
}

const saida = [...porCasa.entries()].map(([unidade, itens]) => ({
  json: {
    unidade,
    arquivoNome: "Base Compras Almeria",
    itens: [...itens.values()],
    // A API ignora campo que não conhece; isto existe só pra aparecer na tela
    // do n8n. Se uma casa não estiver no MAPA_CASA, é aqui que ela aparece.
    _unidadesNaPlanilha: unidadesNaPlanilha,
  },
}));

// Nenhuma casa mapeada: devolve só o diagnóstico, em vez de devolver nada e
// deixar a pessoa olhando pra uma saída vazia sem explicação.
if (saida.length === 0) return [{ json: { _erro: "Nenhuma casa do MAPA_CASA apareceu na planilha", _unidadesNaPlanilha: unidadesNaPlanilha } }];

return saida;
