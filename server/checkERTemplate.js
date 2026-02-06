const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTemplate() {
  try {
    const templates = await prisma.accommodationTemplate.findMany({
      where: { tourTypeCode: 'ER' },
      orderBy: { sortOrder: 'asc' }
    });

    console.log('\nER Template - Accommodations:\n');
    templates.forEach((t, idx) => {
      console.log('Index ' + idx + ': ' + (t.hotelName || 'N/A') + ' (' + (t.cityName || 'N/A') + ')');
      console.log('   checkInOffset: ' + t.checkInOffset + ', checkOutOffset: ' + t.checkOutOffset + ', nights: ' + t.nights);
      console.log('');
    });
    console.log('Jami: ' + templates.length + ' ta\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTemplate();
