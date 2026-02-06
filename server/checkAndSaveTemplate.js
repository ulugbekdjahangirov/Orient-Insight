const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAndSave() {
  try {
    console.log('\n🔍 Checking ER-01 current routes...\n');

    // Get ER-01 routes
    const routes = await prisma.route.findMany({
      where: { bookingId: 1 },
      orderBy: { date: 'asc' }
    });

    console.log('📋 ER-01 Routes (current state):\n');
    routes.forEach((r, i) => {
      console.log(`  ${i+1}. ${r.routeName}`);
    });

    console.log('\n🔧 Saving to template...\n');

    // Delete existing templates
    await prisma.routeTemplate.deleteMany({
      where: { tourTypeCode: 'ER' }
    });

    // Create new templates from current routes
    const templateRoutes = routes.map((route, index) => ({
      tourTypeCode: 'ER',
      dayNumber: index + 1,
      dayOffset: index,
      city: route.city || null,
      routeName: route.routeName || '',
      itinerary: route.itinerary || null,
      provider: route.provider || null,
      optionRate: route.optionRate || null,
      sortOrder: index
    }));

    for (const template of templateRoutes) {
      await prisma.routeTemplate.create({ data: template });
    }

    console.log(`✅ Saved ${templateRoutes.length} routes to ER template\n`);

    // Verify
    console.log('📝 Verifying template:\n');
    const savedTemplates = await prisma.routeTemplate.findMany({
      where: { tourTypeCode: 'ER' },
      orderBy: { dayNumber: 'asc' }
    });

    savedTemplates.forEach((t, i) => {
      console.log(`  ${i+1}. ${t.routeName}`);
    });

    console.log('\n✅ Template saved successfully!\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndSave();
