import { PrismaClient } from "@prisma/client";
import { processarNotaCompra } from "@/lib/nota-compra";
import { N8N_SERVICE_USER_EMAIL } from "@/lib/constants";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();
const R = String(Date.now());
async function main() {
  const u = await prisma.unidade.upsert({ where: { nome: "Beira Lago" }, update: {}, create: { nome: "Beira Lago" } });
  const hash = await bcrypt.hash("teste123", 10);
  await prisma.usuario.upsert({ where: { email: "admin@teste.com" }, update: {},
    create: { nome: "Admin", email: "admin@teste.com", senhaHash: hash, papel: "ADMIN" } });
  await prisma.usuario.upsert({ where: { email: "gerente@teste.com" }, update: {},
    create: { nome: "Gerente BL", email: "gerente@teste.com", senhaHash: hash, papel: "GERENTE", unidadeId: u.id } });
  const s = await prisma.usuario.upsert({ where: { email: N8N_SERVICE_USER_EMAIL }, update: {},
    create: { nome: "n8n", email: N8N_SERVICE_USER_EMAIL, senhaHash: "x", papel: "ADMIN" } });

  const hoje = new Date().toISOString().slice(0, 10);
  await processarNotaCompra("Beira Lago", "seed", [
    { nome: "ALHO PORO", unidadeMedida: "KG", preco: 13, quantidade: 100, valorTotal: 1300, dataCompra: hoje, chave: `${R}-1` },
    { nome: "SALSA CRESPA", unidadeMedida: "KG", preco: 46, quantidade: 10, valorTotal: 460, dataCompra: hoje, chave: `${R}-2` },
    { nome: "WHISKY LAPHROAIG 10Y 750ML", unidadeMedida: "LT", preco: 628, quantidade: 1.5, valorTotal: 942, dataCompra: hoje, chave: `${R}-3` },
    { nome: "SACO LIXO PRETO 200L BOCA LARGA REFORÇADO COM 100UND", unidadeMedida: "PCT", preco: 126, quantidade: 15, valorTotal: 1890, dataCompra: hoje, chave: `${R}-4` },
    { nome: "PRODUTO SEM CADASTRO NENHUM", unidadeMedida: "KG", preco: 50, quantidade: 8, valorTotal: 400, dataCompra: hoje, chave: `${R}-5` },
  ], s.id, false);
  console.log("seed ok");
  await prisma.$disconnect();
}
main();
