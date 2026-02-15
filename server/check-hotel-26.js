const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkHotel() {
  // Get hotel 26 info
  const hotel = await prisma.hotel.findUnique({
    where: { id: 26 },
    include: { city: true }
  });

  if (!hotel) {
    console.log('Hotel 26 not found');
    return;
  }

  console.log('='.repeat(80));
  console.log('HOTEL 26:', hotel.name);
  console.log('City:', hotel.city.name);
  console.log('='.repeat(80));

  // Find all accommodations for this hotel
  const accommodations = await prisma.accommodation.findMany({
    where: { hotelId: 26 },
    include: {
      booking: {
        include: {
          tourType: true
        }
      }
    },
    orderBy: [
      { bookingId: 'asc' },
      { checkInDate: 'asc' }
    ]
  });

  console.log(`\nFound ${accommodations.length} accommodations using Hotel 26:`);

  // Group by booking
  const bookingGroups = {};
  accommodations.forEach(acc => {
    if (!bookingGroups[acc.bookingId]) {
      bookingGroups[acc.bookingId] = [];
    }
    bookingGroups[acc.bookingId].push(acc);
  });

  Object.keys(bookingGroups).forEach(bookingId => {
    const accs = bookingGroups[bookingId];
    const booking = accs[0].booking;
    console.log(`\n  Booking ${bookingId} (${booking.bookingNumber}) - ${booking.tourType?.code}:`);
    console.log(`    Hotel 26 used ${accs.length} times in this booking:`);
    accs.forEach((acc, index) => {
      console.log(`      Visit ${index + 1}: Acc ID ${acc.id}, ${acc.checkInDate} → ${acc.checkOutDate}`);
    });
  });

  await prisma.$disconnect();
}

checkHotel().catch(e => {
  console.error(e);
  process.exit(1);
});
