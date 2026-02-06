const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTemplates() {
  try {
    const count = await prisma.routeTemplate.count({
      where: { tourTypeCode: 'ER' }
    });

    console.log(`\n📋 ER shablon routelari soni: ${count}`);

    if (count > 0) {
      const templates = await prisma.routeTemplate.findMany({
        where: { tourTypeCode: 'ER' },
        orderBy: { dayNumber: 'asc' }
      });

      console.log('\n📝 ER route templates:');
      templates.forEach((t, i) => {
        console.log(`  ${i+1}. Day ${t.dayNumber}: ${t.routeName} - ${t.city || 'N/A'}`);
      });
    } else {
      console.log('\n⚠️  ER uchun hech qanday shablon topilmadi.');
      console.log('   "Шаблон сифатида сақлаш" tugmasini bosing!');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTemplates();
