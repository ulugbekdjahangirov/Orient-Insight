const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  console.log('\n🔍 Checking AccommodationRoomingList for accommodation 1358...\n');

  const entries = await prisma.accommodationRoomingList.findMany({
    where: { accommodationId: 1358 },
    include: { tourist: true }
  });

  if (entries.length === 0) {
    console.log('   ✅ No entries found (using accommodation dates)\n');
  } else {
    console.log(`   ⚠️  Found ${entries.length} entries with custom dates:\n`);
    entries.forEach(e => {
      console.log(`   - ${e.tourist.lastName}: ${e.checkInDate?.toISOString().split('T')[0] || 'null'} → ${e.checkOutDate?.toISOString().split('T')[0] || 'null'}`);
    });
    console.log('\n   These override accommodation dates!\n');
  }

  await prisma.$disconnect();
}

check().catch(console.error);
