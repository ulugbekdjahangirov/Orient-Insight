const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMalika() {
  const acc = await prisma.accommodation.findUnique({
    where: { id: 1322 },
    include: {
      hotel: {
        include: { city: true }
      },
      rooms: true
    }
  });

  console.log('\n🏨 Malika Khorazm Accommodation:');
  console.log('   ID:', acc.id);
  console.log('   Hotel:', acc.hotel.name);
  console.log('   City:', acc.hotel.city.name);
  console.log('   Check-in:', acc.checkInDate);
  console.log('   Check-out:', acc.checkOutDate);
  console.log('   Nights:', acc.nights);
  console.log('   Total Cost:', acc.totalCost);
  console.log('   Rooms:', acc.rooms.length);
  console.log('\n💰 Room Details:');
  acc.rooms.forEach(room => {
    console.log(`   - ${room.roomTypeCode}: ${room.roomsCount} rooms × ${room.pricePerNight} × ${acc.nights} nights = ${room.totalCost}`);
  });

  await prisma.$disconnect();
}

checkMalika().catch(console.error);
