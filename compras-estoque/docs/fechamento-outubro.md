# Fechamento de outubro — o que apresentar, e como ler

Primeiro mês fechado com inventário. Outubro acabou no sábado 31; a contagem de
domingo 01/11 é a que fecha o mês e abre a primeira semana de novembro.

**A regra da reunião:** número estranho se anota, não se explica na hora. Quase
todo número esquisito aqui tem causa conhecida — e descobrir qual ao vivo custa
a sala.

---

## Antes: três coisas têm que estar dentro

| | esperado |
|---|---|
| compra | último dia de nota em **31/10** |
| venda | semana fechando em **31/10** ou depois |
| contagem | a de **01/11** aparecendo, com os 112 itens |

O `34-esta-tudo-ok.sql` responde as três. Se alguma falhar, **o CMV contado sai
errado — e errado para baixo**, que é o jeito ruim de errar, porque parece boa
notícia.

---

## Os três CMV, e por que eles discordam

Eles vão dar números diferentes. **Isso não é defeito: é a informação.**

### 1. Compras ÷ vendas

Quanto saiu do caixa para comprar, sobre o que foi vendido. É o único que
existe sem contagem e sem ficha, e é o mais fácil de explicar.

**O que ele supõe:** que o estoque não mudou. Numa semana em que a casa estocou
vinho para um evento, ele acusa CMV alto sem nada ter saído da despensa. No mês
em que a casa queima estoque, acusa baixo.

Vêm dois: **enxuto** (matéria-prima, bebida e vinho) e **cheio** (somando
embalagem, higiene, refeição de funcionário e evento). O enxuto é o que se
compara com meta — a casa não controla CMV comprando menos detergente.

### 2. Teórico (ficha técnica)

Quanto **deveria** ter sido gasto para fazer o que foi vendido.

**Ele mede só a parte do cardápio que tem ficha.** O painel diz quanto do
faturamento isso representa — e esse número importa mais que o CMV em si. Um
teórico calculado sobre um quarto do cardápio não é um CMV baixo: é um CMV
incompleto.

**O teto é 57%, não 100%**, e isso precisa ser dito antes de alguém perguntar:
43% do faturamento é **evento**, vendido como pacote fechado. O PDV não detalha
prato a prato, então essa parte nunca vai ter ficha, por construção.

### 3. Contado (inventário) — **o número do mês**

Quanto **de fato** saiu da despensa: estoque inicial + compras − estoque final.
Não depende de ficha, não depende de o PDV detalhar nada. O evento entra nele
inteiro, porque come da mesma despensa.

É o único dos três que mede a realidade. Os outros dois são estimativas úteis.

**A leitura que vale:** o contado contra o teórico. A diferença entre os dois é
o tamanho do que as fichas não explicam — porção maior que a ficha, perda,
erro de contagem ou sumiço.

---

## A conferência da contagem

`/estoque/conciliacao`. Agora ela quebra a falta em três:

- **Consumo de pratos sem ficha** — mercadoria que virou prato e o app não soube
  descontar. **Não é perda.**
- **Eventos** — separados, porque nunca terão ficha.
- **Perda** — o que sobra. **É só este número que vale conversar.**

A quebra é **estimativa**, e a tela escreve a premissa: o prato sem ficha
consome na mesma proporção dos que têm. Se a tela avisar que a estimativa foi
**cortada no teto**, a premissa não está valendo nessa janela — diga isso em vez
de defender o número.

**A quebra vale para o total, não para as linhas por produto.** Sem ficha, não
existe nada que ligue um prato a um insumo. Quem perguntar "esse sumiço de
R$ 400 no filé é prato sem ficha?", a resposta honesta é: não dá para saber por
produto, só no agregado.

---

## As quatro perguntas que vão vir

**"Por que o CMV do app não bate com o da planilha?"**
A planilha calcula com preço de 16/01. O app recalcula com o preço da última
nota. São nove meses de diferença de preço — o do app é o de hoje.

**"Por que esse item tem falta de R$ 400?"**
Em ordem de probabilidade: ficha com rendimento errado; perda não declarada;
produto que nenhuma receita menciona (aparece em coluna própria, e mede ficha
por escrever, não mercadoria sumida); erro de contagem — e esse só a contagem
seguinte revela.

**"Dá para confiar nesse número?"**
No contado, sim: ele vem de duas contagens e das notas. No teórico, só na parte
coberta por ficha — e o painel diz qual é.

**"E as outras casas?"**
Só o Beira Lago tem venda carregada. As outras têm compra, e sem venda não há
CMV. O caminho delas é o mesmo que o Beira Lago já andou: compra casando →
curva ABC → venda → fichas.

---

## O que pedir na reunião

Duas coisas que só outra pessoa pode destravar, e que valem mais que qualquer
ajuste no app:

1. **O rendimento das fichas que faltam.** A fila está em
   `/estoque/conciliacao`, ordenada por faturamento — é quanto custa não ter
   cada ficha.
2. **Lançar perda no dia.** Perda anotada no fim da semana, de memória, é
   estimativa — e estimativa dentro do CMV tem cara de medição. Toda perda não
   lançada vira "sumiço" na conferência, e a conversa vira acusação em cima de
   contabilidade incompleta.
