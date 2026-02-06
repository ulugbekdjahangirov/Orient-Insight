const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const acc = await prisma.accommodation.findUnique({
    where: { id: 1352 },
    include: { hotel: true }
  });

  console.log('\n🏨 Malika Khorazm (ID: 1352):\n');
  console.log(`   Check-in:  ${acc.checkInDate.toISOString().split('T')[0]}`);
  console.log(`   Check-out: ${acc.checkOutDate.toISOString().split('T')[0]}`);
  console.log(`   Nights:    ${acc.nights}`);
  console.log(`   Total:     $${acc.totalCost}\n`);

  await prisma.$disconnect();
}

check().catch(console.error);
