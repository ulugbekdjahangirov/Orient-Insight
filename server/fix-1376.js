const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  console.log('🔧 Fixing Malika Khorazm (1376) checkout date to 24.09...\n');

  await prisma.accommodation.update({
    where: { id: 1376 },
    data: {
      checkOutDate: new Date('2025-09-24T00:00:00.000Z')
    }
  });

  console.log('✅ Updated: 22.09-23.09 → 22.09-24.09\n');

  const updated = await prisma.accommodation.findUnique({
    where: { id: 1376 },
    include: { hotel: true }
  });

  console.log(`Verify: ${updated.hotel.name}`);
  console.log(`   ${updated.checkInDate.toISOString().split('T')[0]} → ${updated.checkOutDate.toISOString().split('T')[0]}`);
  console.log(`   ${updated.nights} nights, $${updated.totalCost}\n`);

  await prisma.$disconnect();
}

fix().catch(console.error);
