# Manutenção — implantação e WhatsApp

Módulo de chamados técnicos das casas. Fluxo:

```
Casa abre chamado (descrição, local, fotos)                       🔴 Em aberto
   │  → WhatsApp para o responsável da manutenção
   ▼
Responsável faz a triagem ──(recusa / duplicado)──► Recusado  → WhatsApp para a casa
   │ aceita e encaminha a um colaborador da categoria, com prazo
   │  → WhatsApp para o colaborador, com link próprio (sem login)
   ▼
Colaborador dá o OK no link → prazo começa a contar               🟡 Em andamento
   │ conclui: serviço executado + fotos
   │  → WhatsApp para o gerente da casa (e quem abriu)
   ▼
Gerente aprova ──────────────────────────────────────────────►    🟢 Finalizado
   └─ ou reprova com motivo → volta ao colaborador (WhatsApp)
```

Relatório (`/manutencao/relatorio`, com exportação para Excel): data e hora
de abertura, triagem, OK do colaborador, conclusão e aprovação; tempos médios;
% no prazo; atrasados; reprovações; maiores demandas por categoria, casa,
colaborador e local; **duplicados** (dois chamados abertos ao mesmo tempo para
a mesma coisa — o app avisa na hora de abrir, e o responsável pode marcar) e
**repetidos** (o mesmo defeito voltando no mesmo local em até 30 dias).

## 1. Banco — rodar no console do Neon

`prisma/scripts/manutencao/1-criar-tabelas.sql`

Só cria tabelas novas; nada existente é alterado. Pode rodar mais de uma vez.
Se o deploy chegar antes do SQL, só as telas de Manutenção ficam fora do ar.

## 2. Usuários

- **Responsável da manutenção**: Ajustes → Usuários → papel *Responsável da
  manutenção*, sem casa. Ele só enxerga o módulo de Manutenção.
- **Gerentes** já existentes aprovam o serviço da própria casa.
- Qualquer usuário de uma casa pode abrir chamado.
- Em Manutenção → **WhatsApp da equipe**, cadastrar o celular do responsável,
  dos gerentes e de quem recebe o relatório semanal.
- Em Manutenção → **Colaboradores**, cadastrar pedreiro, eletricista, técnico
  de máquinas, Agente de Manutenção etc., com as categorias que cada um atende.
- **Agente de Manutenção com login**: no cadastro dele (marcado como interno),
  coluna *Acesso ao app* → **Criar acesso** (e-mail e senha). Ele entra no app
  e vê **só os chamados encaminhados a ele** — dá o OK e finaliza com fotos por
  lá. Não abre chamado nem vê nenhuma outra tela. Desativar o colaborador
  desliga o login. Requer `prisma/scripts/manutencao/2-acesso-do-agente.sql`.
- **Terceiros** não têm login: recebem cada chamado pelo link do WhatsApp, e
  pelo WhatsApp ficam sabendo da aprovação (ou reprovação) do serviço.

## 3. WhatsApp — API oficial (Meta)

Até a API estar ligada o módulo funciona em **modo manual**: em cada etapa,
quem vive a etapa vê um cartão verde com a mensagem pronta e um botão por
destinatário (abre o WhatsApp de quem clica), mais "Escolher contato ou grupo"
para mandar a outra pessoa ou ao grupo da manutenção:

| Etapa | Quem envia | Para quem |
|---|---|---|
| Chamado aberto | quem abriu (logo após abrir) | responsável da manutenção |
| Encaminhado | responsável da manutenção | colaborador (com o link dele) |
| Serviço concluído | o próprio colaborador, na página do link | gerente da casa |
| Reprovado | gerente | colaborador |
| Aprovado | gerente | colaborador |
| Recusado | responsável da manutenção | gerente da casa |
| Resumo semanal | quem abre o Relatório | quem está marcado para receber |

Para ligar o envio automático:

1. Em business.facebook.com, com a conta comercial do Grupo verificada, criar
   um app (tipo *Business*) em developers.facebook.com e adicionar o produto
   **WhatsApp**.
2. Registrar um **número exclusivo** (não pode estar em uso no WhatsApp comum).
3. Criar um **usuário do sistema** com permissão no app e gerar um **token
   permanente** com `whatsapp_business_messaging` e
   `whatsapp_business_management`.
4. No Gerenciador do WhatsApp → Modelos de mensagem, criar os 7 modelos
   abaixo — categoria **Utilidade**, idioma **Português (BR)**, nome exatamente
   igual. Ao cadastrar, a Meta pede um exemplo de cada variável: use qualquer
   texto plausível.
5. Na Vercel, configurar as variáveis e fazer redeploy:
   - `WHATSAPP_TOKEN` — o token permanente
   - `WHATSAPP_PHONE_NUMBER_ID` — o *ID do número de telefone* (não é o número)
   - `APP_URL` — endereço público do sistema (ex.: `https://compras.grupoalmeria.com.br`);
     se faltar, usa `NEXTAUTH_URL`
   - `CRON_SECRET` — valor aleatório (`openssl rand -hex 32`), para o relatório semanal

Custo: a Meta cobra por mensagem de modelo de Utilidade (centavos por
mensagem no Brasil). Cada envio, ou falha, fica no histórico do chamado.

## 4. Relatório semanal

`vercel.json` agenda `/api/cron/manutencao-semanal` toda **segunda às 8h**
(11h UTC). Ele manda o resumo da semana anterior (segunda a domingo) para quem
estiver marcado em *WhatsApp da equipe → Recebe o relatório semanal*, com o
link para o relatório completo. Também pode ser disparado pelo n8n com o
mesmo `Authorization: Bearer <N8N_API_TOKEN>` das outras rotas.

## Modelos de mensagem (cadastrar na Meta)

### `chamado_novo`
Para o responsável da manutenção, quando uma casa abre chamado.

```
Novo chamado de manutenção nº {{1}} — {{2}}.
Categoria: {{3}}. Urgência: {{4}}.
Problema: {{5}}
Para analisar e encaminhar, acesse: {{6}}
Grupo Almeria · Manutenção
```

### `chamado_encaminhado`
Para o colaborador acionado (pedreiro, eletricista, agente...).

```
Olá, {{1}}! Você foi acionado para o chamado nº {{2}} — {{3}}.
Problema: {{4}}
Prazo para concluir após o seu OK: {{5}}.
Abra o link para dar o OK e, ao terminar, registrar o serviço com fotos: {{6}}
Grupo Almeria · Manutenção
```

### `chamado_para_aprovacao`
Para o gerente da casa, quando o colaborador conclui o serviço.

```
O chamado nº {{1}} — {{2}} foi concluído por {{3}}.
Serviço executado: {{4}}
Confira as fotos e aprove ou reprove o serviço em: {{5}}
Grupo Almeria · Manutenção
```

### `chamado_reprovado`
Para o colaborador, quando a casa reprova o serviço.

```
O serviço do chamado nº {{1}} — {{2}} não foi aprovado pela casa.
Motivo: {{3}}
Veja os detalhes e registre a correção em: {{4}}
Grupo Almeria · Manutenção
```

### `chamado_aprovado`
Para o colaborador, quando a casa aprova o serviço.

```
O serviço do chamado nº {{1}} — {{2}} foi aprovado pela casa e o chamado está finalizado.
Obrigado pelo atendimento, {{3}}.
Detalhes: {{4}}
Grupo Almeria · Manutenção
```

### `chamado_recusado`
Para o gerente da casa, quando a manutenção recusa o chamado.

```
O chamado nº {{1}} — {{2}} não foi aceito pela manutenção.
Motivo: {{3}}
Detalhes: {{4}}
Grupo Almeria · Manutenção
```

### `relatorio_semanal_manutencao`
Resumo semanal, toda segunda-feira.

```
Relatório semanal da manutenção — {{1}}.
Abertos na semana: {{2}}. Finalizados na semana: {{3}}.
Em aberto agora: {{4}}. Em andamento: {{5}}. Atrasados: {{6}}.
Tempo médio de resolução: {{7}}.
Maior demanda: {{8}}.
Relatório completo: {{9}}
Grupo Almeria · Manutenção
```

## Onde está o código

- `src/lib/manutencao/` — regras (status/cores, duplicados, prazo), relatório,
  WhatsApp e notificações; testes ao lado.
- `src/actions/manutencao.ts` — todas as ações (abrir, triar, OK, concluir,
  aprovar, cadastros).
- `src/app/(app)/manutencao/` — telas; `src/app/m/[token]/` — página do colaborador.
- Fotos: guardadas no Postgres (`FotoChamado`), reduzidas no navegador para
  ~150 KB. Se o volume crescer muito, é a tabela que migra para um storage.
