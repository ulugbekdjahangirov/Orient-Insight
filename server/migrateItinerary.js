const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateItinerary() {
  try {
    console.log('\n🔄 Migrating city → itinerary...\n');

    // Find all routes where city field is longer than 50 characters (likely to be itinerary text)
    const routes = await prisma.route.findMany();

    let migratedCount = 0;

    for (const route of routes) {
      const city = route.city || '';

      // If city is too long (more than 50 chars), it's probably itinerary text
      if (city.length > 50) {
        console.log(`Route ${route.id}: "${city.substring(0, 60)}..."`);
        console.log(`  → Moving to itinerary field`);

        // Determine actual city name from routeName
        const routeNameLower = (route.routeName || '').toLowerCase();
        let actualCity = null;

        if (routeNameLower.includes('tashkent') || routeNameLower.includes('toshkent')) {
          actualCity = 'Tashkent';
        } else if (routeNameLower.includes('samarkand') || routeNameLower.includes('samarqand')) {
          actualCity = 'Samarkand';
        } else if (routeNameLower.includes('bukhara') || routeNameLower.includes('buxoro')) {
          actualCity = 'Bukhara';
        } else if (routeNameLower.includes('khiva') || routeNameLower.includes('xiva')) {
          actualCity = 'Khiva';
        } else if (routeNameLower.includes('asraf') || routeNameLower.includes('asref')) {
          actualCity = 'Asraf';
        }

        await prisma.route.update({
          where: { id: route.id },
          data: {
            itinerary: city,
            city: actualCity
          }
        });

        console.log(`  ✅ City set to: ${actualCity || 'null'}\n`);
        migratedCount++;
      }
    }

    console.log(`\n✅ Migration complete! ${migratedCount} routes updated.`);

  } catch (error) {
    console.error('❌ Migration error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateItinerary();
