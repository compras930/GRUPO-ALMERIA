# Roteiro da sexta, 24/10 — Beira Lago

A primeira contagem de verdade, na frente de gente. Este arquivo é o roteiro:
o que clicar, em que ordem, que número esperar, e o que fazer quando algo não
bater.

**A regra do dia:** se um número parecer errado, **não conserte na hora**.
Anote e siga. Consertar ao vivo é como se perde a sala — e quase todo número
estranho aqui tem explicação, não defeito.

---

## Antes de sair de casa (quinta à noite ou sexta cedo)

Isto é a checagem de fumaça, leva 3 minutos. Tudo no app, logado como ADMIN.

| # | Tela | O que olhar | Esperado |
|---|------|-------------|----------|
| 1 | `/dashboard` | mês = **outubro**, casa = **Beira Lago** | faturamento **R$ 1.265.578,21** |
| 2 | `/dashboard` | Vendas por categoria | PRINCIPAIS, ENTRADAS, TINTOS… tudo em maiúscula, nenhuma duplicada |
| 3 | `/estoque/contagem` | a folha | **112 itens**, agrupados por categoria, numeração contínua até 112 |
| 4 | `/estoque/contagem/imprimir` | imprimir | sai em papel, agrupado igual à tela |
| 5 | `/produtos` → buscar APEROL | preço | **≈ R$ 59,87** por garrafa (não R$ 44,80) |

Se algum desses cinco falhar, me chame **na quinta**, não na sexta.

---

## Na casa, antes da reunião

**Imprima a folha de contagem** (`/estoque/contagem/imprimir`) e leve em papel,
mesmo que vá lançar pelo celular. Internet na casa é a coisa mais provável de
falhar, e uma folha impressa transforma a queda de sinal em "lanço depois" em
vez de "a apresentação acabou".

A folha vem **agrupada por categoria** — câmara fria, adega, prateleira seca —
porque quem conta anda pela despensa, não em ordem alfabética. Dentro do grupo
é alfabética: parado na frente da adega, a pessoa procura o rótulo pelo nome.

---

## A apresentação, em 4 blocos

### 1. O painel (5 min) — "onde o dinheiro está"

`/dashboard`, outubro, Beira Lago.

Mostre nesta ordem: **faturamento** → **compras** → **CMV**. Depois desça para
a **curva A**.

Fale o que a curva A é, em uma frase: *112 produtos que respondem por 80% do
custo.* O resto do catálogo existe, mas contar tudo toda semana é trabalho que
ninguém sustenta por três meses.

**Clique em um item da curva A.** Abre o histórico de compra daquele produto —
nota a nota, com o nome **como o fornecedor escreveu**. É aqui que se vê o
fornecedor trocando a grafia e a unidade mudando. Bom item para clicar: um
caro, com poucas compras.

### 2. A contagem (10 min) — "o que fazer toda segunda"

`/estoque/contagem`.

Esta é a parte que a gerente da casa vai fazer sozinha toda semana, e é a parte
que precisa parecer **fácil**. Mostre o login dela, não o seu.

Conte **um item de verdade** ali na frente de todos e lance. Escolha um fácil
de contar — garrafa fechada, não pote de tempero.

> **Contagem sobrescreve o saldo. Nota de compra soma.** Se a contagem diz 8 e
> o app dizia 12, passa a ser 8. A contagem é a verdade; o app é a estimativa.

### 3. A conciliação (10 min) — **a parte que importa**

`/estoque/conciliacao`, só para ADMIN.

É o relatório que você pediu: para cada produto contado, a diferença entre
**compras, vendas e estoque**.

A conta de cada linha é uma só, e vale dizer em voz alta:

```
esperado = saldo da contagem anterior + comprado − vendido − perda declarada
```

A **diferença** é o esperado menos o contado. Negativa = sumiu. Está ordenado
pela maior falta em reais, não pela maior diferença absoluta: o que custa
dinheiro vem primeiro.

**Prepare-se para esta pergunta:** *"por que esse item tem falta de R$ 400?"*

As respostas honestas, em ordem de probabilidade:
1. **ficha técnica com rendimento errado** — a receita diz que usa 80 g, usa 120;
2. **perda não declarada** — quebrou, estragou, voltou do cliente;
3. **produto sem ficha** — o app não tem como saber que ele foi consumido, então
   some inteiro. Esses aparecem separados, em `faltaSemFichaEmReais`;
4. **erro de contagem** — e esse só a contagem seguinte revela.

**Não prometa que a primeira contagem vai bater.** Ela não vai. A primeira
contagem é a que *estabelece o ponto de partida*; a segunda é a primeira que
significa alguma coisa, porque aí existem dois inventários e uma janela entre
eles. Diga isso antes de alguém perguntar.

### 4. O calendário (2 min) — "como fica daqui pra frente"

- **sexta 24/10** — primeira contagem (hoje)
- **segunda 27/10** — segunda contagem
- **domingo 01/11** — contagem que **fecha outubro** e abre novembro
- daí em diante, **toda segunda**

Outubro acaba no sábado, por isso a última semana do mês é segunda a sábado
(26–31) e a primeira de novembro é domingo a domingo (01–08). A contagem de
01/11 é a que dá o **CMV contado de outubro** — o número real, não a estimativa.

Os três CMV, se perguntarem:
- **compras ÷ vendas** — o proxy, disponível todo dia, erra quando se compra em lote
- **teórico** — o que as fichas dizem que deveria ter sido consumido
- **contado** — o que o inventário prova que foi. Só este fecha o mês.

---

## O que pode dar errado, e o que dizer

| Se acontecer | O que dizer | O que NÃO fazer |
|---|---|---|
| Um item com falta absurda | "esse tem ficha com rendimento a revisar, está na lista" | abrir a ficha ao vivo |
| A internet cair | "temos a folha em papel, lanço à noite" | pedir para todos esperarem |
| Pedirem um número que o app não tem | "não tenho esse ainda, anoto" | estimar de cabeça |
| Um produto aparecer duplicado | "é o mesmo item com dois códigos do Teknisa, está mapeado" | consertar na hora |

---

## Depois da reunião

1. Me mande o resultado da conciliação — principalmente os cinco maiores
   buracos. É deles que sai a próxima lista de fichas a revisar.
2. Se alguém pedir alguma coisa na reunião, anote **a frase exata** da pessoa.
   Vale mais que o resumo.
