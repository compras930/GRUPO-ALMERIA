-- Fator de conversão entre a embalagem de COMPRA e a unidade do PRODUTO.
--
-- O PROBLEMA. O Teknisa compra microverde por bandeja, ovo por caixa de 360,
-- pelati por lata de 2,5 kg. O cadastro guarda microverde em KG, ovo em UND,
-- pelati em KG. Até aqui o resolvedor recusava a linha (UNIDADE_DIVERGENTE) e
-- fazia certo: R$ 170 de uma caixa de ovos gravado como preço de UM ovo
-- multiplicaria o custo de toda ficha que usa ovo por 360.
--
-- Eram 24 produtos e R$ 32 mil de compra parada — sem erro nenhum no dado, só
-- faltando um número que o sistema não tinha onde guardar.
--
-- O QUE O FATOR SIGNIFICA: quanto da unidade do produto cabe em UMA unidade de
-- compra.
--
--   MICROVERDE (KG) comprado em UND, fator 0.040  -> 1 bandeja = 40 g
--   OVOS (UND)      comprado em CX,  fator 360    -> 1 caixa   = 360 ovos
--   TOMATE PELATI (KG) comprado em LA, fator 2.5  -> 1 lata    = 2,5 kg
--
-- E a conta que a carga passa a fazer:
--   preço por unidade do produto = valor da nota ÷ fator
--   quantidade que entra em estoque = quantidade da nota × fator
--
-- Confere com o dado real: caixa de ovos a R$ 170 ÷ 360 = R$ 0,4722, que é
-- exatamente o preço que já estava cadastrado para o ovo avulso.
--
-- É GLOBAL, não por casa: a embalagem do fornecedor é a mesma no grupo todo.
-- Se um dia deixar de ser, vira (produto, unidade, casa) — mas inventar essa
-- terceira dimensão agora seria complexidade sem caso que a justifique.
CREATE TABLE IF NOT EXISTS "ConversaoUnidadeCompra" (
  "id"            TEXT NOT NULL,
  "produtoId"     TEXT NOT NULL,
  "unidadeCompra" TEXT NOT NULL,
  "fator"         DOUBLE PRECISION NOT NULL,
  "observacao"    TEXT,
  "criadoEm"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConversaoUnidadeCompra_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ConversaoUnidadeCompra_produtoId_unidadeCompra_key"
  ON "ConversaoUnidadeCompra" ("produtoId", "unidadeCompra");

ALTER TABLE "ConversaoUnidadeCompra"
  ADD CONSTRAINT "ConversaoUnidadeCompra_produtoId_fkey"
  FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
