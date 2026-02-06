const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateRoute() {
  try {
    console.log('\n🔄 UPDATING: Hotel- Mahalliy Aeroport → Hotel- Xalqaro Aeroport\n');

    // 1. Find all routes with "Mahalliy Aeroport" in ER bookings
    const routes = await prisma.route.findMany({
      where: {
        routeName: {
          contains: 'Mahalliy Aeroport'
        }
      },
      include: {
        booking: true
      }
    });

    console.log(`📋 Found ${routes.length} routes with "Mahalliy Aeroport":\n`);

    routes.forEach(r => {
      console.log(`  ${r.booking.bookingNumber} - ${r.routeName}`);
    });

    // 2. Update all routes
    console.log('\n🔧 Updating routes...\n');

    for (const route of routes) {
      const newName = route.routeName.replace('Mahalliy Aeroport', 'Xalqaro Aeroport');

      await prisma.route.update({
        where: { id: route.id },
        data: { routeName: newName }
      });

      console.log(`  ✅ ${route.booking.bookingNumber}: ${route.routeName} → ${newName}`);
    }

    // 3. Update ER template
    console.log('\n📝 Updating ER template...\n');

    const templateRoute = await prisma.routeTemplate.findFirst({
      where: {
        tourTypeCode: 'ER',
        routeName: {
          contains: 'Mahalliy Aeroport'
        }
      }
    });

    if (templateRoute) {
      const newTemplateName = templateRoute.routeName.replace('Mahalliy Aeroport', 'Xalqaro Aeroport');

      await prisma.routeTemplate.update({
        where: { id: templateRoute.id },
        data: { routeName: newTemplateName }
      });

      console.log(`  ✅ Template: ${templateRoute.routeName} → ${newTemplateName}`);
    } else {
      console.log('  ⚠️  Template not found');
    }

    console.log('\n✅ ALL DONE! Refresh browser to see changes.\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateRoute();
