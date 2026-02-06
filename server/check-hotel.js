const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkHotel() {
  // Check specific hotel by ID
  const hotel = await prisma.hotel.findUnique({
    where: { id: 3 },
    include: { city: true }
  });

  if (hotel) {
    console.log('\n🏨 Hotel ID 3:');
    console.log('   Name:', hotel.name);
    console.log('   City:', hotel.city.name);
    console.log('   Active:', hotel.isActive);
    console.log('   Stars:', hotel.stars);
  } else {
    console.log('\n❌ Hotel ID 3 not found in database');
  }

  // Check all hotels in Tashkent
  const tashkentHotels = await prisma.hotel.findMany({
    where: {
      city: {
        name: 'Ташкент'
      }
    },
    orderBy: { id: 'asc' }
  });

  console.log('\n📋 All hotels in Tashkent:');
  tashkentHotels.forEach(h => {
    console.log(`   ${h.isActive ? '✓' : '✗'} ${h.name} (ID: ${h.id}) - Active: ${h.isActive}`);
  });

  await prisma.$disconnect();
}

checkHotel().catch(console.error);
