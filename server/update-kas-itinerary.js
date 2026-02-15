const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateKASItinerary() {
  try {
    // Get KAS tour type
    const kasTourType = await prisma.tourType.findFirst({
      where: { code: 'KAS' }
    });

    if (!kasTourType) {
      console.log('❌ KAS tour type not found!');
      return;
    }

    console.log(`✅ Found KAS tour type (ID: ${kasTourType.id})`);

    // Get current itinerary
    const itinerary = await prisma.tourItinerary.findMany({
      where: { tourTypeId: kasTourType.id },
      orderBy: { dayNumber: 'asc' }
    });

    console.log(`\n📋 Current itinerary (${itinerary.length} days):`);
    console.log('=====================================');
    itinerary.forEach(day => {
      const acc = day.accommodation ? `🏨 ${day.accommodation}` : '(no hotel)';
      console.log(`Day ${day.dayNumber}: ${day.title} ${acc}`);
    });

    // Calculate offset (current Day 1 should become Day 15)
    const offset = 14;

    console.log(`\n🔄 Updating day numbers (adding +${offset})...`);
    console.log('=====================================');

    // Update each day
    for (const day of itinerary) {
      const newDayNumber = day.dayNumber + offset;

      await prisma.tourItinerary.update({
        where: { id: day.id },
        data: { dayNumber: newDayNumber }
      });

      console.log(`✅ Day ${day.dayNumber} → Day ${newDayNumber}: ${day.title}`);
    }

    // Verify changes
    const updatedItinerary = await prisma.tourItinerary.findMany({
      where: { tourTypeId: kasTourType.id },
      orderBy: { dayNumber: 'asc' }
    });

    console.log(`\n✅ Updated itinerary (${updatedItinerary.length} days):`);
    console.log('=====================================');
    updatedItinerary.forEach(day => {
      const acc = day.accommodation ? `🏨 ${day.accommodation}` : '(no hotel)';
      console.log(`Day ${day.dayNumber}: ${day.title} ${acc}`);
    });

    console.log('\n🎉 Itinerary updated successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateKASItinerary();
