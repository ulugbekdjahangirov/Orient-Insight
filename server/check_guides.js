const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const guides = await prisma.guide.findMany({
    orderBy: { id: 'asc' },
    select: { id: true, firstName: true, lastName: true, passportNumber: true, bankAccountNumber: true, bankCardNumber: true }
  });
  guides.forEach(g => {
    console.log(`[${g.id}] ${g.firstName} ${g.lastName}`);
    console.log(`    passport:    ${g.passportNumber || 'null'}`);
    console.log(`    bankAccount: ${g.bankAccountNumber || 'null'}`);
    console.log(`    bankCard:    ${g.bankCardNumber || 'null'}`);
  });
}
main().catch(console.error).finally(() => prisma.$disconnect());
