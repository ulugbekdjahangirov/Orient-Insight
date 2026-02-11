const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTouristDates() {
  try {
    console.log('🔍 Checking tourist dates for ZA-05...\n');

    const tourists = await prisma.tourist.findMany({
      where: { bookingId: 52 },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        fullName: true,
        checkInDate: true,
        checkOutDate: true
      }
    });

    console.log(`Found ${tourists.length} tourists:\n`);

    tourists.forEach((t, i) => {
      const checkIn = t.checkInDate ? t.checkInDate.toISOString().split('T')[0] : 'NULL';
      const checkOut = t.checkOutDate ? t.checkOutDate.toISOString().split('T')[0] : 'NULL';
      console.log(`${i+1}. ${t.fullName}`);
      console.log(`   Check-in: ${checkIn}`);
      console.log(`   Check-out: ${checkOut}`);
      console.log('');
    });

    // Also check booking dates
    const booking = await prisma.booking.findUnique({
      where: { id: 52 },
      select: {
        bookingNumber: true,
        departureDate: true,
        endDate: true
      }
    });

    console.log('📅 Booking dates:');
    console.log(`   Departure: ${booking.departureDate.toISOString().split('T')[0]}`);
    console.log(`   End: ${booking.endDate.toISOString().split('T')[0]}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTouristDates();
