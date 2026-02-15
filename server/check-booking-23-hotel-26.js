const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBooking() {
  const booking = await prisma.booking.findUnique({
    where: { id: 23 },
    include: {
      accommodations: {
        include: {
          hotel: {
            include: { city: true }
          }
        },
        orderBy: { checkInDate: 'asc' }
      },
      tourType: true
    }
  });

  if (!booking) {
    console.log('Booking 23 not found');
    return;
  }

  console.log('='.repeat(80));
  console.log('BOOKING 23:', booking.bookingNumber);
  console.log('Tour Type:', booking.tourType?.code, '-', booking.tourType?.name);
  console.log('='.repeat(80));

  console.log('\nALL ACCOMMODATIONS:');
  booking.accommodations.forEach((acc, index) => {
    console.log(`${index + 1}. ID: ${acc.id}, Hotel ID: ${acc.hotelId}, Hotel: ${acc.hotel.name} (${acc.hotel.city.name})`);
    console.log(`   Check-in: ${acc.checkInDate}, Check-out: ${acc.checkOutDate}`);
  });

  // Find hotel 26
  const hotel26 = booking.accommodations.find(acc => acc.hotelId === 26);
  if (hotel26) {
    console.log('\n' + '='.repeat(80));
    console.log('HOTEL 26:', hotel26.hotel.name);
    console.log('='.repeat(80));

    // Count how many times they stay at this hotel
    const sameHotelAccommodations = booking.accommodations.filter(acc => acc.hotelId === 26);
    console.log(`\nGroup stays at Hotel 26 (${hotel26.hotel.name}) ${sameHotelAccommodations.length} times:`);
    sameHotelAccommodations.forEach((acc, index) => {
      console.log(`  Visit ${index + 1}: Accommodation ID ${acc.id}, ${acc.checkInDate} → ${acc.checkOutDate}`);
    });
  } else {
    console.log('\nHotel 26 not found in this booking');
  }

  await prisma.$disconnect();
}

checkBooking().catch(e => {
  console.error(e);
  process.exit(1);
});
