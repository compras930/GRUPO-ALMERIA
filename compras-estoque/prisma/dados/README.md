# Dados de classificação

Decisões de negócio que não cabem no schema, mas que mudam o significado dos
números. Ficam versionadas aqui porque, fora daqui, viram planilha perdida e
alguém recalcula chutando seis meses depois.

## `grupos-pdv-classificacao.csv`

Os 109 grupos do PDV das 5 casas, classificados pelo setor de compras em
setembro/2026: `precisa_de_ficha` = `sim` (preparado na cozinha, tem receita)
ou `nao` (revenda — compra pronto, vende).

**Por que isso importa.** Sem a classificação, "faturamento sem ficha técnica"
soma vinho, cerveja e água com prato — e o número fica sem uso, porque metade
dele nunca vai ter ficha. Com ela, o mesmo dado vira dois problemas separados,
com donos diferentes:

| | faturamento/mês | dono |
|---|---:|---|
| precisa de ficha | R$ 1.489.456 (64%) | cozinha: escrever receita |
| revenda | R$ 847.562 (36%) | compras: cadastrar produto e preço |

Cobertura real de ficha, só sobre o que precisa: **37%** (R$ 551 mil de
R$ 1,49 milhão). O número que se via antes (26%) estava diluído pela revenda
no denominador.

Por casa, dentro do que precisa de ficha:

| casa | precisa de ficha | com ficha | % |
|---|---:|---:|---:|
| 104 Sul | 423.874 | 90.977 | 21% |
| Beira Lago | 412.390 | 261.976 | **64%** |
| Noroeste | 307.318 | 82.291 | 27% |
| Wine Garden | 262.984 | 110.736 | 42% |
| Matri | 82.890 | 5.023 | 6% |

O Beira Lago parecia a pior casa (23% sobre o faturamento total) e é a melhor.
A diferença é que quase metade do que ele vende são eventos — ver abaixo.

O faturamento é de setembro/2026 e serve pra dimensionar, não como verdade
corrente. A classificação em si não expira: grupo de vinho segue sendo vinho.

## Decisão: eventos do Beira Lago ficam FORA do CMV

R$ 475 mil/mês em `EVENTOS / TAXAS` — 46% da maior casa do grupo. Linhas como
"MENU EVENTOS - ANIVERSARIO MONICA", "INFRAESTRUTURA, ENXOVAL, ESPAÇO
FECHADO", "ADICIONAL DE HORA EXTRA".

Não existe ficha técnica de "aniversário da Mônica". O custo de um evento é o
consumo real da cozinha naquela noite, e isso só aparece na baixa de estoque —
não numa receita.

**Decidido em 17/09/2026: opção (b) — evento sai do CMV e é medido à parte,
com margem própria.** A alternativa (a) era trazer o evento pro CMV via
contagem de estoque, o que exige a contagem rodando; enquanto ela não roda,
juntar seria inventar número.

Consequência prática: o indicador de CMV do Beira Lago cobre o à la carte e
diz isso explicitamente. Os R$ 475 mil não entram nem como ficha nem como
revenda — ficam com receita medida e custo pendente de estoque.

Quando a contagem estiver rodando, vale reabrir: aí (a) passa a ser possível e
dá um CMV de evento de verdade.
