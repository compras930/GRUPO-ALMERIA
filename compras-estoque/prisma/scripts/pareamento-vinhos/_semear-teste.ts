// Gera o SQL que semeia um banco LOCAL com o catálogo e a carta exportados de
// produção, pra rodar aplicar-vinhos.sql contra um schema de verdade antes de
// encostar no Neon.
//
//   npx tsx prisma/scripts/pareamento-vinhos/_semear-teste.ts \
//       <catalogo.csv> <carta.csv> [saida.sql]
//
// Só para teste local. O underscore no nome marca isso, como os outros
// scripts de apoio do projeto.
import { readFileSync, writeFileSync } from "node:fs";

const txt = (v: unknown) => String(v ?? "").trim();
const sql = (s: unknown) => `'${String(s).replace(/'/g, "''")}'`;

function lerCsv(caminho: string): Record<string, string>[] {
  const linhas = readFileSync(caminho, "utf8").split(/\r?\n/).filter((l) => l.trim() !== "");
  const partir = (linha: string): string[] => {
    const out: string[] = [];
    let atual = "";
    let dentro = false;
    for (let i = 0; i < linha.length; i++) {
      const c = linha[i];
      if (c === '"') {
        if (dentro && linha[i + 1] === '"') { atual += '"'; i++; }
        else dentro = !dentro;
      } else if (c === "," && !dentro) { out.push(atual); atual = ""; }
      else atual += c;
    }
    out.push(atual);
    return out;
  };
  const cab = partir(linhas[0]).map((h) => h.trim());
  return linhas.slice(1).map((l) => Object.fromEntries(partir(l).map((v, i) => [cab[i], v])));
}

function main() {
  const [arqCatalogo, arqCarta, saida = "/tmp/semear-teste.sql"] = process.argv.slice(2);
  const catalogo = lerCsv(arqCatalogo);
  const carta = lerCsv(arqCarta);

  const linhasSql: string[] = [];
  const p = (s: string) => linhasSql.push(s);

  p(`INSERT INTO "Unidade" (id, nome, ativo, "criadoEm") VALUES ('u-wg', 'Wine Garden', true, now()) ON CONFLICT DO NOTHING;`);
  p(`INSERT INTO "Usuario" (id, nome, email, "senhaHash", papel, ativo, "criadoEm") VALUES ('u-svc','svc','svc@x','x','ADMIN',true,now()) ON CONFLICT DO NOTHING;`);

  p(`INSERT INTO "Produto" (id, nome, "unidadeMedida", "codigoTeknisa", ativo, "criadoEm") VALUES`);
  p(catalogo.map((c) =>
    `  (${sql(c.id)}, ${sql(c.nome)}, ${sql(c.unidade)}, ${txt(c.codigo) ? sql(txt(c.codigo)) : "NULL"}, ${c.ativo === "t"}, now())`
  ).join(",\n") + " ON CONFLICT DO NOTHING;");

  // Receita de mentira para cada ficha que já existe, só pra chave estrangeira
  // de ItemVenda.receitaId ter onde apontar.
  const comFicha = carta.filter((v) => txt(v.receita_id));
  if (comFicha.length) {
    p(`INSERT INTO "Receita" (id, "unidadeId", nome, "criadoEm", "atualizadoEm") VALUES`);
    p([...new Map(comFicha.map((v) => [txt(v.receita_id), v])).values()]
      .map((v) => `  (${sql(txt(v.receita_id))}, 'u-wg', ${sql("ficha existente " + txt(v.receita_id))}, now(), now())`)
      .join(",\n") + " ON CONFLICT DO NOTHING;");
  }

  p(`INSERT INTO "ItemVenda" (id, "unidadeId", tipo, nome, "precoVenda", ativo, "receitaId", "criadoEm", "atualizadoEm") VALUES`);
  p(carta.map((v) =>
    `  (${sql(v.id)}, 'u-wg', 'VINHO', ${sql(v.nome)}, ${Number(v.preco_venda) || 0}, ${v.ativo === "t"}, ${txt(v.receita_id) ? sql(txt(v.receita_id)) : "NULL"}, now(), now())`
  ).join(",\n") + " ON CONFLICT DO NOTHING;");

  writeFileSync(saida, linhasSql.join("\n") + "\n");
  console.log(`${catalogo.length} produtos, ${carta.length} itens de venda, ${comFicha.length} com ficha -> ${saida}`);

}

main();
