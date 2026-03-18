const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function clean() {
  const tourists = await prisma.tourist.findMany({ where: { remarks: { contains: "PAX booked half double" } } });
  console.log("Found:", tourists.length);
  for (const t of tourists) {
    await prisma.tourist.update({ where: { id: t.id }, data: { remarks: null } });
    console.log("Cleared:", t.fullName);
  }
  await prisma.$disconnect();
}
clean().catch(console.error);
