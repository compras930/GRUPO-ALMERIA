import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const UNIDADES = ["Beira Lago", "104 Sul", "Noroeste", "Matri", "Wine Garden"];

async function main() {
  for (const nome of UNIDADES) {
    await prisma.unidade.upsert({
      where: { nome },
      update: {},
      create: { nome },
    });
  }

  const senhaAdmin = process.env.SEED_ADMIN_SENHA || "almeria123";
  const emailAdmin = process.env.SEED_ADMIN_EMAIL || "admin@grupoalmeria.com.br";
  const senhaHash = await bcrypt.hash(senhaAdmin, 10);

  await prisma.usuario.upsert({
    where: { email: emailAdmin },
    update: {},
    create: {
      nome: "Administrador",
      email: emailAdmin,
      senhaHash,
      papel: "ADMIN",
    },
  });

  console.log("Seed concluído.");
  console.log(`Unidades criadas: ${UNIDADES.join(", ")}`);
  console.log(`Usuário admin: ${emailAdmin} / senha: ${senhaAdmin} (troque depois do primeiro login)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
