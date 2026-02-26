const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const all = await prisma.systemSetting.findMany();
  console.log('All SystemSettings:');
  all.forEach(s => console.log('  ' + s.key + ' = ' + s.value));
}
main().catch(console.error).finally(() => prisma.$disconnect());
