const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const booking = await prisma.booking.findUnique({
    where: { id: 3 }
  });

  console.log('\n📅 Booking ER-03:');
  console.log('   Number:', booking.bookingNumber);
  console.log('   Departure:', booking.departureDate);
  console.log('   End:', booking.endDate);

  const accommodations = await prisma.accommodation.findMany({
    where: { bookingId: 3 },
    include: { hotel: true },
    orderBy: { checkInDate: 'asc' }
  });

  console.log('\n🏨 Accommodations:');
  accommodations.forEach(acc => {
    console.log(`   ${acc.id}. ${acc.hotel.name}: ${acc.checkInDate.toISOString().split('T')[0]} → ${acc.checkOutDate.toISOString().split('T')[0]} (${acc.nights}n)`);
  });

  await prisma.$disconnect();
}

check().catch(console.error);
