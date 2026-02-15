const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.tourType.findFirst({
  where: { code: 'ZA' },
  include: {
    itinerary: {
      orderBy: { dayNumber: 'asc' }
    }
  }
}).then(tourType => {
  if (!tourType) {
    console.log('ZA tour type not found');
  } else {
    console.log('Tour Type:', tourType.code, '-', tourType.name);
    console.log('\nItinerary:');
    tourType.itinerary.forEach(item => {
      const hotel = item.accommodation ? `[${item.accommodation}]` : '[No hotel]';
      console.log(`Day ${item.dayNumber}: ${hotel} ${item.description?.substring(0, 80) || 'No description'}`);
    });
  }
  return prisma.$disconnect();
});
