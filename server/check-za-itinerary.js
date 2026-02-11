const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkZAItinerary() {
  try {
    console.log('🔍 Checking ZA tour itinerary...\n');

    // Get ZA tour type
    const tourType = await prisma.tourType.findFirst({
      where: { code: 'ZA' },
      select: { id: true, name: true }
    });

    if (!tourType) {
      console.log('❌ ZA tour type not found');
      return;
    }

    console.log(`Tour type: ${tourType.name} (ID: ${tourType.id})\n`);

    // Get itinerary
    const itinerary = await prisma.tourItinerary.findMany({
      where: { tourTypeId: tourType.id },
      orderBy: { dayNumber: 'asc' },
      select: {
        id: true,
        dayNumber: true,
        accommodation: true,
        title: true
      }
    });

    if (itinerary.length === 0) {
      console.log('❌ No itinerary found for ZA tour type\n');
      console.log('This is why "Из программы тура" button doesn\'t work correctly.');
      console.log('Solution: Use "Load Template" button instead, or create ZA itinerary.');
      return;
    }

    console.log(`Found ${itinerary.length} days in itinerary:\n`);

    let currentHotel = null;
    let hotelDays = [];

    itinerary.forEach((day) => {
      const hotel = day.accommodation || '(no hotel)';
      console.log(`Day ${day.dayNumber}: ${hotel}`);

      if (hotel !== '(no hotel)') {
        if (hotel !== currentHotel) {
          if (hotelDays.length > 0) {
            console.log(`  → ${currentHotel}: Days ${hotelDays[0]}-${hotelDays[hotelDays.length - 1]} (${hotelDays.length} nights)\n`);
          }
          currentHotel = hotel;
          hotelDays = [day.dayNumber];
        } else {
          hotelDays.push(day.dayNumber);
        }
      }
    });

    if (hotelDays.length > 0) {
      console.log(`  → ${currentHotel}: Days ${hotelDays[0]}-${hotelDays[hotelDays.length - 1]} (${hotelDays.length} nights)\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkZAItinerary();
