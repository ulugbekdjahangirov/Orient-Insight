const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCity() {
  try {
    const templates = await prisma.routeTemplate.findMany({
      where: {
        tourTypeCode: 'ER',
        dayNumber: { in: [13, 14] }
      },
      orderBy: { dayNumber: 'asc' }
    });

    console.log('\n📋 Template rows 13-14:\n');
    templates.forEach(t => {
      console.log(`Day ${t.dayNumber}:`);
      console.log(`  City: "${t.city || 'NULL'}"`);
      console.log(`  Route: "${t.routeName}"`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCity();
