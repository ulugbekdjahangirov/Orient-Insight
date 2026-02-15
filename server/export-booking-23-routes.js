const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function exportRoutes() {
  try {
    console.log('📤 Exporting routes for booking 23 from local database...');

    // Get all routes for booking 23
    const routes = await prisma.route.findMany({
      where: { bookingId: 23 },
      orderBy: { dayNumber: 'asc' }
    });

    console.log(`Found ${routes.length} routes for booking 23`);
    console.log('');

    if (routes.length > 0) {
      routes.forEach((route, i) => {
        console.log(`${i + 1}. Day ${route.dayNumber}: ${route.date} - ${route.routeName} (${route.personCount} PAX, ${route.transportType || 'N/A'})`);
      });
    }

    // Save to JSON file
    const data = {
      bookingId: 23,
      exportedAt: new Date().toISOString(),
      routes: routes.map(r => ({
        dayNumber: r.dayNumber,
        date: r.date,
        city: r.city,
        itinerary: r.itinerary,
        routeName: r.routeName,
        personCount: r.personCount,
        transportType: r.transportType,
        provider: r.provider,
        optionRate: r.optionRate,
        price: r.price
      }))
    };

    fs.writeFileSync('booking-23-routes.json', JSON.stringify(data, null, 2));
    console.log('');
    console.log('✅ Routes exported to booking-23-routes.json');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

exportRoutes();
