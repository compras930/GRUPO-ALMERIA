# Grupo Almeria — Fichas Técnicas & Controle de CMV

Dashboard interno para controle de fichas técnicas, custos e CMV (Custo da
Mercadoria Vendida) dos pratos e vinhos das unidades do Grupo Almeria.

## Conteúdo

- **`dashboard-fichas-tecnicas.html`** — aplicativo autocontido (HTML + CSS +
  JS, sem dependências externas de build). Basta abrir o arquivo em um
  navegador para usar.

## Funcionalidades

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

## Dados

Os dados (pratos, vinhos, fichas técnicas, aliases de nomes e modos de
preparo) estão embutidos no próprio HTML como constantes JavaScript
(`DATA`, `FICHA_LOOKUP`, `ALIAS_LOOKUP`, `PREPARO_LOOKUP`). Isso mantém o
app 100% independente de backend, mas significa que toda atualização de
dados hoje é feita editando essas constantes diretamente no arquivo.

## Como usar

Abra `dashboard-fichas-tecnicas.html` em qualquer navegador moderno — não
requer servidor, instalação ou build.

## Status

Este repositório traz o dashboard desenvolvido em uma conversa anterior
com o Claude (fora deste ambiente) como ponto de partida do projeto.
Próximos passos e melhorias serão desenvolvidos a partir daqui.
