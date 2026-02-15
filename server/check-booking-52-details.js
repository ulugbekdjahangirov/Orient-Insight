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
    tourists: true,
    accommodations: {
      include: {
        hotel: {
          include: { city: true }
        }
      },
      orderBy: { checkInDate: 'asc' }
    }
  }
}).then(b => {
  console.log('='.repeat(60));
  console.log('BOOKING 52:', b.bookingNumber);
  console.log('Tour Type:', b.tourType.code, '-', b.tourType.name);
  console.log('Departure Date:', b.departureDate);
  console.log('End Date:', b.endDate);
  console.log('Arrival Date:', b.arrivalDate);
  console.log('='.repeat(60));
  
  console.log('\nTOURISTS:');
  b.tourists.forEach(t => {
    console.log(`  ${t.firstName} ${t.lastName} - checkIn: ${t.checkInDate}, checkOut: ${t.checkOutDate}`);
  });
  
  console.log('\nACCOMMODATIONS:');
  b.accommodations.forEach(acc => {
    console.log(`  ${acc.hotel.name} (${acc.hotel.city.name}): ${acc.checkInDate} → ${acc.checkOutDate}`);
  });
  
  console.log('\nITINERARY:');
  b.tourType.itinerary.forEach(item => {
    const hotel = item.accommodation || 'No hotel';
    console.log(`  Day ${item.dayNumber}: [${hotel}]`);
  });
  
  prisma.$disconnect();
});
