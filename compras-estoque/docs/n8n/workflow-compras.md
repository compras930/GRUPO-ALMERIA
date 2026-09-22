# Workflow "Compras Teknisa — via Google Drive"

O n8n não guarda histórico nem revisão dos workflows. Este arquivo registra a
topologia e as decisões, para quando alguém mexer e quebrar.

Estado em 22/09/2026.

## Topologia

```
Toda segunda 6h  (Schedule Trigger)
  → Drive: lista os arquivos      (search: fileFolder — 3 arquivos hoje)
  → Drive: baixa o arquivo        (download: file)
  → Le a planilha                 (Extract From XLSX)
  → Classifica por grupo          (Code — achata os 3 arquivos em ~3.365 linhas)
      ├→ Code in JavaScript       (docs/n8n/code-node-compras.js — 1 item por casa)
      │    → HTTP Request         (POST /api/n8n/precos — o app)
      └→ Sheets: compras_itens    (appendOrUpdate, match on `chave` — o painel antigo)
```

`Classifica por grupo` alimenta **dois ramos em paralelo**: o app e a planilha.

## Por que o Sheets sai de "Classifica por grupo", e não do HTTP Request

Até 22/09 o nó Sheets recebia a **resposta da API**, com *Map Automatically*.
Funcionava por acidente enquanto a resposta era pequena. Quando o Wine Garden
entrou, o campo `naoReconhecidos` veio com 589 objetos e o Google recusou a
carga: *"a entrada contém mais que o limite máximo de 50000 caracteres em uma
única célula"*.

Dois erros na mesma configuração:

1. Array serializado dentro de uma célula. O limite do Sheets é 50 mil
   caracteres, e `naoReconhecidos`, `recusadasPorCodigo`, `codigosSugeridos`,
   `precosSuspeitos` e `itensImpactados` são todos listas que crescem com o
   tamanho da carga. Ia estourar de qualquer jeito, mais cedo ou mais tarde.
2. *Column to match on* estava em `chave`, campo que **não existe** na resposta
   da API — quem tem `chave` é a linha de compra. O cabeçalho real da aba
   (`chave, unidade, data, produto, …`) confirma: a aba sempre foi feita para
   guardar item de nota, não resumo de carga.

A correção foi religar o nó na saída de `Classifica por grupo`, que emite uma
linha por item, com `chave`. Nenhuma célula chega perto do limite.

## Isto é redundância consciente, e é temporária

O mesmo dado passa a viver em dois lugares: o Postgres do app e a planilha do
painel antigo. Redundância envelhece mal — um dia os dois divergem e ninguém
sabe qual está certo.

O ramo do Sheets existe só enquanto o painel de compras estiver fora do app.
Quando ele for migrado para dentro, **desligar o nó `Sheets: compras_itens`** é
parte da migração, não um detalhe a decidir depois.

## Casas

Ver `MAPA_CASA` em `docs/n8n/code-node-compras.js`.

- **104 Sul**, **Noroeste**, **Wine Garden** — Teknisa, passam por este workflow
- **Beira Lago**, **CPD** — XMenu, **não** passam por aqui. Outra planilha, outro
  espaço de código de produto, sem coluna `chave`. Mandá-los por este node
  gravaria código do XMenu em `Produto.codigoTeknisa` (que é unique global) e
  removeria a proteção contra recarga de estoque. Precisa de mudança no app —
  um código por origem, como `ItemVenda.codigoPdv` já faz do lado da venda.

## O que conferir quando algo parecer errado

- `_unidadesNaPlanilha`, na saída do Code node: conta toda casa que apareceu na
  planilha, mapeada ou não. Foi por ele que o Wine Garden apareceu com 1.145
  linhas sendo descartadas.
- `linhasJaCarregadas`, na resposta da API: quando vem igual a `totalRecebido`,
  nada era novo — é o comportamento correto ao reexecutar no mesmo dia.
