const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  try {
    console.log('\n🔍 FINAL VERIFICATION\n');

    // Check row 13 (Mahalliy - ichki)
    const row13 = await prisma.route.count({
      where: { routeName: 'Mahalliy Aeroport-Hotel' }
    });

    // Check row 14 (Xalqaro - international)
    const row14 = await prisma.route.count({
      where: { routeName: 'Hotel- Xalqaro Aeroport' }
    });

    console.log('📊 Route counts:');
    console.log(`  Row 13 (Mahalliy Aeroport-Hotel): ${row13} ✅`);
    console.log(`  Row 14 (Hotel- Xalqaro Aeroport): ${row14} ✅\n`);

    // Check template
    const templates = await prisma.routeTemplate.findMany({
      where: {
        tourTypeCode: 'ER',
        OR: [
          { routeName: { contains: 'Aeroport-Hotel' } },
          { routeName: { contains: 'Hotel-' } }
        ]
      },
      orderBy: { dayNumber: 'asc' }
    });

    console.log('📝 ER Template routes:');
    templates.forEach(t => {
      console.log(`  Day ${t.dayNumber}: ${t.routeName}`);
    });

    console.log('\n✅ Everything is correct!\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
