const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function importRoutes() {
  try {
    console.log('📥 Importing routes for booking 23 to database...');

    // Read JSON file
    const data = JSON.parse(fs.readFileSync('booking-23-routes.json', 'utf8'));
    console.log(`Loaded ${data.routes.length} routes from file (exported at ${data.exportedAt})`);
    console.log('');

    // Delete existing routes for booking 23
    const deleted = await prisma.route.deleteMany({
      where: { bookingId: 23 }
    });
    console.log(`🗑️  Deleted ${deleted.count} existing routes for booking 23`);
    console.log('');

    // Insert new routes
    let imported = 0;
    for (const route of data.routes) {
      await prisma.route.create({
        data: {
          bookingId: 23,
          dayNumber: route.dayNumber,
          date: route.date ? new Date(route.date) : null,
          city: route.city,
          itinerary: route.itinerary,
          routeName: route.routeName,
          personCount: route.personCount,
          transportType: route.transportType,
          provider: route.provider,
          optionRate: route.optionRate,
          price: route.price
        }
      });
      imported++;
      console.log(`✓ Imported Day ${route.dayNumber}: ${route.routeName} (${route.personCount} PAX, ${route.transportType || 'N/A'})`);
    }

    console.log('');
    console.log(`✅ Successfully imported ${imported} routes for booking 23`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

importRoutes();
