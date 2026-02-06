const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixMalika() {
  console.log('🔧 Fixing Malika Khorazm accommodation (ID: 1322)...\n');

  // Get Malika Khorazm hotel to find correct room prices
  const hotel = await prisma.hotel.findFirst({
    where: { name: 'Malika Khorazm' },
    include: { roomTypes: true }
  });

  if (!hotel) {
    console.log('❌ Malika Khorazm hotel not found');
    return;
  }

  console.log(`📍 Found hotel: ${hotel.name} (${hotel.totalRooms} rooms)`);

  // Find UZS room types with tourist tax enabled
  const dblRoom = hotel.roomTypes.find(rt =>
    rt.name === 'DBL' && rt.currency === 'UZS' && rt.touristTaxEnabled
  ) || hotel.roomTypes.find(rt => rt.name === 'DBL');

  const snglRoom = hotel.roomTypes.find(rt =>
    rt.name === 'SNGL' && rt.currency === 'UZS' && rt.touristTaxEnabled
  ) || hotel.roomTypes.find(rt => rt.name === 'SNGL');

  if (!dblRoom || !snglRoom) {
    console.log('❌ DBL or SNGL room type not found');
    return;
  }

  console.log(`\n💰 Correct Prices:`);
  console.log(`   DBL: ${dblRoom.pricePerNight.toLocaleString()} UZS/night`);
  console.log(`   SNGL: ${snglRoom.pricePerNight.toLocaleString()} UZS/night`);

  // Calculate total price with VAT and tourist tax
  const calculateTotalPrice = (roomType, hotelTotalRooms) => {
    if (!roomType) return 0;

    const basePrice = parseFloat(roomType.pricePerNight) || 0;
    const vatAmount = roomType.vatIncluded ? basePrice * 0.12 : 0;
    let totalPrice = basePrice + vatAmount;

    if (roomType.touristTaxEnabled && roomType.brvValue > 0) {
      let taxPercentage = 0.15;
      if (hotelTotalRooms <= 10) taxPercentage = 0.05;
      else if (hotelTotalRooms <= 40) taxPercentage = 0.10;

      const touristTax = roomType.brvValue * taxPercentage * (roomType.maxGuests || 1);
      totalPrice += touristTax;
    }

    return Math.round(totalPrice);
  };

  const dblPricePerNight = calculateTotalPrice(dblRoom, hotel.totalRooms);
  const snglPricePerNight = calculateTotalPrice(snglRoom, hotel.totalRooms);

  console.log(`\n📊 Total Prices (incl. VAT + Tourist Tax):`);
  console.log(`   DBL: ${dblPricePerNight.toLocaleString()} UZS/night`);
  console.log(`   SNGL: ${snglPricePerNight.toLocaleString()} UZS/night`);

  // Update accommodation
  const correctCheckOut = '2025-09-25T00:00:00.000Z'; // Should be 25.09, not 23.09
  const correctNights = 3;

  console.log(`\n🔄 Updating accommodation 1322:`);
  console.log(`   Check-out: 2025-09-23 → 2025-09-25`);
  console.log(`   Nights: 1 → 3`);

  await prisma.accommodation.update({
    where: { id: 1322 },
    data: {
      checkOutDate: correctCheckOut,
      nights: correctNights
    }
  });

  // Update room prices
  const rooms = await prisma.accommodationRoom.findMany({
    where: { accommodationId: 1322 }
  });

  console.log(`\n💰 Updating ${rooms.length} room prices:`);

  for (const room of rooms) {
    let pricePerNight, roomType;

    if (room.roomTypeCode === 'DBL') {
      pricePerNight = dblPricePerNight;
      roomType = dblRoom;
    } else if (room.roomTypeCode === 'SNGL') {
      pricePerNight = snglPricePerNight;
      roomType = snglRoom;
    } else {
      console.log(`   ⚠️  Unknown room type: ${room.roomTypeCode}`);
      continue;
    }

    const totalCost = room.roomsCount * pricePerNight * correctNights;

    console.log(`   ${room.roomTypeCode}: ${room.roomsCount} × ${pricePerNight.toLocaleString()} × ${correctNights} = ${totalCost.toLocaleString()} UZS`);

    await prisma.accommodationRoom.update({
      where: { id: room.id },
      data: {
        pricePerNight: pricePerNight,
        totalCost: totalCost
      }
    });
  }

  // Recalculate accommodation total
  const updatedRooms = await prisma.accommodationRoom.findMany({
    where: { accommodationId: 1322 }
  });

  const totalCost = updatedRooms.reduce((sum, r) => sum + parseFloat(r.totalCost), 0);

  console.log(`\n💵 Updating accommodation total: ${totalCost.toLocaleString()} UZS`);

  await prisma.accommodation.update({
    where: { id: 1322 },
    data: { totalCost: totalCost }
  });

  console.log(`\n✅ Malika Khorazm fixed successfully!\n`);

  await prisma.$disconnect();
}

fixMalika().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
