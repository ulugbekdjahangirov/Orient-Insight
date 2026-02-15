const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findHotel() {
  // Search for hotels with "Old" or "Tashkent" in name
  const hotels = await prisma.hotel.findMany({
    include: { city: true },
    orderBy: { name: 'asc' }
  });

  console.log('='.repeat(80));
  console.log('SEARCHING FOR "OLD TASHKENT" HOTELS:');
  console.log('='.repeat(80));

  const oldTashkentHotels = hotels.filter(h => {
    const name = h.name.toLowerCase();
    return name.includes('old') || name.includes('олд');
  });

  if (oldTashkentHotels.length > 0) {
    console.log(`\nFound ${oldTashkentHotels.length} hotels with "Old" in name:`);
    oldTashkentHotels.forEach(h => {
      console.log(`  ID: ${h.id}, Name: ${h.name}, City: ${h.city.name}`);
    });
  } else {
    console.log('\nNo hotels with "Old" found');
  }

  console.log('\n' + '='.repeat(80));
  console.log('ALL TASHKENT HOTELS:');
  console.log('='.repeat(80));

  const tashkentHotels = hotels.filter(h => {
    const cityName = h.city.name.toLowerCase();
    return cityName.includes('tashkent') || cityName.includes('ташкент') || cityName.includes('toshkent');
  });

  tashkentHotels.forEach(h => {
    console.log(`  ID: ${h.id}, Name: ${h.name}`);
  });

  await prisma.$disconnect();
}

findHotel().catch(e => {
  console.error(e);
  process.exit(1);
});
