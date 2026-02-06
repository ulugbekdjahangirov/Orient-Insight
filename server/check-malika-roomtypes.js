const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const hotel = await prisma.hotel.findFirst({
    where: { name: 'Malika Khorazm' },
    include: { roomTypes: { orderBy: { id: 'asc' } } }
  });

  if (!hotel) {
    console.log('❌ Hotel not found');
    return;
  }

  console.log(`\n🏨 ${hotel.name}`);
  console.log(`   Total Rooms: ${hotel.totalRooms}`);
  console.log(`   Active: ${hotel.isActive}\n`);

  console.log('📋 Room Types:');
  hotel.roomTypes.forEach(rt => {
    console.log(`\n   ${rt.name} (${rt.currency}):`);
    console.log(`      ID: ${rt.id}`);
    console.log(`      Price: ${rt.pricePerNight}`);
    console.log(`      Max Guests: ${rt.maxGuests}`);
    console.log(`      VAT: ${rt.vatIncluded ? 'Yes' : 'No'}`);
    console.log(`      Tourist Tax: ${rt.touristTaxEnabled ? 'Yes' : 'No'}`);
    console.log(`      BRV Value: ${rt.brvValue || 0}`);
  });

  await prisma.$disconnect();
}

check().catch(console.error);
