# Mensagem para o Claude do Painel/n8n — 11/11

> Cole a partir daqui. São três assuntos independentes; o 1 é o mais urgente.

---

Três coisas, em ordem de urgência.

## 1. A venda do Beira Lago não entrou em novembro

O Painel do Beira Lago mostra **"nenhuma venda carregada"** em novembro, com
R$ 7.149,37 de compra já lançada. A carga semanal automática era para ter
rodado na **segunda, 09/11**, cobrindo as semanas de 01/11 e 02–08/11.

Preciso saber:

- A execução de 09/11 rodou? Se rodou, qual foi a **resposta da rota**
  (`POST /api/n8n/vendas-semanais`) — código HTTP e corpo?
- Se deu **409**, me mande a mensagem inteira: ela diz qual período já existe,
  e isso normalmente significa que a semana entrou com outra régua de data.
- Se deu **200**, me diga quantos itens foram enviados e quantos a resposta
  marcou como `naoReconhecidos` — pode ser que tenha entrado numa casa
  diferente da que esperávamos.
- Se **não rodou**, o que apareceu na execução do n8n.

As outras três casas (104 Sul, Noroeste, Wine Garden) têm venda de novembro?
Se tiverem, o problema é só do fluxo do XMenu; se nenhuma tiver, é o agendador.

## 2. Preciso do código → grupo das COMPRAS do Teknisa

Diagnóstico de hoje, janela de 3 meses, por casa:

| Casa | Produtos SEM categoria | Valor comprado sem categoria |
|---|---|---|
| 104 Sul | 278 | R$ 408.426 |
| Noroeste | 251 | R$ 369.627 |
| Wine Garden | 267 | R$ 365.892 |

O Beira Lago está bem (só 5 produtos, R$ 3,6 mil) porque o XMenu manda o grupo.

**O efeito disso é no CMV enxuto dessas três casas: ele está subestimado.** A
régua do enxuto é por categoria, e categoria vazia não entra — de propósito,
para cadastro faltando não entrar calado no número da diretoria. No Wine
Garden, o que tem categoria de insumo soma ~R$ 105 mil de uns R$ 510 mil
comprados. O enxuto dele está enxergando perto de um quinto da compra real.

Preciso de um arquivo (CSV ou planilha) com, para cada casa:

```
codigoProduto, nomeProduto, grupo
```

— o **código do produto no Teknisa** (o mesmo que vai na chave da linha de
compra) e o **grupo/categoria** dele no cadastro do Teknisa. Pode ser o extrato
do cadastro de produtos, não precisa ser da nota.

Com isso eu escrevo o SQL de backfill da categoria, e o CMV enxuto das três
casas passa a significar alguma coisa.

Três grupos que apareceram e que eu não sei o que são — se você souber, me
diga, porque preciso decidir se entram na folha de contagem:
**SAFO** (104 Sul e Wine Garden), **INATIVOS** (Wine Garden) e
**GRUPO 751 (NÃO CLASSIFICADO)**.

## 3. A carga diária (quando o item 1 estiver resolvido)

Está na outra mensagem que te mandei, com o desenho completo. O resumo:

- **Compra:** pode rodar 3× por dia (09h, 14h, 19h). A identidade é a chave da
  linha, então reenviar é idempotente.
- **Venda, dia fechado:** uma carga por dia, 06h, carregando ontem,
  `periodoInicio = periodoFim`, **sem** `substituir`.
- **Venda, dia corrente (opcional):** mesma coisa com `"substituir": true`, que
  o app passou a aceitar hoje — ele apaga a carga daquele período exato,
  devolvendo ao estoque o que ela baixou, e grava a nova no lugar.

Antes de montar, responda as três perguntas da outra mensagem: se os relatórios
saem sozinhos ou dependem de alguém exportar; qual o corte do dia em cada
sistema (comanda que fecha 00h20 cai em que dia?); e se a consulta de notas
filtra por data de lançamento mas envia a data de emissão.

---

> Fim da mensagem.
