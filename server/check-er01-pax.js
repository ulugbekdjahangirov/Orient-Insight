const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPax() {
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

    console.log(`\n📊 ER-01 Routes PAX Check:\n`);

    routes.forEach((r, idx) => {
      const highlight = idx >= 11 ? '👉' : '  '; // Highlight rows 12-15
      console.log(`${highlight} ${idx + 1}. ${r.routeName}`);
      console.log(`   personCount: ${r.personCount}`);
      console.log(`   provider: ${r.provider}`);
      console.log('');
    });

    console.log('\n🔍 UZB/TKM Routes:');
    console.log('Row 12 (Khiva-Urgench): personCount =', routes[11]?.personCount);
    console.log('Row 13 (Airport Pickup): personCount =', routes[12]?.personCount);
    console.log('Row 14 (Airport Drop-off): personCount =', routes[13]?.personCount);
    console.log('Row 15 (Khiva-Shovot): personCount =', routes[14]?.personCount);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPax();
