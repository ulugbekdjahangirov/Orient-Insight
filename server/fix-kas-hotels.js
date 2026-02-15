const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixKASHotels() {
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

    console.log(`\n📋 BEFORE UPDATE:`);
    console.log('=====================================');
    itinerary.forEach(day => {
      const acc = day.accommodation || '(no hotel)';
      console.log(`Day ${day.dayNumber}: ${day.title} - ${acc}`);
    });

    // Correct hotel mapping based on user's requirements:
    // 1. Ziyorat Hotel - Day 15: 15.09-16.09 (1 night)
    // 2. Hotel Dargoh - Day 17-18: 17.09-19.09 (2 nights)
    // 3. Jahongir - Day 19-20: 19.09-21.09 (2 nights)
    // 4. Arien Plaza - Day 21-22: 21.09-23.09 (2 nights)

    const updates = [
      { dayNumber: 15, hotel: 'Ziyorat Hotel' },
      { dayNumber: 16, hotel: null }, // No hotel on Day 16 (travel day)
      { dayNumber: 17, hotel: 'Dargoh Hotel' },
      { dayNumber: 18, hotel: 'Dargoh Hotel' }, // Same hotel (2 nights)
      { dayNumber: 19, hotel: 'Jahongir' },
      { dayNumber: 20, hotel: 'Jahongir' }, // Same hotel (2 nights)
      { dayNumber: 21, hotel: 'Arien Plaza' },
      { dayNumber: 22, hotel: 'Arien Plaza' }, // Same hotel (2 nights)
      { dayNumber: 23, hotel: null } // No hotel on departure day
    ];

    console.log(`\n🔄 UPDATING hotels in itinerary...`);
    console.log('=====================================');

    for (const update of updates) {
      const day = itinerary.find(d => d.dayNumber === update.dayNumber);

      if (day) {
        await prisma.tourItinerary.update({
          where: { id: day.id },
          data: { accommodation: update.hotel }
        });

        console.log(`✅ Day ${update.dayNumber}: ${update.hotel || '(no hotel)'}`);
      }
    }

    // Verify changes
    const updatedItinerary = await prisma.tourItinerary.findMany({
      where: { tourTypeId: kasTourType.id },
      orderBy: { dayNumber: 'asc' }
    });

    console.log(`\n✅ AFTER UPDATE:`);
    console.log('=====================================');
    updatedItinerary.forEach(day => {
      const acc = day.accommodation || '(no hotel)';
      console.log(`Day ${day.dayNumber}: ${day.title} - ${acc}`);
    });

    console.log('\n🎉 KAS hotels updated successfully!');
    console.log('\n📋 Expected accommodations when "KAS Hotels" button is pressed:');
    console.log('=====================================');
    console.log('1. Ziyorat Hotel - Day 15: 15.09-16.09 (1 night)');
    console.log('2. Hotel Dargoh - Day 17-18: 17.09-19.09 (2 nights)');
    console.log('3. Jahongir - Day 19-20: 19.09-21.09 (2 nights)');
    console.log('4. Arien Plaza - Day 21-22: 21.09-23.09 (2 nights)');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixKASHotels();
