-- Um produto, vários códigos de compra.
--
-- `Produto.codigoTeknisa` guarda UM código, e o Teknisa tem um código POR
-- EMBALAGEM: o litro de leite é 105060008520 e a caixa com doze é
-- 105060008521. Cabe um só, e o outro fica eternamente sem casar. Criar um
-- segundo produto "Leite integral 12x1L" resolveria o pareamento e quebraria
-- toda ficha que usa o primeiro — o custo passaria a sair de dois lugares.
--
-- Levantado em 23/09/2026 no dado real das três casas: 107 códigos e
-- R$ 86.794 de compra travados exatamente nisso. Nenhum deles precisa de
-- decisão humana; faltava onde guardar.
--
-- NADA É APAGADO AQUI. `codigoTeknisa` e `ConversaoUnidadeCompra` continuam
-- onde estão, e o casamento tenta esta tabela primeiro e cai neles depois.
-- A remoção é outra migração, depois de uma carga semanal inteira rodar limpa.
--
-- Ver o comentário do model em prisma/schema.prisma para a regra de unidade e
-- para por que `origem` existe desde já.

CREATE TABLE IF NOT EXISTS "CodigoCompraProduto" (
  "id"            TEXT NOT NULL,
  "origem"        TEXT NOT NULL DEFAULT 'TEKNISA',
  "codigo"        TEXT NOT NULL,
  "produtoId"     TEXT NOT NULL,
  "unidadeCompra" TEXT NOT NULL,
  "fator"         DOUBLE PRECISION NOT NULL DEFAULT 1,
  "observacao"    TEXT,
  "criadoEm"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CodigoCompraProduto_pkey" PRIMARY KEY ("id")
);

-- A origem entra na chave porque o XMenu de Beira Lago e CPD tem espaço de
-- código próprio, e nada garante que um número dele não colida com um do
-- Teknisa. A unidade entra porque o mesmo código chega ora na unidade do
-- produto, ora na embalagem — ver o comentário do model no schema.
CREATE UNIQUE INDEX IF NOT EXISTS "CodigoCompraProduto_origem_codigo_unidadeCompra_key"
  ON "CodigoCompraProduto" ("origem", "codigo", "unidadeCompra");

-- Busca do casamento: todas as linhas de um código, para conferir a unidade.
CREATE INDEX IF NOT EXISTS "CodigoCompraProduto_origem_codigo_idx"
  ON "CodigoCompraProduto" ("origem", "codigo");

-- Para listar os códigos de um produto na tela de cadastro.
CREATE INDEX IF NOT EXISTS "CodigoCompraProduto_produtoId_idx"
  ON "CodigoCompraProduto" ("produtoId");

-- As duas constraints abaixo vão em DO/EXCEPTION porque o Postgres não tem
-- `ADD CONSTRAINT IF NOT EXISTS`: sem isso, rodar este arquivo duas vezes
-- morre em "constraint already exists" — e o resto do projeto todo assume que
-- dá pra repetir um passo sem medo. Descoberto rodando de novo, não lendo.

-- Fator zero ou negativo divide o preço por zero e zera a entrada de estoque.
-- O núcleo puro já ignora cadastro assim; o banco recusa, que é mais barato.
DO $$ BEGIN
  ALTER TABLE "CodigoCompraProduto"
    ADD CONSTRAINT "CodigoCompraProduto_fator_positivo" CHECK ("fator" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CodigoCompraProduto"
    ADD CONSTRAINT "CodigoCompraProduto_produtoId_fkey"
    FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
