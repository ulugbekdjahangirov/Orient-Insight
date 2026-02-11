const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateZATemplate() {
  console.log('🔧 Updating ZA route template with full details...');

  // Delete existing ZA templates
  await prisma.routeTemplate.deleteMany({
    where: { tourTypeCode: 'ZA' }
  });
  console.log('✅ Deleted old ZA templates');

  // Create new complete ZA template
  const zaRoutes = [
    {
      dayNumber: 1,
      dayOffset: 0,
      routeName: 'Olot - Bukhara',
      city: 'Bukhara',
      itinerary: 'Transfer from Olot border to Bukhara',
      provider: 'sevil-za',
      optionRate: 'tagRate',
      sortOrder: 1
    },
    {
      dayNumber: 2,
      dayOffset: 1,
      routeName: 'Bukhara City Tour',
      city: 'Bukhara',
      itinerary: 'Bukhara city sightseeing',
      provider: 'sevil-za',
      optionRate: 'tagRate',
      sortOrder: 2
    },
    {
      dayNumber: 3,
      dayOffset: 2,
      routeName: 'Bukhara City Tour',
      city: 'Bukhara',
      itinerary: 'Bukhara city sightseeing',
      provider: 'sevil-za',
      optionRate: 'tagRate',
      sortOrder: 3
    },
    {
      dayNumber: 4,
      dayOffset: 3,
      routeName: 'Bukhara - Samarkand',
      city: 'Bukhara',
      itinerary: 'Transfer from Bukhara to Samarkand',
      provider: 'sevil-za',
      optionRate: 'tagRate',
      sortOrder: 4
    },
    {
      dayNumber: 5,
      dayOffset: 4,
      routeName: 'Samarkand City Tour',
      city: 'Samarkand',
      itinerary: 'Samarkand city sightseeing',
      provider: 'sevil-za',
      optionRate: 'tagRate',
      sortOrder: 5
    },
    {
      dayNumber: 6,
      dayOffset: 5,
      routeName: 'Samarkand - Jartepa',
      city: 'Samarkand',
      itinerary: 'Transfer from Samarkand to Jartepa border',
      provider: 'sevil-za',
      optionRate: 'jartepaRate',
      sortOrder: 6
    },
    {
      dayNumber: 7,
      dayOffset: 8,
      routeName: 'Oybek - Tashkent',
      city: 'Tashkent',
      itinerary: 'Transfer from Oybek border to Tashkent',
      provider: 'xayrulla',
      optionRate: 'oybek',
      sortOrder: 7
    },
    {
      dayNumber: 8,
      dayOffset: 9,
      routeName: 'Tashkent - Chernyayevka',
      city: 'Tashkent',
      itinerary: 'Transfer to Tashkent airport',
      provider: 'xayrulla',
      optionRate: 'chernyayevka',
      sortOrder: 8
    }
  ];

  // Create all templates
  for (const route of zaRoutes) {
    await prisma.routeTemplate.create({
      data: {
        tourTypeCode: 'ZA',
        ...route
      }
    });
    console.log(`✅ Created: Day ${route.dayNumber} - ${route.routeName}`);
  }

  // Verify
  const templates = await prisma.routeTemplate.findMany({
    where: { tourTypeCode: 'ZA' },
    orderBy: { dayNumber: 'asc' }
  });

  console.log('\n📋 Final ZA Route Templates:');
  templates.forEach(t => {
    console.log(`Day ${t.dayNumber}: ${t.city} - ${t.routeName} (${t.provider}, ${t.optionRate})`);
  });

  await prisma.$disconnect();
}

updateZATemplate().catch(console.error);
