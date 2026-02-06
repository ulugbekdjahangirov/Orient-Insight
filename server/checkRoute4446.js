const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRoute() {
  try {
    const route = await prisma.route.findUnique({
      where: { id: 4446 }
    });

    console.log('\n🔍 Route ID 4446 details:');
    console.log('  ID:', route.id);
    console.log('  Date:', route.date.toISOString().split('T')[0]);
    console.log('  City:', `"${route.city}"`);
    console.log('  City (lowercase):', `"${(route.city || '').toLowerCase()}"`);
    console.log('  Route Name:', route.routeName);
    console.log('  Description:', route.itinerary);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRoute();
