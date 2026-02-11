const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRoutes() {
  try {
    const routes = await prisma.route.findMany({
      where: { bookingId: 38 },
      orderBy: { dayNumber: 'asc' }
    });

    console.log(`\n📊 Routes in database for ER-01 (booking 38): ${routes.length}\n`);

    if (routes.length === 0) {
      console.log('❌ NO ROUTES FOUND! Routes were not saved or were deleted.\n');
    } else {
      routes.forEach((r, i) => {
        const date = r.date ? r.date.toISOString().split('T')[0] : 'NO DATE';
        console.log(`${i+1}. Day ${r.dayNumber}: ${date} - ${r.routeName} (${r.provider || 'no provider'}, ${r.transportType || 'no vehicle'})`);
      });
      console.log('');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRoutes();
