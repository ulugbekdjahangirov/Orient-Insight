const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const booking = await prisma.booking.findFirst({
      where: { bookingNumber: 'ER-01' }
    });

    // Simulate the API response
    const routes = await prisma.route.findMany({
      where: { bookingId: booking.id },
      orderBy: [{ sortOrder: 'asc' }, { dayNumber: 'asc' }]
    });

    const apiResponse = { routes };

    console.log('\n📡 API Response Format:');
    console.log('routes array length:', apiResponse.routes?.length || 0);
    console.log('\nFirst route keys:', Object.keys(apiResponse.routes[0] || {}));
    console.log('\nFirst route sample:');
    console.log(JSON.stringify(apiResponse.routes[0], null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
})();
