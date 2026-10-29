-- Marca o item de venda que a carga criou sozinha.
--
-- A carga de venda passa a cadastrar o item quando a linha traz código do PDV
-- e não casa com nada — ver src/lib/itens-automaticos.ts. Sem esta coluna não
-- há como separar o que alguém cadastrou do que a máquina deduziu, e a lista
-- de "não reconhecidos", que era o aviso de prato novo no cardápio, esvazia
-- sem deixar aviso nenhum no lugar.
--
-- `false` é o passado inteiro: tudo que está no banco hoje foi cadastrado por
-- gente ou por script revisado.
ALTER TABLE "ItemVenda" ADD COLUMN IF NOT EXISTS "criadoAutomaticamente" BOOLEAN NOT NULL DEFAULT false;

-- A tela que lista os automáticos filtra por casa e por esta coluna.
CREATE INDEX IF NOT EXISTS "ItemVenda_unidadeId_criadoAutomaticamente_idx"
  ON "ItemVenda" ("unidadeId", "criadoAutomaticamente");
