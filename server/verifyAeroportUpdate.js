const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  try {
    console.log('\n🔍 VERIFYING UPDATES\n');

    // Check if any old names remain
    const oldRoutes = await prisma.route.findMany({
      where: {
        routeName: { contains: 'Mahalliy Aeroport' }
      }
    });

    console.log(`❌ Old routes remaining: ${oldRoutes.length}`);

    // Check new routes
    const newRoutes = await prisma.route.findMany({
      where: {
        routeName: { contains: 'Xalqaro Aeroport' }
      },
      include: {
        booking: { select: { bookingNumber: true } }
      }
    });

    console.log(`✅ New routes: ${newRoutes.length}\n`);

    // Show sample
    console.log('📋 Sample routes (first 5):');
    newRoutes.slice(0, 5).forEach(r => {
      console.log(`  ${r.booking.bookingNumber}: ${r.routeName}`);
    });

    // Check template
    const template = await prisma.routeTemplate.findFirst({
      where: {
        tourTypeCode: 'ER',
        routeName: { contains: 'Aeroport' }
      }
    });

    console.log(`\n📝 ER Template: ${template?.routeName || 'Not found'}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
