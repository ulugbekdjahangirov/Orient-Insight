const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const accommodations = await prisma.accommodation.findMany({
    where: { bookingId: 3 },
    include: { hotel: true },
    orderBy: { id: 'desc' }
  });

  console.log('\n📋 All accommodations for ER-03:\n');
  accommodations.forEach(acc => {
    console.log(`   ${acc.id}. ${acc.hotel.name}: ${acc.checkInDate.toISOString().split('T')[0]} → ${acc.checkOutDate.toISOString().split('T')[0]} (${acc.nights}n) - $${acc.totalCost}`);
  });

  console.log('\n');

  await prisma.$disconnect();
}

check().catch(console.error);
