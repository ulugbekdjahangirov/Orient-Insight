const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixTo2Nights() {
  console.log('🔧 Fixing Malika Khorazm to 2 nights (UZ tourists only)...\n');

  const hotel = await prisma.hotel.findFirst({
    where: { name: 'Malika Khorazm' },
    include: { roomTypes: true }
  });

  if (!hotel) {
    console.log('❌ Hotel not found');
    return;
  }

  // Find USD room types
  const dblRoom = hotel.roomTypes.find(rt => rt.name === 'DBL' && rt.currency === 'USD');
  const snglRoom = hotel.roomTypes.find(rt => rt.name === 'SNGL' && rt.currency === 'USD');

  if (!dblRoom || !snglRoom) {
    console.log('❌ USD room types not found');
    return;
  }

  console.log(`📍 Hotel: ${hotel.name}`);
  console.log(`💰 Prices: DBL $${dblRoom.pricePerNight}, SNGL $${snglRoom.pricePerNight}`);

  // Update accommodation dates
  const correctCheckOut = '2025-09-24T00:00:00.000Z'; // 24.09 instead of 25.09
  const correctNights = 2; // 2 nights instead of 3

  console.log(`\n📅 Updating dates:`);
  console.log(`   Check-in:  22.09.2025`);
  console.log(`   Check-out: 25.09.2025 → 24.09.2025`);
  console.log(`   Nights:    3 → 2`);

  await prisma.accommodation.update({
    where: { id: 1322 },
    data: {
      checkOutDate: correctCheckOut,
      nights: correctNights
    }
  });

  // Update room prices for 2 nights
  const accRooms = await prisma.accommodationRoom.findMany({
    where: { accommodationId: 1322 }
  });

  let accommodationTotal = 0;

  console.log(`\n💰 Updating room prices (2 nights):\n`);

  for (const room of accRooms) {
    let pricePerNight;
    if (room.roomTypeCode === 'DBL') {
      pricePerNight = parseFloat(dblRoom.pricePerNight);
    } else if (room.roomTypeCode === 'SNGL') {
      pricePerNight = parseFloat(snglRoom.pricePerNight);
    } else {
      continue;
    }

    const totalCost = room.roomsCount * pricePerNight * correctNights;
    accommodationTotal += totalCost;

    console.log(`   ${room.roomTypeCode}: ${room.roomsCount} × $${pricePerNight} × 2 nights = $${totalCost}`);

    await prisma.accommodationRoom.update({
      where: { id: room.id },
      data: {
        pricePerNight: pricePerNight,
        totalCost: totalCost
      }
    });
  }

  console.log(`\n💵 Total: $${accommodationTotal}`);

  await prisma.accommodation.update({
    where: { id: 1322 },
    data: { totalCost: accommodationTotal }
  });

  console.log('\n✅ Done! Malika Khorazm now shows 2 nights (22.09-24.09)\n');

  await prisma.$disconnect();
}

fixTo2Nights().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
