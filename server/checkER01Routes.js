const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkER01Routes() {
  try {
    const booking = await prisma.booking.findFirst({
      where: { bookingNumber: 'ER-01' },
      include: {
        routes: { orderBy: { dayNumber: 'asc' } },
        tourists: true
      }
    });

    console.log(`ER-01: ${booking.tourists.length} tourists`);
    const paxUzb = booking.tourists.filter(t => !(t.accommodation || '').toLowerCase().includes('turkmen')).length;
    const paxTkm = booking.tourists.filter(t => (t.accommodation || '').toLowerCase().includes('turkmen')).length;
    console.log(`  UZB: ${paxUzb}, TKM: ${paxTkm}\n`);

    console.log('Routes:');
    booking.routes.forEach(r => {
      console.log(`  ${r.dayNumber}. ${r.routeName.padEnd(30)} - ${r.city.padEnd(10)} - PAX: ${r.personCount}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkER01Routes();
