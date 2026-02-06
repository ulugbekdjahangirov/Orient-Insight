const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateAllER() {
  try {
    console.log('\n🔄 Updating ALL ER groups from template...\n');

    // Get template
    const templates = await prisma.routeTemplate.findMany({
      where: { tourTypeCode: 'ER' },
      orderBy: { dayNumber: 'asc' }
    });

    console.log(`📝 Template has ${templates.length} routes\n`);

    // Get all ER bookings
    const erBookings = await prisma.booking.findMany({
      where: {
        tourType: {
          code: 'ER'
        }
      },
      select: { id: true, bookingNumber: true }
    });

    console.log(`📊 Found ${erBookings.length} ER bookings\n`);

    let updatedCount = 0;

    for (const booking of erBookings) {
      console.log(`🔧 Processing ${booking.bookingNumber}...`);

      // Get current routes
      const currentRoutes = await prisma.route.findMany({
        where: { bookingId: booking.id },
        orderBy: { date: 'asc' }
      });

      // Update row 13 and 14 only
      if (currentRoutes.length >= 14) {
        // Update row 13 (index 12)
        const route13 = currentRoutes[12];
        if (route13 && route13.routeName !== 'Mahalliy Aeroport-Hotel') {
          await prisma.route.update({
            where: { id: route13.id },
            data: { routeName: 'Mahalliy Aeroport-Hotel' }
          });
          console.log(`  ✅ Row 13: ${route13.routeName} → Mahalliy Aeroport-Hotel`);
          updatedCount++;
        }

        // Update row 14 (index 13)
        const route14 = currentRoutes[13];
        if (route14 && route14.routeName !== 'Hotel- Xalqaro Aeroport') {
          await prisma.route.update({
            where: { id: route14.id },
            data: { routeName: 'Hotel- Xalqaro Aeroport' }
          });
          console.log(`  ✅ Row 14: ${route14.routeName} → Hotel- Xalqaro Aeroport`);
          updatedCount++;
        }
      }
    }

    console.log(`\n✅ DONE! Updated ${updatedCount} routes across ${erBookings.length} ER bookings\n`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateAllER();
