const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixZAItinerary() {
  // Delete current itinerary
  await prisma.tourItinerary.deleteMany({
    where: { tourTypeId: 4 }
  });
  console.log('✓ Deleted old ZA itinerary');

  // Create new correct itinerary
  const newItinerary = [
    { day: 1, hotel: 'Dargoh Hotel', title: 'Auf nach Usbekistan', desc: 'Ankunft in Buchara' },
    { day: 2, hotel: 'Dargoh Hotel', title: 'Mausoleen, Moscheen', desc: 'Buchara Stadtbesichtigung' },
    { day: 3, hotel: 'Dargoh Hotel', title: 'Ein Nachmittag für dich', desc: 'Buchara Freizeit' },
    { day: 4, hotel: 'Jahongir', title: 'Auf der Route der alten Seidenstraße', desc: 'Fahrt nach Samarkand' },
    { day: 5, hotel: 'Jahongir', title: 'Seidenpapier und Nekropole', desc: 'Samarkand Besichtigung' },
    { day: 6, hotel: '', title: 'Auf nach Tadschikistan', desc: 'Tag 1 in Tadschikistan' },
    { day: 7, hotel: '', title: 'Tadschikistan', desc: 'Tag 2 in Tadschikistan' },
    { day: 8, hotel: '', title: 'Tadschikistan', desc: 'Tag 3 in Tadschikistan' },
    { day: 9, hotel: '', title: 'Tadschikistan', desc: 'Tag 4 in Tadschikistan' },
    { day: 10, hotel: 'Arien Plaza', title: 'Zurück nach Usbekistan', desc: 'Tashkent - 1 Nacht' },
    { day: 11, hotel: '', title: 'Auf nach Kasachstan', desc: 'Weiterreise nach Kasachstan' }
  ];

  for (const item of newItinerary) {
    await prisma.tourItinerary.create({
      data: {
        tourTypeId: 4,
        dayNumber: item.day,
        accommodation: item.hotel || null,
        title: item.title,
        description: item.desc
      }
    });
  }
  
  console.log('✓ Created new ZA itinerary with 11 days');
  console.log('  - Days 1-3: Dargoh Hotel (Bukhara) - 3 nights');
  console.log('  - Days 4-5: Jahongir (Samarkand) - 2 nights');
  console.log('  - Days 6-9: Tajikistan (no hotel) - 4 days');
  console.log('  - Day 10: Arien Plaza (Tashkent) - 1 night');
  console.log('  - Day 11: Kazakhstan (no hotel)');
  
  await prisma.$disconnect();
}

fixZAItinerary();
