const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBooking() {
  const booking = await prisma.booking.findUnique({
    where: { id: 1 },
    include: {
      tourType: {
        include: {
          itinerary: {
            orderBy: { dayNumber: 'asc' }
          }
        }
      },
      tourists: {
        orderBy: { lastName: 'asc' }
      },
      accommodations: {
        include: {
          hotel: {
            include: { city: true }
          },
          rooms: true
        },
        orderBy: { checkInDate: 'asc' }
      },
      routes: {
        orderBy: { date: 'asc' }
      }
    }
  });

  if (!booking) {
    console.log('Booking 1 not found');
    return;
  }

  console.log('='.repeat(80));
  console.log('BOOKING 1:', booking.bookingNumber);
  console.log('Tour Type:', booking.tourType?.code, '-', booking.tourType?.name);
  console.log('Departure Date:', booking.departureDate);
  console.log('Arrival Date:', booking.arrivalDate);
  console.log('End Date:', booking.endDate);
  console.log('PAX:', booking.pax);
  console.log('Guide:', booking.guide?.name || 'N/A');
  console.log('='.repeat(80));

  console.log('\nTOURISTS:', booking.tourists.length);
  booking.tourists.forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.lastName}, ${t.firstName}`);
    console.log(`     Check-in: ${t.checkInDate?.toISOString().split('T')[0]}, Check-out: ${t.checkOutDate?.toISOString().split('T')[0]}`);
    console.log(`     Accommodation: ${t.accommodation || 'N/A'}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('ACCOMMODATIONS:', booking.accommodations.length);
  console.log('='.repeat(80));
  booking.accommodations.forEach((acc, i) => {
    console.log(`\n${i + 1}. ${acc.hotel.name} (${acc.hotel.city.name})`);
    console.log(`   Check-in: ${acc.checkInDate?.toISOString().split('T')[0]}`);
    console.log(`   Check-out: ${acc.checkOutDate?.toISOString().split('T')[0]}`);
    console.log(`   Rooms: ${acc.rooms.length}`);
    acc.rooms.forEach(room => {
      console.log(`     - ${room.roomTypeCode}: ${room.roomsCount} rooms × ${room.nights} nights = ${room.totalCost} UZS`);
    });
    console.log(`   Total Cost: ${acc.totalCost || 'N/A'} UZS`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('ROUTES:', booking.routes.length);
  console.log('='.repeat(80));
  booking.routes.forEach((route, i) => {
    console.log(`${i + 1}. ${route.date?.toISOString().split('T')[0]}: ${route.route}`);
    console.log(`   ${route.from} → ${route.to}`);
    console.log(`   PAX: ${route.pax}, Vehicle: ${route.vehicle || 'N/A'}`);
  });

  if (booking.tourType?.itinerary) {
    console.log('\n' + '='.repeat(80));
    console.log('ITINERARY:', booking.tourType.itinerary.length, 'days');
    console.log('='.repeat(80));
    booking.tourType.itinerary.slice(0, 5).forEach(item => {
      console.log(`Day ${item.dayNumber}: ${item.accommodation || 'No hotel'}`);
      if (item.description) {
        console.log(`  ${item.description.substring(0, 60)}...`);
      }
    });
    if (booking.tourType.itinerary.length > 5) {
      console.log(`  ... (${booking.tourType.itinerary.length - 5} more days)`);
    }
  }

  await prisma.$disconnect();
}

checkBooking().catch(e => {
  console.error(e);
  process.exit(1);
});
