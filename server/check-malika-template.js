const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const templates = await prisma.accommodationTemplate.findMany({
    where: { tourTypeCode: 'ER' },
    include: { hotel: true },
    orderBy: { sortOrder: 'asc' }
  });

  const malika = templates.find(t =>
    t.hotel.name.toLowerCase().includes('malika') &&
    t.hotel.name.toLowerCase().includes('khorazm')
  );

  if (malika) {
    console.log('\n📋 Malika Khorazm Template:\n');
    console.log(`   Hotel: ${malika.hotel.name}`);
    console.log(`   Check-in offset:  ${malika.checkInOffset} days`);
    console.log(`   Check-out offset: ${malika.checkOutOffset} days`);
    console.log(`   Nights: ${malika.nights}`);
    console.log('\n   Example (departure 13.09):');
    const dep = new Date('2025-09-13');
    const checkIn = new Date(dep);
    checkIn.setDate(checkIn.getDate() + malika.checkInOffset);
    const checkOut = new Date(dep);
    checkOut.setDate(checkOut.getDate() + malika.checkOutOffset);
    console.log(`   ${checkIn.toISOString().split('T')[0]} → ${checkOut.toISOString().split('T')[0]}`);
    console.log(`   Days: ${(checkOut - checkIn) / (1000*60*60*24)}\n`);
  } else {
    console.log('\n❌ Malika Khorazm template not found\n');
  }

  await prisma.$disconnect();
}

check().catch(console.error);
