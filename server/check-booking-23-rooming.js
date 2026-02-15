const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRooming() {
  const booking = await prisma.booking.findUnique({
    where: { id: 23 },
    include: {
      accommodations: {
        include: {
          hotel: { include: { city: true } },
          roomingList: {
            include: { tourist: true },
            orderBy: { tourist: { lastName: 'asc' } }
          }
        },
        orderBy: { checkInDate: 'asc' }
      },
      tourists: {
        orderBy: { lastName: 'asc' }
      }
    }
  });

  if (!booking) {
    console.log('Booking 23 not found');
    return;
  }

  console.log('='.repeat(80));
  console.log('BOOKING 23:', booking.bookingNumber);
  console.log('Departure Date:', booking.departureDate);
  console.log('Arrival Date:', booking.arrivalDate);
  console.log('='.repeat(80));

  console.log('\nTOURISTS:');
  booking.tourists.forEach(t => {
    console.log(`  ${t.lastName}, ${t.firstName}:`);
    console.log(`    checkInDate: ${t.checkInDate}`);
    console.log(`    checkOutDate: ${t.checkOutDate}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('ACCOMMODATIONS & ROOMING LIST:');
  console.log('='.repeat(80));

  booking.accommodations.forEach((acc, index) => {
    console.log(`\n${index + 1}. ${acc.hotel.name} (${acc.hotel.city.name}) - ID: ${acc.id}`);
    console.log(`   Accommodation Check-in: ${acc.checkInDate}`);
    console.log(`   Accommodation Check-out: ${acc.checkOutDate}`);
    console.log(`   Rooming List (${acc.roomingList.length} tourists):`);

    acc.roomingList.forEach(entry => {
      const t = entry.tourist;
      console.log(`     - ${t.lastName}, ${t.firstName}:`);
      console.log(`       Entry checkInDate: ${entry.checkInDate || 'NULL'}`);
      console.log(`       Entry checkOutDate: ${entry.checkOutDate || 'NULL'}`);
      console.log(`       Tourist checkInDate: ${t.checkInDate}`);
      console.log(`       Tourist checkOutDate: ${t.checkOutDate}`);
    });
  });

  await prisma.$disconnect();
}

checkRooming().catch(e => {
  console.error(e);
  process.exit(1);
});
