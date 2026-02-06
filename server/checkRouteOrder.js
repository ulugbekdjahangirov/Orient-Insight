const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRouteOrder() {
  try {
    const routes = await prisma.route.findMany({
      where: { bookingId: 1 },
      orderBy: { date: 'asc' }
    });

    console.log('\n📋 Routes in database (ordered by date):');
    routes.forEach((r, i) => {
      const dateStr = r.date.toISOString().split('T')[0];
      console.log(`  ${i+1}. ${dateStr} - ${r.city || 'N/A'} - ${r.routeName || 'N/A'} (ID: ${r.id})`);
    });

    console.log('\n🔍 Tashkent routes only:');
    const tashkentRoutes = routes.filter(r => (r.city || '').toLowerCase() === 'tashkent');
    tashkentRoutes.forEach((r, i) => {
      const dateStr = r.date.toISOString().split('T')[0];
      console.log(`  ${i+1}. ${dateStr} - ${r.routeName || 'N/A'} (ID: ${r.id})`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRouteOrder();
