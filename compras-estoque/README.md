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

Requer Node.js 18+.

```bash
cd compras-estoque
npm install
npx prisma migrate dev    # cria o banco local (SQLite) e as tabelas
npm run db:seed           # cria as 5 unidades e um usuário admin inicial
npm run dev                # http://localhost:3000
```

Credenciais do usuário admin criado pelo seed:
- **E-mail:** `admin@grupoalmeria.com.br`
- **Senha:** `almeria123`

**Troque essa senha assim que possível** — crie um usuário definitivo em
"Usuários" e desative o admin de seed, ou simplesmente troque a senha dele
diretamente no banco.

## Colocando no ar (deploy)

O app já está pronto para produção com Postgres, sem precisar mudar código —
só a variável `DATABASE_URL`. Passo a passo recomendado:

1. **Banco de dados**: crie uma conta gratuita no [Neon](https://neon.tech)
   ou [Supabase](https://supabase.com) e copie a *connection string* Postgres
   (algo como `postgresql://usuario:senha@host/banco?sslmode=require`).
2. No arquivo `prisma/schema.prisma`, troque:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. **Hospedagem**: crie uma conta gratuita na [Vercel](https://vercel.com),
   importe este repositório e configure:
   - `DATABASE_URL` = a connection string do passo 1
   - `NEXTAUTH_SECRET` = um valor aleatório (gere com `openssl rand -hex 32`)
   - `NEXTAUTH_URL` = a URL pública que a Vercel atribuir ao projeto
4. Rode a migração no banco de produção (`npx prisma migrate deploy`) e o
   seed inicial (`npm run db:seed`) — pode ser feito localmente apontando
   `DATABASE_URL` para o banco de produção, uma única vez.

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
    api/auth/[...nextauth]/ rota de autenticação (NextAuth)
  actions/                 server actions (mutações: criar, aprovar, receber…)
  lib/                     prisma client, auth, permissões, constantes, formatação
prisma/
  schema.prisma            modelo de dados
  seed.ts                  cria unidades + usuário admin inicial
```

## Próximos passos sugeridos

- Edição de cadastros existentes (hoje só cria e ativa/desativa)
- Ponto de reposição mínimo por produto/unidade (alerta de estoque baixo)
- Histórico de preços por fornecedor/produto
- Exportação de relatórios (divergências, pedidos por período) em Excel/PDF
- Integração com o dashboard de fichas técnicas já existente no repositório
  (compartilhar o cadastro de produtos/insumos entre os dois sistemas)
