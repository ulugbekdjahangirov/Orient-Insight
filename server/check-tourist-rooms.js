const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTouristRooms() {
  const tourists = await prisma.tourist.findMany({
    where: { bookingId: 1 },
    select: {
      id: true,
      lastName: true,
      firstName: true,
      roomNumber: true,
      roomPreference: true,
      accommodation: true
    },
    orderBy: { lastName: 'asc' }
  });

  console.log('='.repeat(80));
  console.log('TOURIST ROOM ASSIGNMENTS FOR ER-01:');
  console.log(`Found ${tourists.length} tourists`);
  console.log('='.repeat(80));

  tourists.forEach((t, i) => {
    console.log(`${i + 1}. ${t.lastName}, ${t.firstName}`);
    console.log(`   Room Number: ${t.roomNumber || 'NOT ASSIGNED'}`);
    console.log(`   Room Preference: ${t.roomPreference || 'N/A'}`);
    console.log(`   Accommodation: ${t.accommodation || 'N/A'}`);
  });

  await prisma.$disconnect();
}

checkTouristRooms().catch(e => {
  console.error(e);
  process.exit(1);
});
