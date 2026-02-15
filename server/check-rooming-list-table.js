const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRoomingTable() {
  // Check accommodationRoomingList table for booking 1 (ER-01)
  const entries = await prisma.accommodationRoomingList.findMany({
    where: {
      accommodation: {
        bookingId: 1
      }
    },
    include: {
      accommodation: {
        include: {
          hotel: { include: { city: true } }
        }
      },
      tourist: true
    },
    orderBy: [
      { accommodationId: 'asc' },
      { tourist: { lastName: 'asc' } }
    ]
  });

  console.log('='.repeat(80));
  console.log('ACCOMMODATION ROOMING LIST ENTRIES FOR BOOKING 1 (ER-01):');
  console.log(`Found ${entries.length} entries`);
  console.log('='.repeat(80));

  if (entries.length === 0) {
    console.log('\nNo rooming list entries found.');
  } else {
    let currentAccId = null;
    entries.forEach(entry => {
      if (entry.accommodationId !== currentAccId) {
        currentAccId = entry.accommodationId;
        console.log(`\n${entry.accommodation.hotel.name} (Acc ID: ${entry.accommodationId})`);
        console.log(`  Accommodation dates: ${entry.accommodation.checkInDate} → ${entry.accommodation.checkOutDate}`);
      }

      console.log(`  - ${entry.tourist.lastName}, ${entry.tourist.firstName}:`);
      console.log(`    Entry checkInDate: ${entry.checkInDate}`);
      console.log(`    Entry checkOutDate: ${entry.checkOutDate}`);
      console.log(`    Room number: ${entry.roomNumber || 'N/A'}`);
    });
  }

  await prisma.$disconnect();
}

checkRoomingTable().catch(e => {
  console.error(e);
  process.exit(1);
});
