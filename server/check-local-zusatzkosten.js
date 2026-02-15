const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLocalZusatzkosten() {
  try {
    const zusatzkosten = await prisma.priceConfig.findMany({
      where: { category: 'zusatzkosten' }
    });

    console.log('Local Zusatzkosten count:', zusatzkosten.length);
    console.log('');

    if (zusatzkosten.length > 0) {
      zusatzkosten.forEach(z => {
        const items = JSON.parse(z.itemsJson);
        console.log(`${z.tourType}/${z.paxTier}: ${items.length} items`);
        if (items.length > 0) {
          console.log('  Sample:', items[0]);
        }
      });
    } else {
      console.log('❌ No Zusatzkosten data in local database!');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkLocalZusatzkosten();
