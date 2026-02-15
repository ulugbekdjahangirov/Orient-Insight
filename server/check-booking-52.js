const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.booking.findUnique({
  where: { id: 52 },
  include: {
    tourType: {
      include: {
        itinerary: {
          orderBy: { dayNumber: 'asc' }
        }
      }
    },
    tourists: { take: 3 }
  }
}).then(b => {
  if (!b) {
    console.log('Booking 52 not found');
  } else {
    console.log('Booking 52:', b.bookingNumber);
    console.log('Tour Type:', b.tourType?.code, '-', b.tourType?.name);
    console.log('Dates:', b.departureDate, 'to', b.endDate);
    console.log('Arrival Date:', b.arrivalDate);
    console.log('Tourists count:', b.tourists.length);
    if(b.tourists.length > 0) console.log('First tourist checkInDate:', b.tourists[0].checkInDate);

    if (b.tourType?.itinerary && b.tourType.itinerary.length > 0) {
      console.log('\nItinerary (first 5 days):');
      b.tourType.itinerary.slice(0, 5).forEach(item => {
        console.log(`  Day ${item.dayNumber}: ${item.description?.substring(0, 60)}...`);
      });
      console.log(`  ... (${b.tourType.itinerary.length} days total)`);
    }
  }
  return prisma.$disconnect();
});
