# Beira Lago — entrada da casa no app

Ordem dos passos, com o que cada um já rodou.

## 1. `1-curva-a.sql` — RODADO (20/10)

Cria os 112 produtos da curva A (61 matéria-prima, 36 vinhos, 15 bebidas) com o
nome do XMenu e os classifica `classeAbc='A'`, `grupoContagem=0` (fora do
rodízio: conta toda semana — ver `src/lib/contagem-rotacao.ts`).

Escopo: 80% do CMV (matéria-prima + bebidas + vinhos), R$ 933.080 de R$
1.164.999 no período 01/08–19/10.

## 2. `2-cadastro.sql` — A RODAR

Cadastra os **396 produtos que não casaram** na primeira carga do XMenu
(1.477 linhas, R$ 305.108). Gerado por `gerar-cadastro.ts` a partir do CSV de
não reconhecidos que a própria rota devolve:

```
npx tsx prisma/scripts/beira-lago/gerar-cadastro.ts <csv-nao-reconhecidos> \
  prisma/scripts/beira-lago/2-cadastro.sql
```

Os passos 2, 3 e 4 do SQL só LEEM — são a revisão. O passo 5 é o único que
escreve. **Leia o passo 3 antes de rodar o 5**: produto que já existe com outra
unidade de medida não deve ser cadastrado de novo (parte o estoque em dois).

**Rode em duas execuções**: passos 1 a 4 (linhas 1–504), leia o que voltou, e
só então os passos 5 a 7. Por isso o arquivo não tem transação em volta do
todo — ela não sobreviveria à pausa, e a tabela de trabalho também não. Só o
passo 5 tem `BEGIN`/`COMMIT` próprios: ou os 396 entram, ou nenhum entra.

### Duas coisas que este passo aprendeu na prática

**A unidade vai normalizada, o nome não.** O app traduz a unidade da linha por
`SINONIMO_UNIDADE` antes de procurar o produto, então `PCT` vira `CX`. Produto
cadastrado em `PCT` nunca casaria — a busca procura `CX`. Rodando a carga
inteira contra o catálogo recém-criado, as 63 linhas em CX casaram e as 75 em
PCT deram 0/75 exatamente por isso. O nome, ao contrário, vai como o XMenu
escreve (só sem espaço sobrando): é por ele que o casamento acontece.

**Os três grupos que não são CMV.** `ALIMENTAÇÃO FUNCIONÁRIO` (R$ 34.980),
`HIGIENE E LIMPEZA` (R$ 26.744) e `DESCARTÁVEIS E EMBALAGENS` (R$ 24.665) somam
R$ 86 mil e não são matéria-prima de prato vendido. A categoria vai gravada pra
dar o filtro, mas **a tela de consumo ainda não filtra por categoria** — se
esses produtos forem contados, entram no mesmo número do CMV.

### Verificação feita antes de entregar

Banco Postgres limpo, schema do Prisma, `2-cadastro.sql`, depois a carga real
das 2.990 linhas do export pela mesma função que a rota usa:

```
recebidas          2990
casadasPorNome     1477   <- exatamente as que não casaram em produção
entradasSemChave      0
precosSuspeitos       0

por unidade da origem (casou/total):
  CX     63/63
  KG    786/1788
  LT    136/284
  PCT    75/75
  UND   417/780
```

Rodando o SQL duas vezes, a segunda insere 0: o `NOT EXISTS` é
case-insensitive, então nem grafia em caixa diferente duplica.

## 3. `3-por-que-o-cmv-subiu.sql` — ferramenta, roda quando precisar

Responde "qual insumo mexeu o CMV deste prato na última carga", com o número de
cada um. Só lê. Troque o nome do item no passo 1 (os três blocos repetem o
`WHERE` — é proposital, pra cada bloco poder ser colado sozinho no console).

Repete em SQL a mesma conta de `custoDeReceita` (`src/lib/cmv.ts`), inclusive a
explosão recursiva de sub-receita e o fator de lote. Conferido contra o app num
cenário com sub-receita: custo 23,00 → 31,75 e CMV 39,7% nos dois.

## O que NÃO vem do painel

A **contagem** e as **perdas** — ver `docs/n8n/contrato-integracao.md`.
