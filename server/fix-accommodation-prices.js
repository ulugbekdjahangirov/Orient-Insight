const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Calculate total price with VAT and tourist tax (same as backend logic)
const calculateTotalPrice = (roomType, hotelTotalRooms) => {
  if (!roomType) return 0;

  const basePrice = parseFloat(roomType.pricePerNight) || 0;

  // Add VAT if included
  const vatAmount = roomType.vatIncluded ? basePrice * 0.12 : 0;
  let totalPrice = basePrice + vatAmount;

  // Add tourist tax if enabled (per person, not per room)
  if (roomType.touristTaxEnabled && roomType.brvValue > 0) {
    // Calculate tax percentage based on hotel's total rooms
    let taxPercentage = 0.15; // default >40 rooms
    if (hotelTotalRooms <= 10) taxPercentage = 0.05;
    else if (hotelTotalRooms <= 40) taxPercentage = 0.10;

    // Tourist tax is calculated per person (maxGuests)
    const touristTax = roomType.brvValue * taxPercentage * (roomType.maxGuests || 1);
    totalPrice += touristTax;
  }

  return Math.round(totalPrice);
};

async function fixPrices() {
  console.log('🔄 Starting price fix for all accommodations...\n');

  // Get all accommodations with their rooms and hotel data
  const accommodations = await prisma.accommodation.findMany({
    include: {
      hotel: {
        include: {
          roomTypes: true
        }
      },
      rooms: true,
      booking: {
        select: {
          bookingNumber: true
        }
      }
    },
    orderBy: { id: 'asc' }
  });

  console.log(`📋 Found ${accommodations.length} accommodations to check\n`);

  for (const acc of accommodations) {
    console.log(`\n🏨 ${acc.hotel.name} (Booking: ${acc.booking.bookingNumber})`);
    console.log(`   ID: ${acc.id}, Nights: ${acc.nights}`);

    let accommodationTotalCost = 0;
    let hasChanges = false;

    for (const room of acc.rooms) {
      // Find the correct room type from hotel with tourist tax enabled
      const correctRoomType = acc.hotel.roomTypes.find(rt =>
        rt.name === room.roomTypeCode && rt.currency === 'UZS' && rt.touristTaxEnabled
      ) || acc.hotel.roomTypes.find(rt => rt.name === room.roomTypeCode);

      if (!correctRoomType) {
        console.log(`   ⚠️  Room type ${room.roomTypeCode} not found in hotel`);
        continue;
      }

      // Calculate correct price per night
      const correctPricePerNight = calculateTotalPrice(correctRoomType, acc.hotel.totalRooms);
      const correctTotalCost = room.roomsCount * correctPricePerNight * acc.nights;

      const oldPrice = Math.round(parseFloat(room.pricePerNight));
      const oldTotal = Math.round(parseFloat(room.totalCost));

      if (oldPrice !== correctPricePerNight || oldTotal !== correctTotalCost) {
        console.log(`   🔧 ${room.roomTypeCode}: ${oldPrice.toLocaleString()} → ${correctPricePerNight.toLocaleString()} UZS/night`);
        console.log(`      Total: ${oldTotal.toLocaleString()} → ${correctTotalCost.toLocaleString()} UZS`);

        // Update the room
        await prisma.accommodationRoom.update({
          where: { id: room.id },
          data: {
            pricePerNight: correctPricePerNight,
            totalCost: correctTotalCost
          }
        });

        hasChanges = true;
      } else {
        console.log(`   ✅ ${room.roomTypeCode}: ${correctPricePerNight.toLocaleString()} UZS/night (correct)`);
      }

      accommodationTotalCost += correctTotalCost;
    }

    // Update accommodation total cost
    const oldAccTotal = Math.round(parseFloat(acc.totalCost));
    if (oldAccTotal !== accommodationTotalCost) {
      console.log(`   💰 Accommodation Total: ${oldAccTotal.toLocaleString()} → ${accommodationTotalCost.toLocaleString()} UZS`);

      await prisma.accommodation.update({
        where: { id: acc.id },
        data: {
          totalCost: accommodationTotalCost
        }
      });

      hasChanges = true;
    }

    if (hasChanges) {
      console.log(`   ✨ Updated!`);
    } else {
      console.log(`   ✅ No changes needed`);
    }
  }

  console.log('\n\n✅ Price fix completed!\n');

  await prisma.$disconnect();
}

fixPrices().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
