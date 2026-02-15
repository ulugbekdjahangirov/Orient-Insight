const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugBooking38() {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: 38 },
      include: { tourType: true }
    });

    console.log('📋 BOOKING 38:');
    console.log('=====================================');
    console.log('departureDate:', booking.departureDate);
    console.log('arrivalDate:', booking.arrivalDate);
    console.log('tourType:', booking.tourType.code);

    const itinerary = await prisma.tourItinerary.findMany({
      where: { tourTypeId: booking.tourTypeId },
      orderBy: { dayNumber: 'asc' }
    });

    console.log('\n🗓️  ITINERARY (KAS TourType):');
    console.log('=====================================');
    itinerary
      .filter(d => d.accommodation)
      .forEach(d => {
        console.log(`Day ${d.dayNumber}: ${d.accommodation}`);
      });

    // Calculate what the dates SHOULD be
    const departureDate = new Date(booking.departureDate);
    const firstHotelDay = Math.min(...itinerary.filter(d => d.accommodation).map(d => d.dayNumber));

    console.log('\n🧮 EXPECTED CALCULATION:');
    console.log('=====================================');
    console.log('departureDate:', departureDate.toISOString().split('T')[0]);
    console.log('firstHotelDay:', firstHotelDay);
    console.log('baseDate should be:', departureDate.toISOString().split('T')[0], '+', (firstHotelDay - 1), 'days');

    const baseDate = new Date(departureDate);
    baseDate.setDate(baseDate.getDate() + (firstHotelDay - 1));
    console.log('baseDate =', baseDate.toISOString().split('T')[0]);

    console.log('\n📅 EXPECTED HOTEL DATES:');
    console.log('=====================================');
    itinerary
      .filter(d => d.accommodation)
      .forEach(d => {
        const checkIn = new Date(baseDate);
        checkIn.setDate(checkIn.getDate() + (d.dayNumber - firstHotelDay));
        console.log(`Day ${d.dayNumber} (${d.accommodation}): ${checkIn.toISOString().split('T')[0]}`);
      });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugBooking38();
