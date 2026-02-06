const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAPI() {
  console.log('\n🔍 Simulating API call: GET /3/accommodations/1370/rooming-list\n');

  // Get accommodation
  const accommodation = await prisma.accommodation.findUnique({
    where: { id: 1370 },
    include: {
      hotel: {
        include: {
          city: true
        }
      }
    }
  });

  if (!accommodation) {
    console.log('❌ Accommodation 1370 not found');
    return;
  }

  console.log(`📅 Accommodation dates:`);
  console.log(`   ${accommodation.checkInDate.toISOString().split('T')[0]} → ${accommodation.checkOutDate.toISOString().split('T')[0]}`);

  // Get tourists
  const tourists = await prisma.tourist.findMany({
    where: { bookingId: 3 },
    orderBy: { lastName: 'asc' }
  });

  console.log(`\n👥 Sample tourist (${tourists[0].lastName}):`);
  console.log(`   Returned checkInDate: ${accommodation.checkInDate.toISOString()}`);
  console.log(`   Returned checkOutDate: ${accommodation.checkOutDate.toISOString()}`);
  console.log(`\n   As ISO strings that frontend receives:`);
  console.log(`   checkInDate: "${accommodation.checkInDate.toISOString()}"`);
  console.log(`   checkOutDate: "${accommodation.checkOutDate.toISOString()}"`);

  await prisma.$disconnect();
}

testAPI().catch(console.error);
