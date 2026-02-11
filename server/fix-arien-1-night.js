const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixArienPlaza() {
  try {
    console.log('🔧 Fixing Arien Plaza to 1 night only...\n');

    // Update accommodation template
    const template = await prisma.accommodationTemplate.findFirst({
      where: {
        tourTypeCode: 'ZA',
        hotelId: 16  // Arien Plaza
      }
    });

    if (template) {
      console.log('Current template:');
      console.log(`  checkInOffset: ${template.checkInOffset}`);
      console.log(`  checkOutOffset: ${template.checkOutOffset}`);
      console.log(`  nights: ${template.nights}\n`);

      await prisma.accommodationTemplate.update({
        where: { id: template.id },
        data: {
          checkInOffset: 9,   // 31.08 + 9 = 09.09
          checkOutOffset: 10, // 31.08 + 10 = 10.09
          nights: 1           // Only 1 night
        }
      });

      console.log('✅ Updated template:');
      console.log('  checkInOffset: 9 (09.09)');
      console.log('  checkOutOffset: 10 (10.09)');
      console.log('  nights: 1\n');
    }

    // Update itinerary - remove days 11-22 Arien Plaza, replace with Kazakhstan (no hotel)
    const tourType = await prisma.tourType.findFirst({
      where: { code: 'ZA' }
    });

    // Remove Arien Plaza from days 11-22
    const arienDays = await prisma.tourItinerary.findMany({
      where: {
        tourTypeId: tourType.id,
        dayNumber: { gte: 11, lte: 22 },
        accommodation: 'Arien Plaza'
      }
    });

    for (const day of arienDays) {
      await prisma.tourItinerary.update({
        where: { id: day.id },
        data: { 
          accommodation: null,
          title: `Day ${day.dayNumber}: Kazakhstan`
        }
      });
    }

    console.log(`✅ Updated ${arienDays.length} days: Arien Plaza → Kazakhstan (no hotel)\n`);

    // Show final itinerary
    const itinerary = await prisma.tourItinerary.findMany({
      where: { tourTypeId: tourType.id },
      orderBy: { dayNumber: 'asc' },
      select: {
        dayNumber: true,
        accommodation: true,
        title: true
      }
    });

    console.log('Final itinerary:');
    itinerary.forEach(day => {
      console.log(`  Day ${day.dayNumber}: ${day.accommodation || '(no hotel - ' + (day.title || 'other country') + ')'}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixArienPlaza();
