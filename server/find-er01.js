const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findER01() {
  try {
    // Find ER-01 booking
    const booking = await prisma.booking.findFirst({
      where: {
        bookingNumber: 'ER-01'
      },
      include: {
        tourType: true
      }
    });

    if (!booking) {
      console.log('❌ ER-01 not found!');
      return;
    }

    console.log(`\n✅ Found ER-01: ID = ${booking.id}`);
    console.log(`   Departure: ${booking.departureDate?.toISOString().split('T')[0]}`);
    console.log(`   Tour Type: ${booking.tourType?.code}\n`);

    // Check routes for this booking
    const routes = await prisma.route.findMany({
      where: { bookingId: booking.id },
      orderBy: { dayNumber: 'asc' }
    });

    console.log(`📊 Routes in database: ${routes.length}\n`);

    if (routes.length === 0) {
      console.log('❌ NO ROUTES! They are not being saved.\n');
    } else {
      routes.forEach((r, i) => {
        const date = r.date ? r.date.toISOString().split('T')[0] : 'NO DATE';
        console.log(`${i+1}. Day ${r.dayNumber}: ${date} - ${r.routeName}`);
      });
      console.log('');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findER01();
