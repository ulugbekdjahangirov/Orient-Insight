const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPriceData() {
  try {
    const count = await prisma.priceConfig.count();
    console.log('Total PriceConfig records:', count);

    if (count > 0) {
      const configs = await prisma.priceConfig.findMany({
        select: {
          id: true,
          tourType: true,
          category: true,
          paxTier: true,
        },
        take: 10
      });

      console.log('\nFirst 10 records:');
      configs.forEach(c => {
        console.log(`  - ${c.tourType} | ${c.category} | ${c.paxTier}`);
      });

      // Group by tour type
      const byTourType = await prisma.priceConfig.groupBy({
        by: ['tourType'],
        _count: true
      });

      console.log('\nRecords by tour type:');
      byTourType.forEach(t => {
        console.log(`  - ${t.tourType}: ${t._count} records`);
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkPriceData();
