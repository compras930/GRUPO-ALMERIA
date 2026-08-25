# Grupo Almeria — Sistemas internos

Este repositório reúne as ferramentas internas do Grupo Almeria para dar
ordem a processos hoje espalhados entre planilhas, sistemas soltos e
conversas informais.

## Projetos

### 1. [`compras-estoque/`](./compras-estoque) — Compras & Estoque

Sistema web multi-unidade e multi-usuário: pedidos de compra, recebimento
com conferência (pedido × recebido) e controle de estoque por unidade, com
papéis de acesso (solicitante, aprovador, recebedor, admin). Veja o
[README do projeto](./compras-estoque/README.md) para detalhes, como rodar
localmente e como publicar.

### 2. `dashboard-fichas-tecnicas.html` — Fichas Técnicas & Controle de CMV

Dashboard interno para controle de fichas técnicas, custos e CMV (Custo da
Mercadoria Vendida) dos pratos e vinhos das unidades do Grupo Almeria.

**Conteúdo**: aplicativo autocontido (HTML + CSS + JS, sem dependências
externas de build) — basta abrir o arquivo em um navegador.

**Funcionalidades**:
- Seleção de unidade: Beira Lago, 104 Sul, Noroeste, Matri, Wine Garden.
- Abas separadas para **Pratos** (ficha técnica) e **Vinhos**.
- KPIs por unidade/aba: total de itens, CMV médio, maior/menor CMV, meta de CMV.
- Filtro por categoria, busca por nome e ordenação por coluna.
- Ficha técnica detalhada por prato: lista de ingredientes/insumos, com
  suporte a **subprodutos** (drill-down para a receita do subproduto).
- Edição de ficha técnica: adicionar/remover ingredientes, editar
  quantidade e custo unitário, com recálculo automático do custo total e CMV.
- Adicionar novo prato/vinho ou marcar um item para remoção.
- Exportação das alterações pendentes da sessão em `.csv`.
- Geração de PDF (via impressão do navegador) da ficha técnica de um prato.

**Dados**: pratos, vinhos, fichas técnicas, aliases de nomes e modos de
preparo estão embutidos no próprio HTML como constantes JavaScript (`DATA`,
`FICHA_LOOKUP`, `ALIAS_LOOKUP`, `PREPARO_LOOKUP`). Isso mantém o app 100%
independente de backend, mas significa que toda atualização de dados hoje é
feita editando essas constantes diretamente no arquivo.

## Unidades do grupo

Beira Lago · 104 Sul · Noroeste · Matri · Wine Garden

## Status

Este repositório nasceu vazio e vem sendo construído incrementalmente:
primeiro o dashboard de fichas técnicas (trazido de uma conversa anterior),
agora o sistema de Compras & Estoque. Próximas frentes (comunicação entre
unidades, eventos/orçamentos, etc.) entram aqui conforme priorizadas.
