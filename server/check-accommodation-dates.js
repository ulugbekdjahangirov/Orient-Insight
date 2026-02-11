const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAccommodationDates() {
  try {
    console.log('🔍 Checking accommodation dates for ZA-05 (booking 52)...\n');

    const accs = await prisma.accommodation.findMany({
      where: { bookingId: 52 },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        hotel: { select: { name: true } },
        checkInDate: true,
        checkOutDate: true,
        nights: true
      }
    });

    console.log(`Found ${accs.length} accommodations:\n`);

    accs.forEach((a, i) => {
      console.log(`${i+1}. ${a.hotel.name} (ID: ${a.id})`);
      console.log(`   Check-in: ${a.checkInDate.toISOString().split('T')[0]}`);
      console.log(`   Check-out: ${a.checkOutDate.toISOString().split('T')[0]}`);
      console.log(`   Nights: ${a.nights}`);
      console.log('');
    });

    // Also check booking departure date
    const booking = await prisma.booking.findUnique({
      where: { id: 52 },
      select: {
        bookingNumber: true,
        departureDate: true,
        endDate: true,
        tourType: { select: { code: true } }
      }
    });

    console.log('📅 Booking info:');
    console.log(`   Number: ${booking.bookingNumber}`);
    console.log(`   Tour type: ${booking.tourType.code}`);
    console.log(`   Departure: ${booking.departureDate.toISOString().split('T')[0]}`);
    console.log(`   End: ${booking.endDate.toISOString().split('T')[0]}`);
    console.log('');
    console.log('❗ For ZA tours: Arrival in Uzbekistan = departure + 4 days');
    const arrivalDate = new Date(booking.departureDate);
    arrivalDate.setDate(arrivalDate.getDate() + 4);
    console.log(`   Expected arrival in UZ: ${arrivalDate.toISOString().split('T')[0]}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAccommodationDates();
