const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkZATemplate() {
  try {
    console.log('🔍 Checking ZA template...\n');

    const templates = await prisma.accommodationTemplate.findMany({
      where: { tourTypeCode: 'ZA' },
      orderBy: { checkInOffset: 'asc' },
      select: {
        id: true,
        hotelName: true,
        checkInOffset: true,
        checkOutOffset: true,
        nights: true
      }
    });

    console.log(`Found ${templates.length} hotels in ZA template:\n`);

    templates.forEach((t, i) => {
      console.log(`${i+1}. ${t.hotelName}`);
      console.log(`   checkInOffset: ${t.checkInOffset} (day ${t.checkInOffset + 1})`);
      console.log(`   checkOutOffset: ${t.checkOutOffset} (day ${t.checkOutOffset + 1})`);
      console.log(`   nights: ${t.nights}`);
      console.log('');
    });

    // Check booking ZA-05 dates
    const booking = await prisma.booking.findFirst({
      where: { bookingNumber: 'ZA-05' },
      select: {
        id: true,
        departureDate: true,
        endDate: true
      }
    });

    if (booking) {
      console.log('📅 ZA-05 Booking dates:');
      console.log(`   Departure: ${booking.departureDate.toISOString().split('T')[0]}`);
      console.log(`   End: ${booking.endDate.toISOString().split('T')[0]}`);

      const arrival = new Date(booking.departureDate);
      arrival.setDate(arrival.getDate() + 4);
      console.log(`   Arrival in UZ: ${arrival.toISOString().split('T')[0]} (departure + 4 days)`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkZATemplate();
