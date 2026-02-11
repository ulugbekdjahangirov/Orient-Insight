const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRouteValues() {
  try {
    const booking = await prisma.booking.findFirst({
      where: { bookingNumber: 'ER-01' }
    });

    if (!booking) {
      console.log('❌ ER-01 not found');
      return;
    }

    const routes = await prisma.route.findMany({
      where: { bookingId: booking.id },
      orderBy: [{ sortOrder: 'asc' }, { dayNumber: 'asc' }]
    });

    console.log(`\n📊 ER-01 Routes (Booking ID ${booking.id}):\n`);

    routes.forEach((r, idx) => {
      console.log(`${idx + 1}. Day ${r.dayNumber}: ${r.routeName}`);
      console.log(`   transportType: "${r.transportType || 'NULL'}"`);
      console.log(`   provider: "${r.provider || 'NULL'}"`);
      console.log(`   optionRate: "${r.optionRate || 'NULL'}"`);
      console.log(`   price: ${r.price}`);
      console.log(`   date: ${r.date ? r.date.toISOString().split('T')[0] : 'NULL'}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRouteValues();
