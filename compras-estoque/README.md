# Compras & Estoque — Grupo Almeria

Sistema web multi-unidade para pedidos de compra, recebimento com conferência
e controle de estoque. Criado para acabar com o desencontro de informações
entre "o que foi pedido", "o que chegou" e "o que tem no estoque" em cada
unidade (Beira Lago, 104 Sul, Noroeste, Matri, Wine Garden).

## O que o sistema resolve

1. **Pedido vs. recebido** — ao registrar um recebimento, quem recebe lança a
   quantidade e o preço que **de fato** chegaram. O sistema compara
   automaticamente com o que foi pedido e sinaliza divergência — sem
   depender de ninguém "lembrar de avisar".
2. **Estoque real vs. estoque de sistema** — cada recebimento gera entrada
   automática no saldo da unidade. Contagens de inventário registram o
   saldo real e mostram a diferença contra o saldo calculado pelo sistema.
3. **Quem pode pedir, quem aprova** — papéis definidos (Solicitante,
   Aprovador, Recebedor, Administrador), com rastro de quem criou, quem
   aprovou/rejeitou e quando.

## Fluxo

```
Solicitante monta o pedido
        │
        ▼
Aguardando aprovação ──(rejeitar)──► Rejeitado
        │
    (aprovar)
        ▼
     Aprovado ──► marcado como Enviado ao fornecedor
        │
        ▼
  Recebimento (conferência de qtd./preço) ──► gera entrada de estoque
        │
        ▼
Recebido parcial / Recebido total
```

Independentemente do pedido, o estoque pode ser ajustado por **contagem de
inventário**, que compara o saldo contado com o saldo de sistema e registra
a diferença.

## Papéis (o que cada um pode fazer)

| Papel        | Pode                                                        |
|--------------|--------------------------------------------------------------|
| ADMIN        | Tudo — cadastros, aprovar, receber, ver todas as unidades    |
| SOLICITANTE  | Criar pedidos de compra da própria unidade                   |
| APROVADOR    | Aprovar/rejeitar pedidos da própria unidade                  |
| RECEBEDOR    | Registrar recebimentos e contagens de estoque da própria unidade |

Usuários não-admin só veem e operam dados da unidade a que pertencem.

## Rodando localmente

Requer Node.js 18+ e um Postgres acessível (local ou já em nuvem, ex. Neon —
ver seção de deploy abaixo). Configure `DATABASE_URL` no `.env` (veja
`.env.example`) antes de rodar as migrações.

```bash
cd compras-estoque
npm install
npx prisma migrate dev    # cria as tabelas no Postgres apontado por DATABASE_URL
npm run db:seed           # cria as 5 unidades e um usuário admin inicial
npm run dev                # http://localhost:3000
```

Pra importar os dados de fichas técnicas/CMV do `dashboard-fichas-tecnicas.html`
(uma vez, depois do seed): `npx tsx prisma/scripts/import-fichas-tecnicas.ts`
primeiro sem `--commit` (só mostra um relatório do que seria importado), e
com `--commit` quando o relatório estiver ok.

Credenciais do usuário admin criado pelo seed:
- **E-mail:** `admin@grupoalmeria.com.br`
- **Senha:** `almeria123`

**Troque essa senha assim que possível** — crie um usuário definitivo em
"Usuários" e desative o admin de seed, ou simplesmente troque a senha dele
diretamente no banco.

## Colocando no ar (deploy)

O app já está configurado pra Postgres — não precisa mudar nenhum código, só
os passos abaixo:

1. **Banco de dados**: crie uma conta gratuita no [Neon](https://neon.tech)
   ou [Supabase](https://supabase.com) e copie a *connection string* Postgres
   (algo como `postgresql://usuario:senha@host/banco?sslmode=require`).
2. **Hospedagem**: crie uma conta gratuita na [Vercel](https://vercel.com),
   importe este repositório (a raiz do projeto é a pasta `compras-estoque/`,
   configure isso como "Root Directory" na Vercel) e configure as variáveis
   de ambiente:
   - `DATABASE_URL` = a connection string do passo 1
   - `NEXTAUTH_SECRET` = um valor aleatório (gere com `openssl rand -hex 32`)
   - `NEXTAUTH_URL` = a URL pública que a Vercel atribuir ao projeto
   - `N8N_API_TOKEN` = outro valor aleatório (mesma forma) — só necessário se
     for usar a integração com n8n, ver seção própria abaixo
3. Rode a migração no banco de produção (`npx prisma migrate deploy`), o
   seed inicial (`npm run db:seed`) e a importação das fichas técnicas
   (`npx tsx prisma/scripts/import-fichas-tecnicas.ts --commit`) — pode ser
   feito localmente apontando `DATABASE_URL` para o banco de produção, uma
   única vez cada. O seed é seguro de rodar de novo em produção mesmo
   depois do deploy inicial (usa `upsert`, nunca duplica) — precisa disso
   pra criar o usuário de serviço da integração com n8n.

## Integração com n8n

Três rotas de API pra automação (usadas pelo n8n, sem sessão de navegador):
autenticadas por `Authorization: Bearer <N8N_API_TOKEN>` — configure a
variável de ambiente `N8N_API_TOKEN` (ex.: `openssl rand -hex 32`) e use o
mesmo valor no header, no node HTTP Request do n8n. Sem o token certo, toda
chamada responde `401`. Requer que o seed (`npm run db:seed`) já tenha
rodado no banco de produção — ele cria o usuário de serviço usado pra
atribuir essas gravações automáticas.

### `POST /api/n8n/precos` — atualização semanal de preço (Teknisa)

```json
{
  "unidade": "104 Sul",
  "arquivoNome": "manutencao-ultimo-custo.xlsx",
  "itens": [
    { "nome": "ALCATRA BOVINO KG", "unidadeMedida": "KG", "preco": 74.9, "dataCompra": "2026-08-31" }
  ]
}
```
Casa cada item por nome+unidade (só match exato — nunca funde por
aproximação; item não reconhecido some no relatório, não é descartado).
Só atualiza o preço se a data for mais recente que a já registrada — reenviar
a mesma planilha 2x não altera nada na segunda vez. Resposta traz quantos
preços mudaram e quais pratos/bebidas/vinhos foram impactados (em cascata,
inclusive via sub-receita), com custo/CMV antes e depois.

### `POST /api/n8n/vendas-semanais` — venda da semana → lista de compras

```json
{
  "unidade": "104 Sul",
  "periodoInicio": "2026-09-01",
  "periodoFim": "2026-09-07",
  "itens": [ { "nome": "Tábua P - Barcelona", "quantidadeVendida": 12 } ]
}
```
Explode a receita de cada item vendido pra somar o consumo de insumo,
registra a saída no estoque, e gera um Pedido de Compra em status
"Rascunho" (sem fornecedor definido ainda) com quantidade sugerida — repõe
o consumido, ou completa até o estoque ideal se
`ParametroEstoqueProduto.estoqueIdeal` estiver configurado pro insumo.
Reenviar o mesmo período 2x responde `409` (não duplica consumo nem pedido).

### `GET /api/n8n/cmv-alertas?unidade=104%20Sul` (parâmetro opcional)

Sem body. Devolve os pratos/bebidas/vinhos com CMV acima da meta da
unidade (`Unidade.metaCmvPratos/Bebidas/Vinhos`, configurável em
"Unidades"). Sem `unidade` na query, roda pra todas. Pensado pra n8n
consultar num schedule trigger e disparar alerta (WhatsApp/e-mail) quando
`totalAlertas > 0`.

## Estrutura do projeto

```
src/
  app/
    login/                 tela de login
    (app)/                 rotas autenticadas (sidebar + conteúdo)
      dashboard/           painel com pendências e divergências
      pedidos/              lista, criação e detalhe de pedidos de compra
      recebimentos/novo/    conferência de recebimento por pedido
      estoque/              saldo por unidade + registro de contagem
      unidades/ usuarios/ fornecedores/ produtos/   cadastros (admin)
      cmv/                 fichas técnicas e custo por item de venda
      receitas/            sub-receitas soltas (molhos, marinadas, preparos-base)
    api/auth/[...nextauth]/ rota de autenticação (NextAuth)
    api/n8n/                integração externa (preços, venda semanal, alerta de CMV)
  actions/                 server actions (mutações: criar, aprovar, receber…)
  lib/                     prisma client, auth, permissões, constantes, formatação,
                           explosão de receita/custo, matching de nota de compra e
                           venda semanal, autenticação por token do n8n
prisma/
  schema.prisma            modelo de dados
  seed.ts                  cria unidades + usuário admin inicial
```

## Próximos passos sugeridos

- Edição de cadastros existentes (hoje só cria e ativa/desativa)
- Tela dentro do app pra revisar os itens "não reconhecidos" que a
  integração com n8n reporta (hoje só voltam no JSON da resposta)
- Exportação de relatórios (divergências, pedidos por período) em Excel/PDF
- Integração com o dashboard de fichas técnicas já existente no repositório
  (compartilhar o cadastro de produtos/insumos entre os dois sistemas)
