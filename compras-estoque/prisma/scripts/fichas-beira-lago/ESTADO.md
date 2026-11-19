# Fichas do Beira Lago — onde paramos (19/11)

## O que está pronto

**Cozinha.** 201 fichas no app, **104 completas** (eram 88). Os SQL de 1 a 16
já rodaram em produção, na ordem. Todos são seguros de repetir.

**Drinks.** 51 fichas no app, rendimento 1 UND cada (a ficha inteira é uma
dose), com ~156 de 197 ingredientes ligados. O gelo saiu da conta por decisão
da casa — e saiu também do *esperado*, senão nenhum drink com gelo poderia
ficar completo.

**Produções do bar.** Xarope simples (1,6 L) e sumo de limão viraram ficha.
São 43 dos 52 drinks. **O rendimento de 1 L do sumo é leitura minha**, a
partir de "3 kg" — confirmar com o bar; é um número no `15-producoes-bar.sql`.

## A descoberta que muda o projeto

**A bebida do Beira Lago entra pelo XMENU, não pelo Teknisa.** A Listagem de
entrada de mercadoria do Xmenu tem 64 bebidas com unidade em LITRO e preço por
litro calculado — Maker's Mark, Buffalo Trace, Peachtree, Dolin, Laphroaig,
Chita — e nenhuma delas jamais apareceu em nota do Teknisa.

Enquanto o app ler só o Teknisa, o estoque de bebida da casa tem **saída** (as
fichas, agora) e **não tem entrada**: vai acusar falta crescente em tudo que o
bar consome. É o mesmo mecanismo do robalo grelhado, que acumulou −260 kg, só
que em 64 produtos.

Decisão tomada: **escrever o importador da entrada do Xmenu**. O arquivo é
exportável toda semana, no mesmo formato.

## Próximo passo: o importador do Xmenu

Formato da Listagem (uma linha por item de nota, cabeçalho em duas linhas):

| col | conteúdo |
|-----|----------|
| 0   | ID. Entrada Mercadoria |
| 1   | Fornecedor |
| 2   | Data |
| 4   | CNPJ do fornecedor |
| 8   | NotaFiscal |
| 9   | Cód. Produto  ← **a identidade; é por aqui que se casa, nunca por nome** |
| 10  | Cód. Produto Fornecedor |
| 11  | Produto (nome) |
| 12  | Grupo / 13 Subgrupo |
| 15  | Quantidade |
| 16  | Unidade (já vem LT para garrafa) |
| 17  | Valor Unitário (já por litro) |

Pontos de atenção, todos já conhecidos deste projeto:

- **Casar por `Cód. Produto`**, com `CodigoCompraProduto`. Nome é só para
  sugerir um par a um humano.
- A unidade já vem em LT e o preço **já é por litro** — ao contrário do
  Teknisa, não há conversão a fazer. Conferir antes de confiar.
- Linha duplicada: a Listagem repete a mesma entrada quando a nota tem mais de
  um item. Chave de deduplicação: (ID. Entrada, Cód. Produto).
- Preço entra em `PrecoAtualProduto`; custo nunca é coluna gravada.
- `ItemNotaCompra.chaveOrigem` precisa de uma chave estável para a origem
  Xmenu, separada da do Teknisa.

## Pendências de gente (não de SQL)

**Bar**
- Confirmar o rendimento do sumo de limão (3 kg → 1 L?).
- Seis produções sem receita: xarope de framboesa, de gengibre, concentrado de
  laranja, mel fermentado, clarificação de morango, sumo de laranja pera.
  Preciso do que entra e de quanto rende.
- `ESPUMANTE 1913`: volume da garrafa (750 ml?).
- `ST PIERRE PALOMA`: não é nenhuma das três St Pierre que a casa compra.
- Garrafas que não aparecem em lugar nenhum: Nordés, Gordon's, Peychaud's,
  Weber Haus, chá Lapsang, Umeshu, sake Miyako, Stoli, Carpano Dry e Bianco,
  Tequila 1800 Silver. O Xmenu tem `DOLIN DRY VERMOUTH` — serve no lugar do
  Carpano Dry?

**Chef**
- Steak au poivre: picadinho ou filé? Entra batata?
- Falafel: gramas de massa por porção. **A ficha do app não contém falafel
  nenhum** — o prato é vendido e o grão de bico nunca baixa do estoque.

**App (meu)**
- Tela "Ligar prato à ficha" está no ar e ainda não foi usada. Sem o vínculo,
  nada disso vira CMV teórico.
- `ROBALO GRELHADO`, saldo −260 kg: é preparo cadastrado como produto. Vira
  ficha quando a cozinha disser o rendimento da grelha.
