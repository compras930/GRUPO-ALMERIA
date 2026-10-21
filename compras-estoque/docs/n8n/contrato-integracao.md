# Contrato de integração com o painel de compras (n8n)

O que o n8n manda para o app, campo a campo. Escrito para ser repassado a quem
constrói o painel — não assume conhecimento deste repositório.

**O n8n empurra, o app não puxa.** As rotas abaixo já existem e esperam um
POST. Não há API de leitura a ser consumida no sentido contrário, e construir
uma significaria refazer do zero o controle de recarga, a autenticação e o
relatório de erro que estas rotas já têm.

## Autenticação, nas duas rotas

```
Authorization: Bearer <N8N_API_TOKEN>
Content-Type: application/json
```

O token é o mesmo valor configurado na variável de ambiente `N8N_API_TOKEN` do
app. Sem ele, ou com ele errado: **401**.

Base: `https://grupo-almeria-six.vercel.app`

---

# 1. Compras — `POST /api/n8n/precos`

Já roda em produção para as três casas do Teknisa desde setembro, ~2.200 linhas
por semana. Beira Lago entra pelo mesmo caminho, com um mapeamento diferente.

## Corpo

| campo | tipo | obrigatório | o que é |
|---|---|---|---|
| `unidade` | string | **sim** | nome EXATO da casa no app: `"Beira Lago"` |
| `arquivoNome` | string | não | de onde veio a carga; aparece no histórico |
| `aprenderCodigos` | boolean | não | **mandar `false`** — ver abaixo |
| `itens` | array | **sim** | não pode ser vazio |

Cada item de `itens`:

| campo | tipo | obrigatório | o que é |
|---|---|---|---|
| `nome` | string | **sim** | nome do produto, cru, como a origem escreve |
| `unidadeMedida` | string | **sim** | unidade de compra: KG, LT, UND, CX |
| `preco` | number | **sim** | preço **unitário** |
| `dataCompra` | string | **sim** | data da nota, `"2026-08-01"` |
| `chave` | string | **sim na prática** | identidade da linha; sem ela o estoque não entra |
| `quantidade` | number | não | quantidade comprada |
| `valorTotal` | number | não | valor da linha |
| `codigo` | string | **não mandar (XMenu)** | ver abaixo |

## Quatro regras que não são detalhe

**1. Não mande `codigo` para o XMenu.**

O app guarda um código por produto, e esse espaço já é do Teknisa. Um código do
XMenu com o mesmo número casaria com o produto errado — em silêncio, porque
para o sistema casar por código é o caminho mais confiável que existe. Sem o
campo, o app casa por **nome + unidade**, que é exatamente o que queremos aqui.

O casamento por nome ignora maiúscula/minúscula e espaço sobrando, e ainda tenta
remover sufixo de unidade repetido no nome (`"ALCATRA BOVINO KG"` com unidade
`KG`). Não precisa normalizar nada na origem — **não normalize**.

**2. `aprenderCodigos` tem que ser `false`.**

Com `true`, uma linha que casa por nome faz o app gravar o código enviado no
cadastro do produto. Com código do XMenu, isso contamina as três casas que hoje
funcionam, na carga da segunda seguinte.

**3. `preco` é unitário, e deve incluir impostos e frete.**

O app guarda preço unitário e multiplica. Para o custo bater com o que a casa
realmente pagou:

```
preco      = (total_liquido > 0 ? total_liquido : valor_total) / quantidade
valorTotal = total_liquido
```

Usar `valor_unitario` cru deixaria ICMS-ST, IPI e frete de fora do CMV. No
export de 01/08 a 19/10 a diferença é de **R$ 39.127 — 3,19%** no total, e em
linhas isoladas chega a muito mais: Alma Viva +20%, Sobrassada +35%, Chopp
Brahma +117%.

**O `> 0` não é paranoia.** Há 15 linhas em que `total_liquido` é MENOR que
`valor_total`, e uma delas é zero:

```
FEIJÃO CARIOCA 1KG - FUNCIONÁRIO    valor_total 88,77  →  total_liquido 0,00
```

Provavelmente bonificação. Com `preco = 0`, o app grava **custo zero** naquele
produto — e se for produto novo não há preço anterior para a trava de salto
comparar, então o zero passa. Todo prato que usar aquele insumo fica com custo
subestimado, e o CMV sai bonito e errado. Cair para o valor sem imposto é pior
que o certo e muito melhor que zero.

Nenhuma linha do export tem quantidade zero ou negativa, então a divisão é
segura — mas vale guardar contra isso também se o painel passar a mandar
devolução.

**4. `chave` é o que impede o estoque dobrar.**

Linha sem `chave` tem o **preço aceito e a quantidade recusada** — ela aparece
em `entradasSemChave` na resposta. É assim de propósito: sem identidade de
linha, cada reexecução do workflow somaria a mesma mercadoria de novo, e
estoque inflado faz o CMV parecer bom.

Para o XMenu a chave existe, só não é uma coluna só. No export de 01/08 a
19/10, o par `(id_entrada, sequencia)` é **único nas 2.990 linhas** — inclusive
nas três linhas idênticas dentro da mesma nota, que têm sequências diferentes e
portanto contam as duas, como devem.

```
chave = "XMENU|" + id_entrada + "|" + sequencia
```

Tem que ser a MESMA string sempre para a mesma linha. Com isso não é preciso
apagar e reinserir nada: a carga pode rodar quantas vezes quiser.

## Exemplo

```json
{
  "unidade": "Beira Lago",
  "arquivoNome": "XMenu — compras Beira Lago",
  "aprenderCodigos": false,
  "itens": [
    {
      "nome": "AGUA PRATA RETORNÁVEL S/G 300ML",
      "unidadeMedida": "UND",
      "preco": 3.8991666667,
      "quantidade": 48,
      "valorTotal": 187.16,
      "dataCompra": "2026-08-01",
      "chave": "XMENU|56626|1"
    }
  ]
}
```

## De onde sai cada campo, no CSV do painel

| campo do JSON | coluna do CSV |
|---|---|
| `nome` | `nome` (cru, sem tratar) |
| `unidadeMedida` | `unidade` — **não** `unidade_estoque` |
| `quantidade` | `quantidade` |
| `valorTotal` | `total_liquido` |
| `preco` | `total_liquido / quantidade` |
| `dataCompra` | `data` |
| `chave` | `"XMENU\|" + id_entrada + "\|" + sequencia` |

**Ignore `unidade_estoque` e `fator`.** No export inteiro, `fator` é **sempre
1** — não há conversão nenhuma ali. E `unidade_estoque` tem 18 valores
inconsistentes (MC, FA, VD, GL...), com pares sem sentido como "KG → MC fator
1". A coluna `unidade` tem 5 valores limpos e é a que serve.

`PCT` é mapeado para `CX` pela tabela de sinônimos do app
(`SINONIMO_UNIDADE`, em `src/lib/resolucao-produto-compra.ts`) — mande `PCT`
mesmo, a tradução é do nosso lado. **Isso vale para a linha, e por isso vale
também para o cadastro:** o produto tem que estar cadastrado em `CX`, não em
`PCT`, senão a busca não acha nada e a linha volta como "não reconhecida" sem
nenhuma pista. Foi o que aconteceu com as 75 linhas em PCT da primeira carga.

## Cuidado que derruba a carga inteira

Se `quantidade` vier como **texto** em vez de número, a rota devolve **400 e
recusa a carga toda**. É proposital: quantidade errada infla saldo em silêncio.
Converta no painel.

## O que olhar na resposta

A resposta não é um "ok". É o relatório da carga, e é o alarme de que alguma
coisa mudou na origem:

| campo | o que significa quando cresce |
|---|---|
| `naoReconhecidos` | nome que não casou com nenhum produto |
| `entradasSemChave` | linha sem `chave` — estoque NÃO entrou |
| `recusadasPorCodigo` | contradição de código ou unidade |
| `precosSuspeitos` | preço saltou 5x ou mais — quase sempre unidade trocada |
| `precosPrimeiraVez` | preço que entrou SEM comparação possível — ver abaixo |
| `linhasJaCarregadas` | linha repetida e pulada; igual a `totalRecebido` significa "nada era novo", que é o certo ao reexecutar |

Também vêm `precosAtualizados`, `casadosPorCodigo`, `casadosPorNome`,
`entradasDeEstoque` e `itensImpactados`.

**Combine com quem opera: essa resposta é para ser lida.** Se
`naoReconhecidos` pular de 20 para 300, alguém renomeou coisa na origem — e a
carga vai continuar respondendo 200.

## `precosSuspeitos` vazio não quer dizer "preços bons"

A trava de salto compara o preço recebido com o **anterior**. Produto que
ainda não tinha preço nesta despensa não tem anterior — então o primeiro
valor entra inteiro, seja ele qual for, e `precosSuspeitos` volta vazio.

Não é defeito: é o único comportamento possível sem referência. O que dava
para consertar era o silêncio, e é o que `precosPrimeiraVez` faz — ela lista
todo preço que entrou sem comparação, com produto e valor.

Isso morde justamente na **primeira carga de uma casa**, quando todo produto é
novo. No Beira Lago foram 395 de uma vez, com `precosSuspeitos` vazio, e no
meio deles a SALSA CRESPA a R$ 150/kg contra uma mediana de R$ 46 no próprio
período — maço lançado como quilo na origem. Esse número vira custo de toda
ficha que use salsa.

Da segunda carga em diante a lista tende a zero. Um número alto fora da
primeira vez quer dizer que alguém cadastrou produto novo, ou que a origem
renomeou alguma coisa.

---

# 2. Vendas — `POST /api/n8n/vendas-semanais`

A rota existe desde o começo do projeto e **nunca rodou**, porque dependia de
um export do Teknisa que não saía. Se o painel já tem a venda do Beira Lago,
ela entra por aqui.

## Corpo

| campo | tipo | obrigatório | o que é |
|---|---|---|---|
| `unidade` | string | **sim** | nome exato da casa: `"Beira Lago"` |
| `periodoInicio` | string | **sim** | `"2026-10-13"` |
| `periodoFim` | string | **sim** | `"2026-10-19"` |
| `itens` | array | **sim** | não pode ser vazio |

Cada item:

| campo | tipo | obrigatório | o que é |
|---|---|---|---|
| `nome` | string | **sim** | nome do item como aparece no PDV |
| `quantidadeVendida` | number | **sim** | quantas unidades saíram no período |
| `codigo` | string | não | código do item no PDV da casa |

## Aqui o `codigo` PODE vir, ao contrário das compras

Do lado da venda o app já guarda código **por casa**
(`@@unique([unidadeId, codigoPdv])`), então o XMenu do Beira Lago não colide
com o Teknisa das outras. Mandar o código melhora o casamento — nome de prato
muda quando alguém renomeia o cardápio, código não.

O app **não grava** o código automaticamente a partir de um casamento por nome;
ele devolve em `codigosASugerir` para alguém confirmar.

## Exemplo

```json
{
  "unidade": "Beira Lago",
  "periodoInicio": "2026-10-13",
  "periodoFim": "2026-10-19",
  "itens": [
    { "nome": "Filé au Poivre", "codigo": "4412", "quantidadeVendida": 37 },
    { "nome": "Burrata com tomate confit", "quantidadeVendida": 12 }
  ]
}
```

## Três coisas que surpreendem

**1. Não existe campo de valor.** A rota recebe só quantidade. O faturamento é
calculado pelo app, multiplicando pelo `precoVenda` cadastrado em cada item.

Consequência prática: **o preço de venda no app precisa estar atualizado**, ou
o denominador do CMV sai errado. Se o painel tiver o preço praticado, vale uma
conversa à parte sobre sincronizar isso também.

**2. Recarregar o mesmo período é recusado, não ignorado.** Mandar duas vezes a
mesma `unidade` + `periodoInicio` + `periodoFim` devolve **409**. Ao contrário
das compras, não há chave por linha aqui — o período inteiro é a identidade. O
painel deve mandar cada semana uma vez só, ou tratar o 409 como "já estava lá".

**3. A carga faz mais do que registrar venda.** Ela também explode as fichas
técnicas para dar baixa teórica de estoque e gera um **pedido de compra
rascunho** com a sugestão de reposição. Isso é desejado no desenho original,
mas vale saber antes de ver um pedido aparecer sozinho.

## O que olhar na resposta

## Reenviar a semana NÃO resolve — use `POST /api/n8n/reprocessar-vendas`

Mesma armadilha das compras, por um mecanismo diferente. Na compra, a linha é
pulada pela `chave`. Na venda **não há chave por linha**: a identidade é o
período inteiro, e reenviar a mesma semana devolve **409**. A linha que não
casou fica gravada com item nulo e não há como mandar de novo.

Depois de cadastrar os itens de venda que faltavam, chame:

```json
POST /api/n8n/reprocessar-vendas
{ "unidade": "Beira Lago" }
```

Opcionalmente `vendaSemanalId` para limitar a uma semana. Ela não recebe linha
nenhuma — o dado já está no banco.

**Por que não dá pra apagar a venda e reenviar:** a carga também dá BAIXA de
estoque (explodindo a ficha de cada item casado) e cria um pedido rascunho.
Apagar só a venda deixaria os movimentos de pé, e o reenvio baixaria tudo de
novo — consumo em dobro, calado.

**Por que o reprocessamento não baixa em dobro:** ele só toca linhas com item
nulo, e linha sem item nunca explodiu ficha. Rodar duas vezes é inofensivo.
Ele também **não** cria um segundo pedido de compra; a sugestão de reposição
vem na resposta.

## O que olhar na resposta

`naoReconhecidos` (item de venda que não casou), `casadosPorCodigo` /
`casadosPorNome`, `codigosASugerir`, e `itensListaCompra` com a sugestão de
compra.

---

# 3. Reprocessar o que não casou — `POST /api/n8n/reprocessar`

## Repetir a carga NÃO faz a linha entrar. Esta rota existe por isso.

Este passo 4 dizia, até 20/10/2026, "repetir a carga". **Estava errado**, e o
erro custou uma carga inteira do Beira Lago: 1.477 linhas, R$ 305 mil.

A rota de preços pula a linha repetida pela `chave` **antes** de tentar casar o
nome. É o comportamento certo para o que ele foi feito — reexecutar o workflow
não pode somar mercadoria de novo. Mas tem uma consequência:

> Linha que chegou **antes** do produto existir fica gravada com produto nulo e
> com a chave ocupada. Reenviar a mesma carga depois de cadastrar o produto
> **não** a traz de volta: ela é pulada antes de chegar perto do catálogo.

O sintoma é uma resposta que parece ótima e não é:

```
linhasJaCarregadas 2990, casadosPorNome 0, naoReconhecidos [], entradasDeEstoque 0
```

`naoReconhecidos` vazio aqui não quer dizer "tudo casou". Quer dizer "nenhuma
linha foi examinada".

## Corpo

Esta rota **não recebe linha nenhuma** — o dado já está no banco.

| campo | tipo | obrigatório | o que é |
|---|---|---|---|
| `unidade` | string | **sim** | nome exato da casa: `"Beira Lago"` |
| `notaCompraId` | string | não | só as linhas daquela carga; sem ele, todas as da despensa |

```json
{ "unidade": "Beira Lago" }
```

## O que ela faz

Pega as linhas com produto nulo, reenvia ao mesmo processamento da carga, e
devolve o mesmo relatório. O que casar agora entra: preço, entrada de estoque e
movimento **com a data da nota**, não a de hoje.

## Por que isto não soma estoque em dobro

Só são tocadas linhas **sem produto**, e linha sem produto nunca entrou em
estoque — a entrada é somada dentro do ramo onde o produto existe. Não é uma
suposição sobre o passado; é o que o próprio dado afirma.

Rodar duas vezes seguidas é inofensivo: na segunda não há mais linha sem
produto, e a resposta vem com `linhasReenviadas: 0`.

## Resposta

| campo | o que é |
|---|---|
| `linhasSemProduto` | quantas havia |
| `linhasReenviadas` | quantas foram reprocessadas |
| `puladas.semChave` | linha sem `chave` — não entra em estoque de jeito nenhum |
| `puladas.semUnidade` | linha gravada sem unidade — não há o que casar |
| `carga` | o relatório, igual ao de `/api/n8n/precos` |

---

# Ordem sugerida

1. **Compras do Beira Lago**, uma carga de 01/08 até hoje, de uma vez. Serve de
   teste e já popula o histórico para a curva ABC.
2. Conferir `naoReconhecidos` — vai ser alto na primeira vez, porque os
   produtos ainda não estão cadastrados no app. É esperado.
3. Cadastrar os produtos com o nome do XMenu.
4. **Chamar `POST /api/n8n/reprocessar`.** NÃO repetir a carga: repetir não faz
   as linhas entrarem, pelo motivo da seção 3.
5. Conferir o `carga.naoReconhecidos` que ele devolve — agora sim é a lista do
   que continua sem cadastro.
6. **Vendas**, semana a semana.

Da segunda semana em diante a ordem é a de sempre: mandar a carga da semana, e
chamar o reprocessamento só quando alguém cadastrar produto que faltava.

## O que NÃO vem do painel

A **contagem** e as **perdas**. As duas só existem quando alguém do salão
registra, e são justamente o que o app passa a existir para capturar. Todo o
resto pode vir do painel.
