const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listHotels() {
  try {
    const hotels = await prisma.hotel.findMany({
      include: { city: true },
      orderBy: { name: 'asc' }
    });

    console.log('\nBarcha mehmonxonalar:\n');
    hotels.forEach(h => {
      console.log('- ' + h.name + ' (' + (h.city?.name || 'N/A') + ')');
    });
    console.log('\nJami: ' + hotels.length + ' ta\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listHotels();
