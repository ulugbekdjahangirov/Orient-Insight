const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTemplate() {
  try {
    const templates = await prisma.routeTemplate.findMany({
      where: { tourTypeCode: 'ER' },
      orderBy: { sortOrder: 'asc' }
    });

    console.log(`\n📋 ER Template in Database (${templates.length} routes):\n`);
    console.log('# | Day | Offset | Route Name                    | City       | Provider | Rate');
    console.log('-'.repeat(100));

    templates.forEach((t, i) => {
      const day = t.dayNumber.toString().padStart(2);
      const offset = t.dayOffset.toString().padStart(2);
      const route = (t.routeName || '').padEnd(30);
      const city = (t.city || '').padEnd(10);
      const provider = (t.provider || '').padEnd(8);
      const rate = t.optionRate || '';

      console.log(`${(i+1).toString().padStart(2)} | ${day}  | ${offset}     | ${route} | ${city} | ${provider} | ${rate}`);
    });

    console.log('\n✅ Template is ready!');
    console.log('When you click "Load Template" or "Fix Vehicles" in new ER groups, this template will be used.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTemplate();
