const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function finalCheck() {
  try {
    console.log('\n✅ FINAL CHECK - ALL ER GROUPS\n');

    // Get all ER bookings
    const erBookings = await prisma.booking.findMany({
      where: {
        tourType: { code: 'ER' }
      },
      select: {
        id: true,
        bookingNumber: true,
        routes: {
          orderBy: { date: 'asc' },
          select: { routeName: true }
        }
      },
      orderBy: { bookingNumber: 'asc' }
    });

    console.log('📊 Checking rows 13-14 for all ER groups:\n');

    erBookings.forEach(booking => {
      const row13 = booking.routes[12]?.routeName || 'N/A';
      const row14 = booking.routes[13]?.routeName || 'N/A';

      const status13 = row13 === 'Mahalliy Aeroport-Hotel' ? '✅' : '❌';
      const status14 = row14 === 'Hotel- Xalqaro Aeroport' ? '✅' : '❌';

      console.log(`${booking.bookingNumber}:`);
      console.log(`  Row 13: ${row13} ${status13}`);
      console.log(`  Row 14: ${row14} ${status14}\n`);
    });

    // Check template
    console.log('\n📝 ER Template (rows 13-14):');
    const templates = await prisma.routeTemplate.findMany({
      where: {
        tourTypeCode: 'ER',
        dayNumber: { in: [13, 14] }
      },
      orderBy: { dayNumber: 'asc' }
    });

    templates.forEach(t => {
      console.log(`  Row ${t.dayNumber}: ${t.routeName}`);
    });

    console.log('\n✅ Check complete!\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

finalCheck();
