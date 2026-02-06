const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function activateHotel() {
  console.log('🔄 Activating Hotel Uzbekistan (ID: 3)...');

  const hotel = await prisma.hotel.update({
    where: { id: 3 },
    data: { isActive: true },
    include: { city: true }
  });

  console.log('✅ Hotel activated successfully!');
  console.log('   Name:', hotel.name);
  console.log('   City:', hotel.city.name);
  console.log('   Active:', hotel.isActive);
  console.log('   Stars:', hotel.stars);

  await prisma.$disconnect();
}

activateHotel().catch(console.error);
