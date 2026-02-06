const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixCity() {
  try {
    console.log('\n🔧 Fixing template city fields...\n');

    // Update row 13 (Mahalliy Aeroport-Hotel)
    const template13 = await prisma.routeTemplate.findFirst({
      where: {
        tourTypeCode: 'ER',
        dayNumber: 13
      }
    });

    if (template13) {
      await prisma.routeTemplate.update({
        where: { id: template13.id },
        data: { city: 'Tashkent' }
      });
      console.log('✅ Row 13: city set to "Tashkent"');
    }

    // Update row 14 (Hotel- Xalqaro Aeroport)
    const template14 = await prisma.routeTemplate.findFirst({
      where: {
        tourTypeCode: 'ER',
        dayNumber: 14
      }
    });

    if (template14) {
      await prisma.routeTemplate.update({
        where: { id: template14.id },
        data: { city: 'Tashkent' }
      });
      console.log('✅ Row 14: city set to "Tashkent"');
    }

    console.log('\n✅ Template fixed!\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixCity();
