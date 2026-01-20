const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const tables = await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`;
    console.log('Tables in database:');
    tables.forEach(t => console.log(' -', t.name));

    // Check if Accommodation table exists and has data
    const accCount = await prisma.accommodation.count();
    console.log('\nAccommodation records:', accCount);

    const accRoomCount = await prisma.accommodationRoom.count();
    console.log('AccommodationRoom records:', accRoomCount);
  } catch (e) {
    console.log('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
