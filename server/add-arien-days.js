const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addArienDays() {
  try {
    console.log('🔧 Adding Arien Plaza days to ZA itinerary...\n');

    // Get ZA tour type
    const tourType = await prisma.tourType.findFirst({
      where: { code: 'ZA' }
    });

    console.log(`Tour type: ${tourType.name} (ID: ${tourType.id})\n`);

    // Add days 11-22 for Arien Plaza (Tashkent)
    let createdCount = 0;
    for (let day = 11; day <= 22; day++) {
      // Check if day already exists
      const existing = await prisma.tourItinerary.findFirst({
        where: {
          tourTypeId: tourType.id,
          dayNumber: day
        }
      });

      if (!existing) {
        await prisma.tourItinerary.create({
          data: {
            tourTypeId: tourType.id,
            dayNumber: day,
            title: `Day ${day}: Tashkent`,
            accommodation: 'Arien Plaza'
          }
        });
        createdCount++;
      } else {
        // Update existing day to have Arien Plaza
        await prisma.tourItinerary.update({
          where: { id: existing.id },
          data: { accommodation: 'Arien Plaza' }
        });
      }
    }

    console.log(`✅ Added/updated ${createdCount} days for Arien Plaza\n`);

    // Show updated itinerary
    const itinerary = await prisma.tourItinerary.findMany({
      where: { tourTypeId: tourType.id },
      orderBy: { dayNumber: 'asc' },
      select: {
        dayNumber: true,
        accommodation: true
      }
    });

    console.log('Updated itinerary:');
    let currentHotel = null;
    let firstDay = null;

    itinerary.forEach((day, idx) => {
      const hotel = day.accommodation || '(no hotel)';
      
      if (hotel !== currentHotel) {
        if (currentHotel && firstDay) {
          console.log(`  Days ${firstDay}-${itinerary[idx-1].dayNumber}: ${currentHotel}`);
        }
        currentHotel = hotel;
        firstDay = day.dayNumber;
      }

      if (idx === itinerary.length - 1) {
        console.log(`  Days ${firstDay}-${day.dayNumber}: ${currentHotel}`);
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

addArienDays();
