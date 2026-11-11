# Implantação — 11/11/2026

A ordem importa: o passo 1 tem que acontecer **antes** do deploy chegar às
telas de pedido, senão elas caem com P2022 (o deploy roda só
`prisma generate`, nunca `prisma migrate deploy`).

## 1. Banco (console do Neon) — ANTES de tudo

Rodar `prisma/scripts/pedidos/1-colunas-da-diretriz.sql`.

Cria `tipo`, `motivoExtra`, `motivoDetalhe` e `semanaRef` em `PedidoCompra`, e
carimba a semana dos pedidos antigos. Pode rodar duas vezes sem problema.

No fim ele mostra duas conferências: as quatro colunas, e
`pedidos = com_semana`.

> Se por algum motivo o deploy chegar antes do SQL, nada cai: as leituras caem
> para a data de criação e a gravação sai sem a marcação (o motivo do extra vai
> para a observação). Mas a contagem por motivo só começa a valer depois do SQL.

## 2. Curva ABC — casa por casa

**Estoque → Curva ABC da contagem**, escolher a casa no menu, conferir a lista
"Saem da curva A" e aplicar. Fazer nas quatro: Beira Lago, 104 Sul, Noroeste,
Wine Garden.

Isso grava a rotação nova: curva A inteira toda semana, curva B em duas metades
(semanas 1 e 3 contam a metade 1; semanas 2 e 4, a metade 2).

Depois de aplicar, abrir **Estoque → Contagem da semana** e conferir o rótulo:
deve dizer "curva A inteira + curva B metade 1" (ou 2, conforme a semana).

> A folha já funciona mesmo antes de aplicar — curva A gravada em grupo 1 ou 2
> entra toda semana, e curva B em grupo 3 ou 4 cai na metade correspondente.
> Aplicar é o que divide a B direito, por valor.

## 3. Usuários das casas

**Ajustes → Usuários**.

- Para cada casa sem acesso: *Novo usuário* → nome, e-mail, senha provisória,
  papel **Gerente da unidade**, e a casa certa em Unidade.
- Para quem já existe e esqueceu: campo "nova senha" na própria linha →
  *Redefinir*.

O gerente agora **cria pedido da própria casa**. Ele continua **não aprovando**:
o pedido sai como "Aguardando aprovação".

Senha provisória vai para a pessoa por canal direto (WhatsApp, pessoalmente) —
não por planilha compartilhada nem por e-mail em grupo.

## 4. Primeiro pedido pelo app

Com o gerente logado: **Pedidos de compra → + Novo pedido**.

- O primeiro da semana sai sem motivo. A faixa no topo diz se hoje é o dia
  combinado.
- O segundo da mesma semana vira **extra** e exige motivo (falta, erro, perda,
  esquecimento, evento, movimento acima do previsto, outro).
- Se a segunda for feriado, o dia combinado anda sozinho para o próximo dia
  útil — os feriados nacionais e os do DF já estão no app, calculados por ano.

## 5. Mensagem para a automação

`docs/mensagem-claude-automacao-diaria.md` — mandar para a janela do Claude que
opera o n8n.
