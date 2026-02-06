const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function compare() {
  try {
    // Get ER-01 current routes
    const currentRoutes = await prisma.route.findMany({
      where: { bookingId: 1 },
      orderBy: { date: 'asc' }
    });

    // Get ER templates
    const templates = await prisma.routeTemplate.findMany({
      where: { tourTypeCode: 'ER' },
      orderBy: { dayNumber: 'asc' }
    });

    console.log('\n📊 COMPARISON:');
    console.log(`  ER-01 hozirgi routelari: ${currentRoutes.length}`);
    console.log(`  ER template routelari: ${templates.length}\n`);

    console.log('🔄 ER-01 routelari (hozirgi):');
    currentRoutes.forEach((r, i) => {
      console.log(`  ${i+1}. ${r.routeName || 'N/A'}`);
    });

    console.log('\n📝 ER template (database):');
    templates.forEach((t, i) => {
      console.log(`  ${i+1}. ${t.routeName || 'N/A'}`);
    });

    console.log('\n💡 QANDAY YANGILASH:');
    console.log('  1. Brauzerda Marshrut varaqasi tabini oching');
    console.log('  2. "Шаблон сифатида сақлаш" tugmasini bosing');
    console.log('  3. Barcha yangi ER gruppalar uchun yangi shablon ishlatiladi!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

compare();
