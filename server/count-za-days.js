const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.tourItinerary.findMany({
  where: { tourTypeId: 4 },
  orderBy: { dayNumber: 'asc' }
}).then(items => {
  console.log(`Total itinerary days for ZA: ${items.length}`);
  if (items.length > 0) {
    console.log(`First day: ${items[0].dayNumber}`);
    console.log(`Last day: ${items[items.length - 1].dayNumber}`);
  }
  prisma.$disconnect();
});
