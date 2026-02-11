const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixZAItinerary() {
  try {
    console.log('🔧 Fixing ZA tour itinerary...\n');

    // Get ZA tour type
    const tourType = await prisma.tourType.findFirst({
      where: { code: 'ZA' }
    });

    // Find the Arien Plaza entry on day 7 and update it to day 10
    const arienDay7 = await prisma.tourItinerary.findFirst({
      where: {
        tourTypeId: tourType.id,
        dayNumber: 7,
        accommodation: { contains: 'Arien' }
      }
    });

    if (arienDay7) {
      console.log('Found Arien Plaza on day 7 (WRONG)');
      console.log('Updating to day 10...\n');

      await prisma.tourItinerary.update({
        where: { id: arienDay7.id },
        data: { dayNumber: 10 }
      });

      console.log('✅ Updated Arien Plaza from day 7 to day 10\n');
    }

    // Check day 6 - should have no hotel (Tajikistan)
    const day6 = await prisma.tourItinerary.findFirst({
      where: {
        tourTypeId: tourType.id,
        dayNumber: 6
      }
    });

    if (day6 && day6.accommodation) {
      console.log(`Day 6 has hotel: ${day6.accommodation} (should be empty for Tajikistan)`);
      await prisma.tourItinerary.update({
        where: { id: day6.id },
        data: { accommodation: null }
      });
      console.log('✅ Cleared day 6 accommodation\n');
    }

    // Ensure days 7, 8, 9 exist with no hotel
    for (let day = 7; day <= 9; day++) {
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
            title: `Day ${day}: Tajikistan`,
            accommodation: null
          }
        });
        console.log(`✅ Created day ${day} (Tajikistan - no hotel)`);
      } else if (existing.accommodation) {
        await prisma.tourItinerary.update({
          where: { id: existing.id },
          data: { accommodation: null }
        });
        console.log(`✅ Cleared day ${day} accommodation (Tajikistan)`);
      }
    }

    console.log('\n✅ ZA itinerary fixed!\n');

    // Show updated itinerary
    const updated = await prisma.tourItinerary.findMany({
      where: { tourTypeId: tourType.id },
      orderBy: { dayNumber: 'asc' },
      select: {
        dayNumber: true,
        accommodation: true
      }
    });

    console.log('Updated itinerary:');
    updated.forEach(day => {
      console.log(`  Day ${day.dayNumber}: ${day.accommodation || '(no hotel - Tajikistan)'}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

fixZAItinerary();
