-- Impede, no próprio banco, duas linhas de Produto com o mesmo nome variando só
-- a caixa (ex.: "BURRATA" e "Burrata", as duas em KG) na mesma unidade de medida.
--
-- Por que precisa disso, se o código já checa: a constraint que existia,
-- @@unique([nome, unidadeMedida]), não pega esse caso porque texto em Postgres é
-- case-sensitive — "BURRATA" e "Burrata" são valores diferentes pra ela. Foi
-- exatamente essa brecha que produziu o bug de gravação de ficha técnica: quando
-- o ingrediente era resolvido por nome, o lookup casava com a linha errada (ou
-- criava uma terceira grafia) sem ninguém perceber.
--
-- A aplicação já foi corrigida em duas frentes (ficha resolve ingrediente por id,
-- e criar produto pela ficha procura existente ignorando a caixa), mas o banco
-- tem outras portas de entrada que não passam por esse código: SQL direto no
-- console do Neon, os endpoints /api/n8n/*, o seed e os scripts de importação.
-- O índice fecha todas de uma vez.
--
-- É um índice funcional (sobre lower(btrim(nome))), coisa que o schema.prisma não
-- consegue declarar — por isso vem como SQL escrito à mão aqui. ATENÇÃO: como ele
-- não aparece no schema.prisma, um `prisma migrate dev` futuro pode querer gerar
-- uma migração apagando ele. Se isso aparecer no diff, é pra recusar (ver o
-- comentário no model Produto).
--
-- Só aplica num catálogo sem duplicidade. Se falhar com "could not create unique
-- index", é porque voltou a existir grafia duplicada: rode
-- prisma/scripts/produtos-duplicados-01-diagnostico.sql pra ver quais são e
-- prisma/scripts/produtos-duplicados-02-mesclar.sql pra unificar, e só então
-- aplique esta migração.

CREATE UNIQUE INDEX "Produto_nome_ignorando_caixa_unidadeMedida_key"
  ON "Produto" (lower(btrim("nome")), "unidadeMedida");
