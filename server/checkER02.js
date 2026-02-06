const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkER02() {
  try {
    const booking = await prisma.booking.findFirst({
      where: { bookingNumber: 'ER-02' },
      include: {
        routes: { orderBy: { dayNumber: 'asc' } },
        tourists: true
      }
    });

    console.log(`ER-02: ${booking.tourists.length} tourists`);
    const paxUzb = booking.tourists.filter(t => !(t.accommodation || '').toLowerCase().includes('turkmen')).length;
    const paxTkm = booking.tourists.filter(t => (t.accommodation || '').toLowerCase().includes('turkmen')).length;
    console.log(`  UZB: ${paxUzb}, TKM: ${paxTkm}\n`);

    console.log('Routes:');
    booking.routes.forEach(r => {
      const paxDisplay = r.personCount.toString().padStart(2);
      console.log(`  ${r.dayNumber.toString().padStart(2)}. ${r.routeName.padEnd(30)} - ${r.city.padEnd(10)} - PAX: ${paxDisplay}`);
    });

    console.log('\nProblem routes:');
    console.log(`  12. Khiva - Urgench should have ${paxTkm} PAX (Turkmenistan)`);
    console.log(`  13. Mahalliy Aeroport-Hotel should have ${paxUzb} PAX (Uzbekistan)`);
    console.log(`  15. Khiva - Shovot should have ${paxTkm} PAX (Turkmenistan)`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkER02();
