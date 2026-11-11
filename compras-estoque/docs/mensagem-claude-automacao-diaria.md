# Mensagem para o Claude do Painel/n8n — carga diária

> Cole a partir daqui.

---

Precisamos passar as cargas de **semanal** para **diária**, com várias rodadas por
dia, para que o app tenha número do dia anterior fechado logo cedo e as compras
quase em tempo real. Antes de mexer nos workflows, preciso que você confirme
três coisas e respeite uma regra do app que muda o desenho.

## A regra que muda o desenho

No app, **a identidade de uma carga de venda é o PERÍODO**, não o arquivo. A rota
`POST /api/n8n/vendas-semanais` recusa com **409** qualquer período que se
**sobreponha** a um já carregado — não só o período idêntico. Isso é proposital:
é a trava que impede a mesma venda de ser somada duas vezes e o estoque de ser
baixado duas vezes.

Consequência prática: **não dá para reenviar a semana corrente várias vezes por
dia**. A segunda rodada do dia bate em 409 e não entra.

O jeito certo de ter número diário, sem tocar na trava (e, para o dia de hoje,
usando o modo de substituição logo abaixo):

- **Venda: uma carga por DIA FECHADO.** `periodoInicio = periodoFim = o dia`.
  Dias são períodos disjuntos, então cada um entra uma vez e nenhum conflita com
  o outro. Rodar de manhã (sugiro 06h) carregando **o dia anterior**.
- **Compra (notas): pode rodar várias vezes por dia à vontade.** Lá a identidade
  é a `chave` da linha (`codigoUnidade|data|notaFiscal|codigoProduto|seq`), então
  reenviar é idempotente — linha repetida é ignorada, linha nova entra. Sugiro
  3 rodadas: 09h, 14h e 19h.

Com isso o painel fica: **compra de hoje até a última rodada** e **venda fechada
até ontem**. É o máximo honesto sem mudar o app.

### Venda PARCIAL do dia de hoje — já dá, com `substituir: true`

O app ganhou um modo de substituição. Mandando

```json
{ "unidade": "...", "periodoInicio": "2026-11-11", "periodoFim": "2026-11-11",
  "substituir": true, "itens": [ ... ] }
```

a rota **apaga a carga daquele período exato** — devolvendo ao estoque
exatamente o que ela tinha baixado, apagando os movimentos e o rascunho de
pedido que ela gerou — e grava a nova no lugar. O resultado vem no campo
`substituicao` da resposta, dizendo quantas linhas e movimentos foram
revertidos.

Assim o mesmo dia pode ser reenviado de hora em hora: o saldo fica como se o
dia tivesse sido carregado **uma vez só**, com o último número.

Três coisas para você saber ao montar o workflow:

1. **`substituir` é opt-in e nunca deve ser o padrão.** Sem ele, a trava de
   período continua valendo — que é o que protege a carga histórica.
2. **O período tem que bater exato.** Mandar a semana com `substituir: true`
   por cima de cargas diárias devolve **409** dizendo quantas cargas seriam
   apagadas. Isso é proposital: apagar a semana para gravar um dia perderia
   seis dias de venda.
3. **Depois da contagem, a substituição é recusada** (409 também). A contagem
   sobrescreve o saldo; devolver o consumo de uma carga que a contagem já
   liquidou inflaria o estoque. Na prática: o dia de ontem pode ser
   substituído até a contagem da casa acontecer, não depois.

Vale lembrar, para o painel: CMV calculado com meio dia de venda e um dia
inteiro de compra não significa nada. O parcial serve para **faturamento**,
não para CMV.

## O que eu preciso saber de você

1. **As rodadas são realmente automáticas hoje?** Os relatórios do Teknisa
   (Emissão de Entrada de Estoque, Vendas de Produtos no Período) e do XMenu
   saem por exportação manual ou o n8n consegue buscar sozinho? Se hoje alguém
   exporta e sobe na planilha-base, a carga diária só muda de problema: continua
   dependendo de uma pessoa todo dia.
   - Se dá para buscar sozinho: me diga como (API, login automatizado,
     e-mail agendado do próprio sistema, Drive).
   - Se não dá: me diga qual é o caminho mais curto hoje, que a gente decide
     entre automatizar a exportação ou manter a mão só nessa etapa.

2. **Qual é o corte do dia em cada sistema?** Venda de restaurante vira a noite:
   se a comanda aberta às 23h30 fecha 00h20, o Teknisa e o XMenu põem ela em que
   dia? Se o corte deles não for meia-noite, a carga diária precisa usar o corte
   DELES, senão o dia some ou dobra na virada.

3. **O que acontece com nota lançada com atraso?** A regra do app é a **data de
   emissão** da nota, não a de entrada. Se a nota de sexta for digitada na
   terça, a rodada de terça vai mandá-la com a data de sexta — o que está certo,
   mas quero confirmar que a sua consulta filtra por **data de lançamento no
   sistema** (para pegar o que é novo) e **manda a data de emissão** (para o app
   gravar no dia certo). Se filtrar por emissão, a nota atrasada nunca será
   enviada.

## O que fazer, se as respostas acima permitirem

- **Venda, dia fechado:** um workflow diário, 06h, `periodoInicio = periodoFim
  = ontem`, uma chamada por casa (Beira Lago, 104 Sul, Noroeste, Wine Garden),
  **sem** `substituir`. Resposta 409 significa "esse dia já entrou" — trate
  como sucesso silencioso, não como erro.
- **Venda, dia corrente (opcional):** se quiserem o faturamento do dia se
  atualizando, um segundo workflow com `periodoInicio = periodoFim = hoje` e
  `"substituir": true`, nas mesmas rodadas da compra. Um 409 aqui é recusa de
  verdade (período que não bate, ou contagem já feita) — me mande a mensagem.
- **Compra:** o "Atualiza tudo" passa a rodar 3× ao dia. Nada muda no payload.
- **Em cima de qualquer 4xx que não seja 409**, me avise com o corpo da resposta:
  o app devolve mensagem em português dizendo o que recusou e por quê.
- **Não mude a régua do valor**: o que foi combinado continua valendo — o
  Teknisa manda o **líquido**, e o `grupo` por item.

Quando você responder as três perguntas, eu digo se precisa mexer no app.

---

> Fim da mensagem.
