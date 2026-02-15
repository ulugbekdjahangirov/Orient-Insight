const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBookings() {
  try {
    const bookings = await prisma.booking.findMany({
      select: {
        id: true,
        bookingNumber: true,
        tourType: { select: { code: true, name: true } },
        departureDate: true,
        arrivalDate: true,
        _count: {
          select: {
            tourists: true,
            accommodations: true,
            routes: true
          }
        }
      },
      orderBy: { id: 'asc' }
    });

    console.log(`📊 Total bookings in localhost: ${bookings.length}`);
    console.log('');

    bookings.forEach((b, i) => {
      console.log(`${i + 1}. ID: ${b.id}, Number: ${b.bookingNumber}, Type: ${b.tourType?.code || 'N/A'}`);
      console.log(`   Date: ${b.departureDate?.toISOString().split('T')[0] || 'N/A'}`);
      console.log(`   Tourists: ${b._count.tourists}, Accommodations: ${b._count.accommodations}, Routes: ${b._count.routes}`);
    });

    console.log('');
    console.log(`✅ Found ${bookings.length} bookings`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkBookings();
