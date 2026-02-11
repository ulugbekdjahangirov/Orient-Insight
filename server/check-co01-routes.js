const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCORoutes() {
  try {
    const booking = await prisma.booking.findFirst({
      where: { bookingNumber: 'CO-01' },
      include: { tourType: true }
    });

    if (!booking) {
      console.log('❌ CO-01 not found');
      return;
    }

    console.log(`\n📊 CO-01 (${booking.tourType?.code}):\n`);
    console.log(`Departure: ${booking.departureDate?.toISOString().split('T')[0]}`);
    console.log(`Total tourists: ${booking.pax}\n`);

    const routes = await prisma.route.findMany({
      where: { bookingId: booking.id },
      orderBy: [{ sortOrder: 'asc' }, { dayNumber: 'asc' }]
    });

    console.log(`Routes in database: ${routes.length}\n`);

    if (routes.length === 0) {
      console.log('❌ NO ROUTES SAVED IN DATABASE!\n');
      return;
    }

    routes.forEach((r, idx) => {
      console.log(`${idx + 1}. Day ${r.dayNumber}: ${r.routeName}`);
      console.log(`   Date: ${r.date ? r.date.toISOString().split('T')[0] : 'NULL'}`);
      console.log(`   PAX: ${r.personCount}`);
      console.log(`   Provider: ${r.provider || 'NULL'}`);
      console.log(`   Vehicle: ${r.transportType || 'NULL'}`);
      console.log(`   Rate: ${r.optionRate || 'NULL'}`);
      console.log(`   Price: $${r.price || 0}`);
      console.log('');
    });

    // Check for specific routes with split PAX (like Fergana routes)
    const ferganaRoutes = routes.filter(r => r.city === 'Fergana');
    if (ferganaRoutes.length > 0) {
      console.log('\n🔍 Fergana Routes (check for PAX splits):');
      ferganaRoutes.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.routeName}: PAX = ${r.personCount}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCORoutes();
