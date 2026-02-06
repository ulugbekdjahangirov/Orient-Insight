const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addUzsRooms() {
  console.log('🔧 Adding UZS room types to Malika Khorazm...\n');

  const hotel = await prisma.hotel.findFirst({
    where: { name: 'Malika Khorazm' }
  });

  if (!hotel) {
    console.log('❌ Hotel not found');
    return;
  }

  console.log(`📍 Hotel: ${hotel.name} (${hotel.totalRooms} rooms)`);

  // Calculate base prices in UZS
  // USD $50 ≈ 600,000 UZS, USD $33 ≈ 400,000 UZS
  const roomTypes = [
    {
      name: 'DBL',
      displayName: 'Double',
      pricePerNight: 600000,
      currency: 'UZS',
      maxGuests: 2,
      vatIncluded: true,
      touristTaxEnabled: true,
      brvValue: 412000
    },
    {
      name: 'TWN',
      displayName: 'Twin',
      pricePerNight: 600000,
      currency: 'UZS',
      maxGuests: 2,
      vatIncluded: true,
      touristTaxEnabled: true,
      brvValue: 412000
    },
    {
      name: 'SNGL',
      displayName: 'Single',
      pricePerNight: 500000,
      currency: 'UZS',
      maxGuests: 1,
      vatIncluded: true,
      touristTaxEnabled: true,
      brvValue: 412000
    },
    {
      name: 'TRPL',
      displayName: 'Triple',
      pricePerNight: 650000,
      currency: 'UZS',
      maxGuests: 3,
      vatIncluded: true,
      touristTaxEnabled: true,
      brvValue: 412000
    }
  ];

  console.log('\n💰 Creating UZS room types:\n');

  for (const rt of roomTypes) {
    // Check if already exists
    const existing = await prisma.roomType.findFirst({
      where: {
        hotelId: hotel.id,
        name: rt.name,
        currency: 'UZS'
      }
    });

    if (existing) {
      console.log(`   ⚠️  ${rt.name} (UZS) already exists, updating...`);
      await prisma.roomType.update({
        where: { id: existing.id },
        data: rt
      });
    } else {
      console.log(`   ✅ Creating ${rt.name} (UZS): ${rt.pricePerNight.toLocaleString()} UZS/night`);
      await prisma.roomType.create({
        data: {
          ...rt,
          hotelId: hotel.id
        }
      });
    }

    // Calculate total price with taxes for display
    const basePrice = rt.pricePerNight;
    const vat = rt.vatIncluded ? basePrice * 0.12 : 0;
    let totalPrice = basePrice + vat;

    if (rt.touristTaxEnabled && rt.brvValue > 0) {
      let taxPercentage = 0.10; // 24 rooms = 10%
      const touristTax = rt.brvValue * taxPercentage * rt.maxGuests;
      totalPrice += touristTax;
    }

    console.log(`      → Total (incl. VAT + Tax): ${Math.round(totalPrice).toLocaleString()} UZS`);
  }

  console.log('\n✅ UZS room types added successfully!\n');

  // Now update the accommodation
  console.log('🔄 Updating accommodation 1322 with correct prices...\n');

  const dblRoom = await prisma.roomType.findFirst({
    where: {
      hotelId: hotel.id,
      name: 'DBL',
      currency: 'UZS',
      touristTaxEnabled: true
    }
  });

  const snglRoom = await prisma.roomType.findFirst({
    where: {
      hotelId: hotel.id,
      name: 'SNGL',
      currency: 'UZS',
      touristTaxEnabled: true
    }
  });

  // Calculate total prices
  const calculateTotalPrice = (roomType) => {
    const basePrice = parseFloat(roomType.pricePerNight) || 0;
    const vatAmount = roomType.vatIncluded ? basePrice * 0.12 : 0;
    let totalPrice = basePrice + vatAmount;

    if (roomType.touristTaxEnabled && roomType.brvValue > 0) {
      const taxPercentage = 0.10; // 24 rooms
      const touristTax = roomType.brvValue * taxPercentage * (roomType.maxGuests || 1);
      totalPrice += touristTax;
    }

    return Math.round(totalPrice);
  };

  const dblPricePerNight = calculateTotalPrice(dblRoom);
  const snglPricePerNight = calculateTotalPrice(snglRoom);

  console.log(`💰 Calculated prices:`);
  console.log(`   DBL: ${dblPricePerNight.toLocaleString()} UZS/night`);
  console.log(`   SNGL: ${snglPricePerNight.toLocaleString()} UZS/night\n`);

  // Update accommodation rooms
  const accRooms = await prisma.accommodationRoom.findMany({
    where: { accommodationId: 1322 }
  });

  const nights = 3;
  let accommodationTotal = 0;

  for (const room of accRooms) {
    let pricePerNight;
    if (room.roomTypeCode === 'DBL') {
      pricePerNight = dblPricePerNight;
    } else if (room.roomTypeCode === 'SNGL') {
      pricePerNight = snglPricePerNight;
    } else {
      continue;
    }

    const totalCost = room.roomsCount * pricePerNight * nights;
    accommodationTotal += totalCost;

    console.log(`   ${room.roomTypeCode}: ${room.roomsCount} × ${pricePerNight.toLocaleString()} × ${nights} = ${totalCost.toLocaleString()} UZS`);

    await prisma.accommodationRoom.update({
      where: { id: room.id },
      data: {
        pricePerNight: pricePerNight,
        totalCost: totalCost
      }
    });
  }

  console.log(`\n💵 Accommodation total: ${accommodationTotal.toLocaleString()} UZS`);

  await prisma.accommodation.update({
    where: { id: 1322 },
    data: { totalCost: accommodationTotal }
  });

  console.log('\n✅ All done!\n');

  await prisma.$disconnect();
}

addUzsRooms().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
