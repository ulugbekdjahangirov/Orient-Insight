const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixToUsd() {
  console.log('🔧 Updating Malika Khorazm to USD prices...\n');

  const hotel = await prisma.hotel.findFirst({
    where: { name: 'Malika Khorazm' },
    include: { roomTypes: true }
  });

  if (!hotel) {
    console.log('❌ Hotel not found');
    return;
  }

  console.log(`📍 Hotel: ${hotel.name}`);

  // Find USD room types
  const dblRoom = hotel.roomTypes.find(rt => rt.name === 'DBL' && rt.currency === 'USD');
  const snglRoom = hotel.roomTypes.find(rt => rt.name === 'SNGL' && rt.currency === 'USD');

  if (!dblRoom || !snglRoom) {
    console.log('❌ USD room types not found');
    return;
  }

  console.log(`\n💰 USD Prices:`);
  console.log(`   DBL: $${dblRoom.pricePerNight}/night`);
  console.log(`   SNGL: $${snglRoom.pricePerNight}/night`);

  // Update accommodation rooms
  const accRooms = await prisma.accommodationRoom.findMany({
    where: { accommodationId: 1322 }
  });

  const nights = 3;
  let accommodationTotal = 0;

  console.log(`\n🔄 Updating accommodation rooms:\n`);

  for (const room of accRooms) {
    let pricePerNight;
    if (room.roomTypeCode === 'DBL') {
      pricePerNight = parseFloat(dblRoom.pricePerNight);
    } else if (room.roomTypeCode === 'SNGL') {
      pricePerNight = parseFloat(snglRoom.pricePerNight);
    } else {
      continue;
    }

    const totalCost = room.roomsCount * pricePerNight * nights;
    accommodationTotal += totalCost;

    console.log(`   ${room.roomTypeCode}: ${room.roomsCount} × $${pricePerNight} × ${nights} nights = $${totalCost}`);

    await prisma.accommodationRoom.update({
      where: { id: room.id },
      data: {
        pricePerNight: pricePerNight,
        totalCost: totalCost
      }
    });
  }

  console.log(`\n💵 Accommodation total: $${accommodationTotal}`);

  await prisma.accommodation.update({
    where: { id: 1322 },
    data: { totalCost: accommodationTotal }
  });

  // Delete UZS room types if they exist
  console.log(`\n🗑️  Deleting UZS room types...`);

  const uzsRoomTypes = hotel.roomTypes.filter(rt => rt.currency === 'UZS');

  for (const rt of uzsRoomTypes) {
    await prisma.roomType.delete({
      where: { id: rt.id }
    });
    console.log(`   ✅ Deleted ${rt.name} (UZS)`);
  }

  console.log('\n✅ Done! Malika Khorazm now uses USD prices.\n');

  await prisma.$disconnect();
}

fixToUsd().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
