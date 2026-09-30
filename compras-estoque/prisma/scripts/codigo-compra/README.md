# Um produto, vários códigos de compra — roteiro de aplicação

O que aplicar, em que ordem, e onde parar se algo não bater.

**Aplicar só depois da contagem de segunda, 28/09.** Não porque a contagem
dependa disto — não depende —, mas porque duas frentes abertas no mesmo dia é
como um erro de uma vira diagnóstico errado da outra. A carga de compras roda
às 6h; a contagem, à noite; isto aqui, depois das duas.

## Por quê

`Produto.codigoTeknisa` guarda **um** código por produto. O Teknisa tem um
código **por embalagem**: o litro de leite é `105060008520`, a caixa com doze é
`105060008521`. Cabe um só, e o outro nunca casa. Criar um segundo produto
"Leite integral 12x1L" resolveria o pareamento e quebraria toda ficha que usa o
primeiro — o custo passaria a sair de dois lugares.

No dado real das três casas em 23/09: **107 códigos e R$ 86.794** de compra
travados exatamente nisso, nenhum deles precisando de decisão humana.

E é a mesma mudança que destrava Beira Lago e CPD, que compram pelo XMenu: lá o
espaço de código é outro, e nada garante que "1042" do XMenu não seja "1042" do
Teknisa.

## Ordem

Cada passo é idempotente — rodar duas vezes não duplica nem quebra. Isso foi
verificado rodando duas vezes, não lendo o SQL.

### 1. As duas migrações, no editor do Neon

```
prisma/migrations/20260923170000_codigo_compra_produto/migration.sql
prisma/migrations/20260924100000_item_nota_compra_origem/migration.sql
```

A primeira cria `CodigoCompraProduto`. A segunda acrescenta
`ItemNotaCompra.origemBruta`. Nenhuma das duas apaga nada: `codigoTeknisa` e
`ConversaoUnidadeCompra` continuam onde estão.

### 2. Copiar o que já existe

```
prisma/scripts/codigo-compra/1-migrar-codigos-existentes.sql
```

Seis passos, um de cada vez. O objetivo é **empate, não melhoria**: depois
disto, toda linha que casa hoje casa igual, e toda linha recusada hoje continua
recusada. Ganho nenhum é esperado aqui.

Onde parar:

| Passo | Resultado certo | Se vier diferente |
|---|---|---|
| 3 | `linhas_fator_1` = `produtos_com_codigo` | pare — a cópia não pegou tudo |
| 4 | **zero linhas** | pare — alguma linha que casa hoje deixaria de casar |
| 5 | só produto sem `codigoTeknisa` | qualquer outro motivo: investigue |
| 6 | **zero linhas** | um código em dois produtos — corrija o cadastro |

### 3. Provar que nada mudou de comportamento

Contra uma **cópia** do banco (o script só lê, mas o hábito é o que protege):

```
DATABASE_URL=... npx tsx prisma/scripts/codigo-compra/_conferir-paridade.ts
```

Tem que dar **zero divergências**. Ele roda as duas resoluções lado a lado,
para cada linha de compra gravada e para todo par (código × unidade possível).

Com a versão errada do passo 2 da cópia — a que eu escrevi primeiro, que fazia
`UPDATE` trocando a unidade em vez de `INSERT` — ele acusa 4 divergências e sai
com código 1. As contagens de conferência batiam todas mesmo assim. É por isso
que este passo existe.

### 4. Só então, a rota

Um commit, com quatro coisas que precisam entrar juntas:

1. `nota-compra.ts` carrega `CodigoCompraProduto` e passa como terceiro
   argumento de `montarIndiceProdutos` — que já aceita, e já tem teste provando
   que com a lista vazia o comportamento é idêntico ao de hoje.
2. A rota aceita `origem` no corpo do POST (não por item). Omitido = `TEKNISA`.
3. `aprenderCodigos` passa a gravar em `CodigoCompraProduto`, com a origem da
   carga, em vez de `Produto.codigoTeknisa`. **Até isso existir, toda carga do
   XMenu tem que mandar `aprenderCodigos: false`** — senão um código do XMenu
   vai parar em `codigoTeknisa` e contamina as três casas que hoje funcionam.
4. As linhas gravadas passam a levar `origemBruta`.

Se algo der errado até aqui, `DELETE FROM "CodigoCompraProduto"` devolve o
sistema ao estado de hoje sem perder nada — é por isso que a cópia vem antes da
rota, e não junto.

## Depois, não agora

- Atualizar as consultas de pareamento para agrupar por
  `(COALESCE("origemBruta", 'TEKNISA'), "codigoBruto")`. Sem isso, com duas
  origens na tabela, elas somam espaços de código diferentes.
- Cadastrar os 107 códigos de segunda embalagem. É onde o ganho aparece.
- Remover `Produto.codigoTeknisa` e `ConversaoUnidadeCompra`, depois de uma
  carga semanal inteira rodar limpa pela tabela nova. Outubro.
