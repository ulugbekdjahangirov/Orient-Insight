const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  try {
    console.log('\n🔍 VERIFYING ITINERARY MIGRATION\n');

    // Check routes with itinerary data
    const routesWithItinerary = await prisma.route.findMany({
      where: {
        itinerary: { not: null }
      },
      select: {
        id: true,
        routeName: true,
        city: true,
        itinerary: true,
        booking: {
          select: { bookingNumber: true }
        }
      }
    });

    console.log(`✅ Found ${routesWithItinerary.length} routes with itinerary data:\n`);

    routesWithItinerary.forEach(r => {
      console.log(`📌 ${r.booking.bookingNumber} - ${r.routeName}`);
      console.log(`   City: ${r.city || 'N/A'}`);
      console.log(`   Itinerary: ${r.itinerary.substring(0, 80)}...`);
      console.log('');
    });

    // Check if template has itinerary data
    const templatesWithItinerary = await prisma.routeTemplate.findMany({
      where: {
        itinerary: { not: null }
      }
    });

    console.log(`\n📋 Templates with itinerary: ${templatesWithItinerary.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
